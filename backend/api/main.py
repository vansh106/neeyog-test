"""FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from api.routes import auth, enquiries, masters, quotations, stream, sync, users
from core.config import get_settings
from core.database import async_session_factory, init_db
from db.sheet_models import (
    BallValveRow,
    ButterflyValveRow,
    DiaphragmValveRow,
    HosesRow,
    NvrRow,
    SightGlassRow,
    SpecialityValveRow,
    StrainerRow,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings

    await init_db()
    logger.info("Database initialised, pgvector enabled.")

    # Seed superadmin (idempotent)
    try:
        from services.auth_service import ensure_superadmin_seeded

        async with async_session_factory() as session:
            created = await ensure_superadmin_seeded(session)
            if created:
                logger.info("SuperAdmin created: %s", settings.SUPERADMIN_EMAIL)
    except Exception:
        logger.exception("SuperAdmin seed failed")

    async with async_session_factory() as session:
        models = [
            ("butterfly_valve", ButterflyValveRow),
            ("ball_valve", BallValveRow),
            ("diaphragm_valve", DiaphragmValveRow),
            ("nvr", NvrRow),
            ("hoses", HosesRow),
            ("speciality_valve", SpecialityValveRow),
            ("sight_glass", SightGlassRow),
            ("strainer", StrainerRow),
        ]
        total = 0
        for key, model in models:
            result = await session.execute(
                select(func.count(model.row_id)).where(model.client_id == settings.ACTIVE_CLIENT)
            )
            c = int(result.scalar() or 0)
            total += c
            logger.info("Catalog rows (%s): %d", key, c)
        # Read-only session: commit so SQLAlchemy does not emit a noisy ROLLBACK on close.
        await session.commit()

    if total == 0:
        hint = (
            "Import the master XLSX into sheet tables, e.g. from the backend root: "
            "`python db/import_sheet_tables.py --file /path/to/Parth_valves_product_list.xlsx`."
        )
        if settings.APP_ENV == "development":
            logger.info(
                "Catalog is empty for client_id=%s — %s",
                settings.ACTIVE_CLIENT,
                hint,
            )
        else:
            logger.warning("Catalog is empty for client_id=%s. %s", settings.ACTIVE_CLIENT, hint)
    else:
        logger.info("Found %d catalog rows for client_id=%s.", total, settings.ACTIVE_CLIENT)

    os.makedirs(settings.PDF_OUTPUT_DIR, exist_ok=True)
    os.makedirs("./output", exist_ok=True)

    from services.scheduler_service import start_scheduler, stop_scheduler

    start_scheduler()

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
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(enquiries.router)
app.include_router(quotations.router)
app.include_router(masters.router, prefix="/api")
app.include_router(sync.router)
app.include_router(stream.router)
app.include_router(auth.router)
app.include_router(users.router)


@app.get("/health")
async def health():
    settings = get_settings()
    return {
        "status": "ok",
        "client": settings.ACTIVE_CLIENT,
        "model": settings.LITELLM_MODEL,
    }
