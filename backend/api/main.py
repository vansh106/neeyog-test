"""FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes import analytics, auth, clients, configurator, enquiries, indiamart, mailboxes, masters, purchase_orders, quotations, stream, suppliers, sync, users
from core.config import get_settings
from core.database import async_session_factory, get_db, init_db
from masters.product_master import SHEET_TABLES

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings

    await init_db()
    logger.info("Database initialised, pgvector enabled.")

    from db.models import User, UserTier
    from services.auth_service import hash_password

    try:
        async with async_session_factory() as db:
            r = await db.execute(select(User).where(User.tier == UserTier.SUPERADMIN.value))
            if r.scalar_one_or_none() is None:
                db.add(
                    User(
                        email=settings.superadmin_email.lower().strip(),
                        full_name=settings.superadmin_name,
                        hashed_password=hash_password(settings.superadmin_password),
                        tier=UserTier.SUPERADMIN.value,
                        job_title="Super Administrator",
                        phone=settings.superadmin_phone,
                        is_active=True,
                        is_first_login=False,
                    )
                )
                await db.commit()
                logger.info("SuperAdmin created: %s", settings.superadmin_email)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Superadmin seed skipped (migrations applied?): %s", exc)

    try:
        from services.mailbox_service import seed_env_mailbox_if_empty

        async with async_session_factory() as db:
            await seed_env_mailbox_if_empty(db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Mailbox env seed skipped: %s", exc)

    async with async_session_factory() as session:
        total = 0
        for key, model in SHEET_TABLES:
            result = await session.execute(
                select(func.count(model.row_id)).where(model.client_id == settings.ACTIVE_CLIENT)
            )
            c = int(result.scalar() or 0)
            total += c
            logger.info("Catalog rows (%s): %d", key, c)

    if total == 0:
        logger.warning(
            "Catalog is empty for client_id=%s. Run: python -m db.import_final_products_catalog",
            settings.ACTIVE_CLIENT,
        )
    else:
        logger.info("Found %d catalog rows for client_id=%s.", total, settings.ACTIVE_CLIENT)

    os.makedirs(settings.PDF_OUTPUT_DIR, exist_ok=True)
    os.makedirs("./output", exist_ok=True)

    from services.scheduler_service import start_scheduler_async, stop_scheduler

    await start_scheduler_async()

    logger.info(
        "Quotation System API ready — client: %s — model: %s",
        settings.ACTIVE_CLIENT,
        settings.LITELLM_MODEL,
    )
    yield

    stop_scheduler()
    logger.info("API shutdown complete")


app = FastAPI(
    title="Quotation System API",
    description="AI-powered quotation system for industrial manufacturing",
    version="1.0.0-mvp",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(analytics.router)
app.include_router(enquiries.router)
app.include_router(indiamart.router)
app.include_router(quotations.router)
app.include_router(purchase_orders.router)
app.include_router(masters.router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(suppliers.router, prefix="/api")
app.include_router(sync.router)
app.include_router(mailboxes.router)
app.include_router(stream.router)
app.include_router(configurator.router)


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    checks: dict = {
        "status": "ok",
        "database": "checking",
        "db_type": "supabase" if settings.is_supabase else "local",
    }

    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["database"] = "error"
        checks["database_error"] = str(exc)
        checks["status"] = "degraded"

    checks["llm_configured"] = bool(settings.ANTHROPIC_API_KEY or settings.GEMINI_API_KEY)
    checks["email_sync"] = (
        "enabled"
        if settings.email_sync_enabled and settings.email_address
        else "disabled"
    )
    checks["client"] = settings.ACTIVE_CLIENT
    checks["model"] = settings.LITELLM_MODEL
    return checks
