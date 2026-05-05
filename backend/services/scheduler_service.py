"""APScheduler wiring for periodic Gmail IMAP sync (all configured mailboxes)."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from core.config import get_settings
from core.database import async_session_factory
from services.email_sync_service import email_sync_service
from services.mailbox_service import count_mailboxes

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = AsyncIOScheduler()


async def _sync_job() -> None:
    try:
        summary = await email_sync_service.sync_all_mailboxes()
        n = int(summary.get("enquiries_created") or 0)
        if n > 0:
            logger.info("Sync job: %s new enquiries created", n)
    except Exception as e:
        logger.error("Sync job failed: %s", e, exc_info=True)


async def start_scheduler_async() -> None:
    if not settings.email_sync_enabled:
        logger.info("Email sync disabled — scheduler not started")
        return

    async with async_session_factory() as db:
        n_mail = await count_mailboxes(db)
    legacy_ok = bool(settings.email_address and settings.email_app_password)
    if n_mail == 0 and not legacy_ok:
        logger.warning("No mailboxes in DB and no legacy EMAIL_ADDRESS — scheduler not started")
        return

    scheduler.add_job(
        _sync_job,
        trigger=IntervalTrigger(seconds=settings.email_sync_interval_seconds),
        id="email_sync",
        name="Gmail IMAP Sync (all mailboxes)",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.start()
    logger.info(
        "Email sync scheduler started — interval: %ss — mailboxes in DB: %s",
        settings.email_sync_interval_seconds,
        n_mail,
    )


def start_scheduler() -> None:
    """Sync entry for non-async callers (no-op — use start_scheduler_async from lifespan)."""
    logger.warning("start_scheduler() is deprecated — await start_scheduler_async() from app lifespan")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Email sync scheduler stopped")
