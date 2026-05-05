"""Multi-mailbox CRUD, ACL, and env seed."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_middleware import CurrentUser
from core.config import get_settings
from db.models import (
    EmailSyncState,
    Enquiry,
    Mailbox,
    MailboxSyncState,
    User,
    UserMailboxAccess,
    UserTier,
)
from services.mailbox_crypto import decrypt_secret, encrypt_secret

logger = logging.getLogger(__name__)


async def count_mailboxes(db: AsyncSession) -> int:
    r = await db.execute(select(func.count()).select_from(Mailbox))
    return int(r.scalar() or 0)


async def seed_env_mailbox_if_empty(db: AsyncSession) -> uuid.UUID | None:
    """If DB has no mailboxes but legacy env IMAP creds exist, create one mailbox + ACL + backfill enquiries."""
    settings = get_settings()
    if await count_mailboxes(db) > 0:
        return None
    if not (settings.email_address and settings.email_app_password):
        return None

    legacy = await db.execute(select(EmailSyncState).where(EmailSyncState.id == 1))
    legacy_row = legacy.scalar_one_or_none()
    baseline = legacy_row.baseline_at if legacy_row else None

    mb = Mailbox(
        display_name=settings.email_address.split("@")[0].title() + " (env)",
        email_address=settings.email_address.lower().strip(),
        imap_host=settings.email_imap_host,
        imap_port=settings.email_imap_port,
        imap_folder=settings.email_sync_label,
        unread_only=settings.email_filter_unread_only,
        is_active=True,
        credential_encrypted=encrypt_secret(settings.email_app_password),
        created_by=None,
    )
    db.add(mb)
    await db.flush()

    db.add(MailboxSyncState(mailbox_id=mb.id, baseline_at=baseline))
    from sqlalchemy import update

    await db.execute(
        update(Enquiry)
        .where(Enquiry.input_type == "email_sync", Enquiry.mailbox_id.is_(None))
        .values(mailbox_id=mb.id)
    )

    urows = await db.execute(select(User.id, User.tier).where(User.is_active.is_(True)))
    for uid, tier in urows.all():
        if tier == UserTier.SUPERADMIN.value:
            continue
        can_trig = tier == UserTier.ADMIN.value
        db.add(
            UserMailboxAccess(
                user_id=uid,
                mailbox_id=mb.id,
                can_view=True,
                can_process=True,
                can_trigger_sync=can_trig,
            )
        )
    await db.commit()
    logger.info("Seeded default mailbox from env: %s", mb.email_address)
    return mb.id


async def list_mailboxes_public(db: AsyncSession, *, include_inactive: bool = False) -> list[Mailbox]:
    q = select(Mailbox).order_by(Mailbox.display_name)
    if not include_inactive:
        q = q.where(Mailbox.is_active.is_(True))
    r = await db.execute(q)
    return list(r.scalars().all())


def actor_is_superadmin(actor: CurrentUser) -> bool:
    return actor.tier == UserTier.SUPERADMIN.value


async def list_viewable_mailbox_ids(actor: CurrentUser, db: AsyncSession) -> list[uuid.UUID]:
    if actor_is_superadmin(actor):
        r = await db.execute(select(Mailbox.id).where(Mailbox.is_active.is_(True)))
        return [row[0] for row in r.all()]
    r = await db.execute(
        select(UserMailboxAccess.mailbox_id).where(
            UserMailboxAccess.user_id == uuid.UUID(actor.id),
            UserMailboxAccess.can_view.is_(True),
        )
    )
    return [row[0] for row in r.all()]


async def list_triggerable_mailbox_ids(actor: CurrentUser, db: AsyncSession) -> list[uuid.UUID]:
    if actor_is_superadmin(actor):
        r = await db.execute(select(Mailbox.id).where(Mailbox.is_active.is_(True)))
        return [row[0] for row in r.all()]
    r = await db.execute(
        select(UserMailboxAccess.mailbox_id).where(
            UserMailboxAccess.user_id == uuid.UUID(actor.id),
            UserMailboxAccess.can_trigger_sync.is_(True),
        )
    )
    return [row[0] for row in r.all()]


async def actor_can_view_mailbox(actor: CurrentUser, mailbox_id: uuid.UUID, db: AsyncSession) -> bool:
    if actor_is_superadmin(actor):
        r = await db.execute(select(Mailbox.id).where(Mailbox.id == mailbox_id, Mailbox.is_active.is_(True)))
        return r.scalar_one_or_none() is not None
    r = await db.execute(
        select(UserMailboxAccess.id).where(
            UserMailboxAccess.user_id == uuid.UUID(actor.id),
            UserMailboxAccess.mailbox_id == mailbox_id,
            UserMailboxAccess.can_view.is_(True),
        )
    )
    return r.scalar_one_or_none() is not None


async def actor_can_process_mailbox(actor: CurrentUser, mailbox_id: uuid.UUID | None, db: AsyncSession) -> bool:
    if mailbox_id is None:
        return True
    if actor_is_superadmin(actor):
        return True
    r = await db.execute(
        select(UserMailboxAccess.id).where(
            UserMailboxAccess.user_id == uuid.UUID(actor.id),
            UserMailboxAccess.mailbox_id == mailbox_id,
            UserMailboxAccess.can_process.is_(True),
        )
    )
    return r.scalar_one_or_none() is not None


async def get_mailbox(db: AsyncSession, mailbox_id: uuid.UUID) -> Mailbox | None:
    r = await db.execute(select(Mailbox).where(Mailbox.id == mailbox_id))
    return r.scalar_one_or_none()


async def get_sync_state(db: AsyncSession, mailbox_id: uuid.UUID) -> MailboxSyncState | None:
    r = await db.execute(select(MailboxSyncState).where(MailboxSyncState.mailbox_id == mailbox_id))
    return r.scalar_one_or_none()


async def get_or_create_sync_state(db: AsyncSession, mailbox_id: uuid.UUID) -> MailboxSyncState:
    row = await get_sync_state(db, mailbox_id)
    if row is None:
        row = MailboxSyncState(mailbox_id=mailbox_id, baseline_at=None)
        db.add(row)
        await db.flush()
    return row


async def create_mailbox(
    db: AsyncSession,
    *,
    display_name: str,
    email_address: str,
    imap_host: str,
    imap_port: int,
    imap_folder: str,
    unread_only: bool,
    app_password: str,
    created_by: uuid.UUID | None,
) -> Mailbox:
    addr = email_address.lower().strip()
    existing = await db.execute(select(Mailbox).where(Mailbox.email_address == addr))
    if existing.scalar_one_or_none():
        raise ValueError(f"Mailbox {addr} already exists")
    mb = Mailbox(
        display_name=display_name.strip(),
        email_address=addr,
        imap_host=imap_host.strip() or "imap.gmail.com",
        imap_port=imap_port,
        imap_folder=imap_folder.strip() or "INBOX",
        unread_only=unread_only,
        is_active=True,
        credential_encrypted=encrypt_secret(app_password),
        created_by=created_by,
    )
    db.add(mb)
    await db.flush()
    # Baseline = "connected time" so we sync new mail from the moment it was added.
    # (Prevents missing emails between connection and first scheduler run.)
    db.add(MailboxSyncState(mailbox_id=mb.id, baseline_at=datetime.now(timezone.utc)))
    await db.commit()
    await db.refresh(mb)
    return mb


async def update_mailbox_credentials(
    db: AsyncSession,
    mailbox_id: uuid.UUID,
    *,
    display_name: str | None = None,
    imap_host: str | None = None,
    imap_port: int | None = None,
    imap_folder: str | None = None,
    unread_only: bool | None = None,
    is_active: bool | None = None,
    app_password: str | None = None,
) -> Mailbox:
    mb = await get_mailbox(db, mailbox_id)
    if not mb:
        raise ValueError("Mailbox not found")
    if display_name is not None:
        mb.display_name = display_name.strip()
    if imap_host is not None:
        mb.imap_host = imap_host.strip() or mb.imap_host
    if imap_port is not None:
        mb.imap_port = imap_port
    if imap_folder is not None:
        mb.imap_folder = imap_folder.strip() or "INBOX"
    if unread_only is not None:
        mb.unread_only = unread_only
    if is_active is not None:
        mb.is_active = is_active
    if app_password is not None and app_password.strip():
        mb.credential_encrypted = encrypt_secret(app_password.strip())
    mb.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(mb)
    return mb


async def delete_mailbox_soft(db: AsyncSession, mailbox_id: uuid.UUID) -> None:
    mb = await get_mailbox(db, mailbox_id)
    if not mb:
        raise ValueError("Mailbox not found")
    mb.is_active = False
    mb.updated_at = datetime.now(timezone.utc)
    await db.commit()


def mailbox_to_dict(mb: Mailbox, *, include_secrets: bool = False) -> dict[str, Any]:
    d: dict[str, Any] = {
        "id": str(mb.id),
        "display_name": mb.display_name,
        "email_address": mb.email_address,
        "imap_host": mb.imap_host,
        "imap_port": mb.imap_port,
        "imap_folder": mb.imap_folder,
        "unread_only": mb.unread_only,
        "is_active": mb.is_active,
        "has_credentials": bool(mb.credential_encrypted),
    }
    if include_secrets and mb.credential_encrypted:
        try:
            d["app_password_preview"] = "***" + decrypt_secret(mb.credential_encrypted)[-4:]
        except Exception:  # noqa: BLE001
            d["app_password_preview"] = None
    return d


async def list_user_mailbox_access(db: AsyncSession, user_id: uuid.UUID) -> list[dict[str, Any]]:
    r = await db.execute(
        select(UserMailboxAccess, Mailbox)
        .join(Mailbox, Mailbox.id == UserMailboxAccess.mailbox_id)
        .where(UserMailboxAccess.user_id == user_id)
    )
    out: list[dict[str, Any]] = []
    for acc, mb in r.all():
        out.append(
            {
                "mailbox_id": str(acc.mailbox_id),
                "display_name": mb.display_name,
                "email_address": mb.email_address,
                "can_view": acc.can_view,
                "can_process": acc.can_process,
                "can_trigger_sync": acc.can_trigger_sync,
            }
        )
    return out


async def replace_user_mailbox_access(
    db: AsyncSession,
    user_id: uuid.UUID,
    entries: list[dict[str, Any]],
    *,
    commit: bool = True,
) -> None:
    """Replace all mailbox ACL rows for a user. entries: {mailbox_id, can_view, can_process, can_trigger_sync}."""
    await db.execute(delete(UserMailboxAccess).where(UserMailboxAccess.user_id == user_id))
    for e in entries:
        mid = uuid.UUID(str(e["mailbox_id"]))
        db.add(
            UserMailboxAccess(
                user_id=user_id,
                mailbox_id=mid,
                can_view=bool(e.get("can_view", True)),
                can_process=bool(e.get("can_process", True)),
                can_trigger_sync=bool(e.get("can_trigger_sync", False)),
            )
        )
    if commit:
        await db.commit()
