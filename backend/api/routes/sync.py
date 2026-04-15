"""Email sync status, manual trigger, and processed-email history."""

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import async_session_factory, get_db
from db.models import EmailSyncState, ProcessedEmail

router = APIRouter(prefix="/api/sync", tags=["email-sync"])


@router.get("/status")
async def get_sync_status() -> dict:
    from core.config import get_settings
    from services.scheduler_service import scheduler

    settings = get_settings()
    job = scheduler.get_job("email_sync")

    baseline_at: str | None = None
    async with async_session_factory() as s:
        r = await s.execute(select(EmailSyncState).where(EmailSyncState.id == 1))
        row = r.scalar_one_or_none()
        if row and row.baseline_at:
            baseline_at = row.baseline_at.isoformat()

    return {
        "sync_enabled": settings.email_sync_enabled,
        "email_configured": bool(settings.email_address and settings.email_app_password),
        "email_address": settings.email_address if settings.email_address else None,
        "scheduler_running": scheduler.running,
        "interval_seconds": settings.email_sync_interval_seconds,
        "next_run": job.next_run_time.isoformat() if job and job.next_run_time else None,
        "baseline_at": baseline_at,
    }


@router.post("/trigger")
async def trigger_sync_now() -> dict:
    from services.email_sync_service import email_sync_service

    summary = await email_sync_service.sync_once()
    return {"message": "Sync complete", "summary": summary}


@router.get("/history")
async def get_sync_history(limit: int = 50, db: AsyncSession = Depends(get_db)) -> list[dict]:
    result = await db.execute(
        select(ProcessedEmail).order_by(desc(ProcessedEmail.created_at)).limit(limit)
    )
    emails = result.scalars().all()
    return [
        {
            "message_id": e.message_id,
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
