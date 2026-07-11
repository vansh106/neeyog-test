"""Email sync status, manual trigger, and processed-email history."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from config.permissions import Permission
from core.auth_middleware import CurrentUser, require_permission
from core.database import async_session_factory, get_db
from db.models import EmailSyncState, Mailbox, MailboxSyncState, ProcessedEmail, UserTier

router = APIRouter(prefix="/api/sync", tags=["email-sync"])


class TriggerSyncBody(BaseModel):
    mailbox_id: str | None = None


@router.get("/status")
async def get_sync_status(
    _user: CurrentUser = Depends(require_permission(Permission.EMAIL_SYNC_VIEW)),
) -> dict:
    from core.config import get_settings
    from services.mailbox_service import count_mailboxes
    from services.scheduler_service import scheduler

    settings = get_settings()
    job = scheduler.get_job("email_sync")

    baseline_legacy: str | None = None
    mailboxes_meta: list[dict] = []
    async with async_session_factory() as s:
        r = await s.execute(select(EmailSyncState).where(EmailSyncState.id == 1))
        row = r.scalar_one_or_none()
        if row and row.baseline_at:
            baseline_legacy = row.baseline_at.isoformat()

        mb_rows = await s.execute(
            select(Mailbox)
            .options(joinedload(Mailbox.sync_state))
            .where(Mailbox.is_active.is_(True))
            .order_by(Mailbox.display_name)
        )
        for mb in mb_rows.scalars().unique().all():
            st = mb.sync_state
            mailboxes_meta.append(
                {
                    "id": str(mb.id),
                    "display_name": mb.display_name,
                    "email_address": mb.email_address,
                    "baseline_at": st.baseline_at.isoformat() if st and st.baseline_at else None,
                    "has_credentials": bool(mb.credential_encrypted),
                }
            )

        n_mail = await count_mailboxes(s)

    return {
        "sync_enabled": settings.email_sync_enabled,
        "email_configured": bool(settings.email_address and settings.email_app_password) or n_mail > 0,
        "email_address": settings.email_address if settings.email_address else None,
        "mailbox_count": n_mail,
        "mailboxes": mailboxes_meta,
        "scheduler_running": scheduler.running,
        "interval_seconds": settings.email_sync_interval_seconds,
        "next_run": job.next_run_time.isoformat() if job and job.next_run_time else None,
        "baseline_at": baseline_legacy,
    }


@router.post("/trigger")
async def trigger_sync_now(
    body: TriggerSyncBody | None = None,
    user: CurrentUser = Depends(require_permission(Permission.EMAIL_SYNC_TRIGGER)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from services.email_sync_service import email_sync_service
    from services.mailbox_service import list_triggerable_mailbox_ids

    body = body or TriggerSyncBody()
    if body.mailbox_id:
        import uuid

        mid = uuid.UUID(body.mailbox_id)
        allowed = await list_triggerable_mailbox_ids(user, db)
        if user.tier != UserTier.SUPERADMIN.value and mid not in allowed:
            raise HTTPException(status_code=403, detail="Cannot trigger sync for this mailbox")
        summary = await email_sync_service.sync_once(mid)
        return {"message": "Sync complete", "summary": summary}

    summary = await email_sync_service.sync_once(None)
    return {"message": "Sync complete", "summary": summary}


@router.post("/reset-baseline")
async def reset_email_sync_baseline(
    user: CurrentUser = Depends(require_permission(Permission.EMAIL_SYNC_TRIGGER)),
    db: AsyncSession = Depends(get_db),
    mailbox_id: str | None = Query(None, description="Per-mailbox baseline; omit for legacy singleton only"),
) -> dict:
    from services.mailbox_service import list_triggerable_mailbox_ids

    now = datetime.now(timezone.utc)
    if mailbox_id:
        import uuid

        mid = uuid.UUID(mailbox_id)
        allowed = await list_triggerable_mailbox_ids(user, db)
        if user.tier != UserTier.SUPERADMIN.value and mid not in allowed:
            raise HTTPException(status_code=403, detail="Cannot reset baseline for this mailbox")
        r = await db.execute(select(MailboxSyncState).where(MailboxSyncState.mailbox_id == mid))
        row = r.scalar_one_or_none()
        if row is None:
            row = MailboxSyncState(mailbox_id=mid, baseline_at=now)
            db.add(row)
        else:
            row.baseline_at = now
        await db.commit()
        return {"message": "mailbox baseline_at set to now", "mailbox_id": mailbox_id, "baseline_at": now.isoformat()}

    r = await db.execute(select(EmailSyncState).where(EmailSyncState.id == 1))
    row = r.scalar_one_or_none()
    if row is None:
        row = EmailSyncState(id=1, baseline_at=now)
        db.add(row)
    else:
        row.baseline_at = now
    await db.commit()
    return {
        "message": "legacy baseline_at set to now",
        "baseline_at": now.isoformat(),
    }


@router.get("/history")
async def get_sync_history(
    _user: CurrentUser = Depends(require_permission(Permission.EMAIL_SYNC_VIEW)),
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    result = await db.execute(select(ProcessedEmail).order_by(desc(ProcessedEmail.created_at)).limit(limit))
    emails = result.scalars().all()
    return [
        {
            "message_id": e.message_id,
            "mailbox_id": str(e.mailbox_id) if e.mailbox_id else None,
            "sender_email": e.sender_email,
            "sender_name": e.sender_name,
            "subject": e.subject,
            "was_processed": e.was_processed,
            "filter_reason": e.filter_reason,
            "enquiry_id": str(e.enquiry_id) if e.enquiry_id else None,
            "received_at": e.received_at.isoformat(),
        }
        for e in emails
    ]
