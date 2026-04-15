"""APScheduler wiring for periodic Gmail IMAP sync."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from core.config import get_settings
from services.email_sync_service import email_sync_service

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = AsyncIOScheduler()


async def _sync_job() -> None:
    try:
        summary = await email_sync_service.sync_once()
        if summary["enquiries_created"] > 0:
            logger.info("Sync job: %s new enquiries created", summary["enquiries_created"])
    except Exception as e:
        logger.error("Sync job failed: %s", e, exc_info=True)


def start_scheduler() -> None:
    if not settings.email_sync_enabled:
        logger.info("Email sync disabled — scheduler not started")
        return

    if not settings.email_address or not settings.email_app_password:
        logger.warning("EMAIL_ADDRESS or EMAIL_APP_PASSWORD not set — scheduler not started")
        return

    scheduler.add_job(
        _sync_job,
        trigger=IntervalTrigger(seconds=settings.email_sync_interval_seconds),
        id="email_sync",
        name="Gmail IMAP Sync",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.start()
    logger.info(
        "Email sync scheduler started — interval: %ss — account: %s",
        settings.email_sync_interval_seconds,
        settings.email_address,
    )


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Email sync scheduler stopped")
