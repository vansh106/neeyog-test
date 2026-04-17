from __future__ import annotations

import secrets
import uuid
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AuthorizationError, UserNotFoundError
from db.models import AuditLog, User, UserPermission
from services.auth_service import get_user_permissions, hash_password


async def create_user(
    full_name: str,
    email: str,
    job_title: str | None,
    tier: str,
    permissions: list[str],
    created_by_id: str,
    db: AsyncSession,
) -> tuple[User, str]:
    em = email.strip().lower()
    existing = await db.execute(select(User).where(func.lower(func.trim(User.email)) == em))
    if existing.scalar_one_or_none():
        raise ValueError(f"Email {email} is already registered")

    suffix = secrets.token_hex(3).upper()
    temp_pass = f"Parth@{suffix}"

    user = User(
        email=em,
        full_name=full_name,
        hashed_password=hash_password(temp_pass),
        tier=tier,
        job_title=job_title,
        is_active=True,
        is_first_login=True,
        created_by=uuid.UUID(created_by_id),
    )
    db.add(user)
    await db.flush()

    for perm in permissions:
        db.add(
            UserPermission(
                user_id=user.id,
                permission=perm,
                granted_by=uuid.UUID(created_by_id),
            )
        )

    await db.commit()
    await db.refresh(user)
    return user, temp_pass


async def update_user_permissions(
    target_user_id: str,
    new_permissions: list[str],
    updated_by_id: str,
    db: AsyncSession,
) -> None:
    if target_user_id == updated_by_id:
        raise AuthorizationError("Cannot edit your own permissions")

    result = await db.execute(select(User).where(User.id == uuid.UUID(target_user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFoundError("User not found")
    if user.tier == "superadmin":
        raise AuthorizationError("Cannot edit superadmin permissions")

    await db.execute(delete(UserPermission).where(UserPermission.user_id == uuid.UUID(target_user_id)))
    for perm in new_permissions:
        db.add(
            UserPermission(
                user_id=uuid.UUID(target_user_id),
                permission=perm,
                granted_by=uuid.UUID(updated_by_id),
            )
        )
    await db.commit()

    db.add(
        AuditLog(
            id=uuid.uuid4(),
            entity_type="user",
            entity_id=uuid.UUID(target_user_id),
            action="permissions_updated",
            performed_by=updated_by_id,
            details={"new_permissions": new_permissions, "count": len(new_permissions)},
        )
    )
    await db.commit()


async def deactivate_user(target_user_id: str, deactivated_by: str, db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.id == uuid.UUID(target_user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFoundError("User not found")
    if user.tier == "superadmin":
        raise AuthorizationError("Cannot deactivate superadmin")
    user.is_active = False
    await db.commit()


async def reactivate_user(target_user_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.id == uuid.UUID(target_user_id)))
    user = result.scalar_one_or_none()
    if user:
        user.is_active = True
        await db.commit()


async def reset_user_password(target_user_id: str, reset_by: str, db: AsyncSession) -> str:
    result = await db.execute(select(User).where(User.id == uuid.UUID(target_user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFoundError("User not found")

    suffix = secrets.token_hex(3).upper()
    temp_pass = f"Parth@{suffix}"
    user.hashed_password = hash_password(temp_pass)
    user.is_first_login = True
    await db.commit()
    return temp_pass


async def list_users(db: AsyncSession, include_inactive: bool = False) -> list[dict]:
    q = select(User)
    if not include_inactive:
        q = q.where(User.is_active == True)  # noqa: E712
    q = q.order_by(User.full_name)
    result = await db.execute(q)
    users = result.scalars().all()

    out: list[dict] = []
    for user in users:
        perms = await get_user_permissions(user, db)
        out.append(
            {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "tier": user.tier,
                "job_title": user.job_title,
                "is_active": user.is_active,
                "is_first_login": user.is_first_login,
                "permissions": perms,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            }
        )
    return out


async def get_user(user_id: str, db: AsyncSession) -> dict:
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFoundError("User not found")
    perms = await get_user_permissions(user, db)
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "tier": user.tier,
        "job_title": user.job_title,
        "is_active": user.is_active,
        "is_first_login": user.is_first_login,
        "permissions": perms,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }

