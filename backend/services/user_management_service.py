"""Admin user creation and per-user permission rows."""

from __future__ import annotations

import secrets
import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from core.exceptions import AuthorizationError, UserNotFoundError
from db.models import AuditLog, Mailbox, User, UserPermission, UserTier
from services.auth_service import get_user_permissions, hash_password
from services.mailbox_service import list_user_mailbox_access, replace_user_mailbox_access


def _valid_permission_values() -> set[str]:
    return {p.value for p in Permission}


async def create_user(
    *,
    full_name: str,
    email: str,
    job_title: str | None,
    tier: str,
    permissions: list[str],
    mailbox_access: list[dict] | None = None,
    created_by_id: str,
    db: AsyncSession,
) -> tuple[User, str]:
    if tier not in (UserTier.ADMIN.value, UserTier.MEMBER.value, UserTier.INDIAMART.value):
        raise ValueError("Tier must be 'member', 'admin', or 'indiamart'")
    valid = _valid_permission_values()
    if tier == UserTier.INDIAMART.value and not permissions:
        from config.permissions import PERMISSION_PRESETS

        permissions = [p.value for p in PERMISSION_PRESETS.get("IndiaMart Account", [])]
    for p in permissions:
        if p not in valid:
            raise ValueError(f"Invalid permission: {p}")

    existing = await db.execute(select(User).where(User.email == email.lower().strip()))
    if existing.scalar_one_or_none():
        raise ValueError(f"Email {email} is already registered")

    suffix = secrets.token_hex(3).upper()
    temp_pass = f"Neeyog@{suffix}"

    user = User(
        email=email.lower().strip(),
        full_name=full_name.strip(),
        hashed_password=hash_password(temp_pass),
        tier=tier,
        job_title=(job_title or "").strip() or None,
        is_active=True,
        is_first_login=True,
        created_by=uuid.UUID(created_by_id),
    )
    db.add(user)
    await db.flush()

    grantor = uuid.UUID(created_by_id)
    for perm in permissions:
        db.add(
            UserPermission(
                user_id=user.id,
                permission=perm,
                granted_by=grantor,
            )
        )
    await db.commit()
    await db.refresh(user)
    if mailbox_access:
        await replace_user_mailbox_access(db, user.id, mailbox_access)
    return user, temp_pass


async def update_user_permissions(
    target_user_id: str,
    new_permissions: list[str],
    updated_by_id: str,
    db: AsyncSession,
) -> None:
    valid = _valid_permission_values()
    for p in new_permissions:
        if p not in valid:
            raise ValueError(f"Invalid permission: {p}")

    uid = uuid.UUID(target_user_id)
    actor = uuid.UUID(updated_by_id)

    urow = await db.execute(select(User).where(User.id == uid))
    target = urow.scalar_one_or_none()
    if not target:
        raise UserNotFoundError("User not found")
    if target.tier == UserTier.SUPERADMIN.value and str(actor) != str(target.id):
        raise AuthorizationError("Cannot change superadmin permissions")

    await db.execute(delete(UserPermission).where(UserPermission.user_id == uid))
    for perm in new_permissions:
        db.add(UserPermission(user_id=uid, permission=perm, granted_by=actor))

    db.add(
        AuditLog(
            entity_type="user",
            entity_id=uid,
            action="permissions_updated",
            performed_by=updated_by_id,
            details={"new_permissions": new_permissions, "count": len(new_permissions)},
        )
    )
    await db.commit()


async def update_user_mailbox_access(
    target_user_id: str,
    access: list[dict],
    actor_id: str,
    db: AsyncSession,
) -> None:
    uid = uuid.UUID(target_user_id)
    actor = uuid.UUID(actor_id)

    urow = await db.execute(select(User).where(User.id == uid))
    target = urow.scalar_one_or_none()
    if not target:
        raise UserNotFoundError("User not found")
    if target.tier == UserTier.SUPERADMIN.value and str(actor) != str(target.id):
        raise AuthorizationError("Cannot change another superadmin's mailbox access")

    for row in access:
        mid = uuid.UUID(str(row["mailbox_id"]))
        mrow = await db.execute(select(Mailbox.id).where(Mailbox.id == mid))
        if mrow.scalar_one_or_none() is None:
            raise ValueError(f"Unknown mailbox: {mid}")

    await replace_user_mailbox_access(db, uid, access, commit=False)

    db.add(
        AuditLog(
            entity_type="user",
            entity_id=uid,
            action="mailbox_access_updated",
            performed_by=actor_id,
            details={"count": len(access)},
        )
    )
    await db.commit()


async def deactivate_user(target_user_id: str, deactivated_by: str, db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.id == uuid.UUID(target_user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFoundError("User not found")
    if user.tier == UserTier.SUPERADMIN.value:
        raise AuthorizationError("Cannot deactivate superadmin")
    user.is_active = False
    await db.commit()


async def reactivate_user(target_user_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.id == uuid.UUID(target_user_id)))
    user = result.scalar_one_or_none()
    if user:
        user.is_active = True
        await db.commit()


async def update_monthly_booking_target(
    target_user_id: str,
    monthly_booking_target: float,
    updated_by_id: str,
    db: AsyncSession,
) -> None:
    if monthly_booking_target < 0:
        raise ValueError("Monthly booking target must be zero or positive")

    uid = uuid.UUID(target_user_id)
    urow = await db.execute(select(User).where(User.id == uid))
    target = urow.scalar_one_or_none()
    if not target:
        raise UserNotFoundError("User not found")
    if target.tier == UserTier.SUPERADMIN.value and str(updated_by_id) != str(target.id):
        raise AuthorizationError("Cannot change another superadmin's monthly target")

    target.monthly_booking_target = monthly_booking_target

    db.add(
        AuditLog(
            entity_type="user",
            entity_id=uid,
            action="monthly_booking_target_updated",
            performed_by=updated_by_id,
            details={"monthly_booking_target": monthly_booking_target},
        )
    )
    await db.commit()


async def reset_user_password(target_user_id: str, db: AsyncSession) -> str:
    result = await db.execute(select(User).where(User.id == uuid.UUID(target_user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFoundError("User not found")
    suffix = secrets.token_hex(3).upper()
    temp_pass = f"Neeyog@{suffix}"
    user.hashed_password = hash_password(temp_pass)
    user.is_first_login = True
    await db.commit()
    return temp_pass


async def list_users(db: AsyncSession, *, include_inactive: bool = False) -> list[dict]:
    q = select(User).order_by(User.full_name)
    if not include_inactive:
        q = q.where(User.is_active.is_(True))
    result = await db.execute(q)
    users = result.scalars().all()
    output: list[dict] = []
    for user in users:
        perms = await get_user_permissions(user, db)
        mbx = await list_user_mailbox_access(db, user.id)
        output.append(
            {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "tier": user.tier,
                "job_title": user.job_title,
                "monthly_booking_target": user.monthly_booking_target,
                "is_active": user.is_active,
                "is_first_login": user.is_first_login,
                "permissions": perms,
                "mailbox_access": mbx,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            }
        )
    return output


async def get_user(user_id: str, db: AsyncSession) -> dict:
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFoundError("User not found")
    perms = await get_user_permissions(user, db)
    mbx = await list_user_mailbox_access(db, user.id)
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "tier": user.tier,
        "job_title": user.job_title,
        "monthly_booking_target": user.monthly_booking_target,
        "is_active": user.is_active,
        "is_first_login": user.is_first_login,
        "permissions": perms,
        "mailbox_access": mbx,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }
