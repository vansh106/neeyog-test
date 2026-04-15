"""FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from api.routes import enquiries, masters, quotations, stream, sync
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

    if total == 0:
        logger.warning(
            "Catalog is empty for client_id=%s. Import your XLSX into sheet tables.",
            settings.ACTIVE_CLIENT,
        )
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


@app.get("/health")
async def health():
    settings = get_settings()
    return {
        "status": "ok",
        "client": settings.ACTIVE_CLIENT,
        "model": settings.LITELLM_MODEL,
    }
