"""Async SQLAlchemy engine + session factory.

Works transparently against either a local PostgreSQL (Docker) or a hosted
Supabase Postgres. When ``settings.is_supabase`` is true, the engine is
configured for Supabase's transaction-mode pooler (PgBouncer), which
requires prepared-statement caching to be disabled.
"""

import logging
import socket
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import DeclarativeBase

from core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

def _pick_async_db_url() -> str:
    """Choose the best async URL for runtime.

    Supabase's transaction pooler (PgBouncer on port 6543 / host *pooler.supabase.com*)
    is not compatible with SQLAlchemy's asyncpg dialect because it uses prepared
    statements during dialect initialization (e.g. `select pg_catalog.version()`),
    which PgBouncer transaction pooling breaks.

    In that case, prefer the direct connection (5432) if configured.
    """
    raw = settings.DATABASE_URL
    try:
        u = make_url(raw)
    except Exception:
        return raw

    if settings.is_supabase and u.host and "pooler.supabase.com" in u.host:
        # Prefer the *session* pooler over transaction pooler when detected.
        # Supabase's transaction pooler typically runs on 6543 and breaks prepared statements.
        # The session pooler on 5432 behaves like a normal Postgres connection.
        try:
            if u.port == 6543:
                return u.set(port=5432).render_as_string(hide_password=False)
        except Exception:
            pass

        direct = (settings.DATABASE_URL_DIRECT or "").strip()
        if direct:
            async_direct = direct.replace("postgresql://", "postgresql+asyncpg://")
            # Prefer direct connection for SQLAlchemy (avoids PgBouncer prepared-statement issues),
            # but only when the hostname has an IPv4 record. Some Docker environments can't route IPv6.
            try:
                du = make_url(async_direct)
                if du.host:
                    socket.getaddrinfo(du.host, None, family=socket.AF_INET)
                    return async_direct
            except Exception:
                # No IPv4 available (or DNS restricted) → keep pooler URL.
                return raw

    return raw


def _sanitize_async_database_url(raw: str) -> tuple[str, dict[str, Any]]:
    url: URL = make_url(raw)
    query: dict[str, Any] = dict(url.query or {})

    connect_args: dict[str, Any] = {}
    sslmode = query.pop("sslmode", None)

    if isinstance(sslmode, str) and sslmode.lower() in {"require", "verify-ca", "verify-full"}:
        # asyncpg accepts ssl=True / ssl='require' / SSLContext.
        connect_args["ssl"] = "require"

    # Docker Desktop environments sometimes lack IPv6 routing. Supabase hosts often
    # resolve to IPv6 first; forcing an IPv4 address avoids `OSError: [Errno 101] Network is unreachable`.
    ipv4: str | None = None
    try:
        host = url.host
        if host:
            ipv4 = next(
                (
                    addr[4][0]
                    for addr in socket.getaddrinfo(host, None, family=socket.AF_INET)
                    if addr and addr[4]
                ),
                None,
            )
    except Exception:
        ipv4 = None

    cleaned = url.set(query=query, host=ipv4 or url.host)
    return cleaned.render_as_string(hide_password=False), connect_args


def _build_engine_kwargs() -> dict[str, Any]:
    """Assemble ``create_async_engine`` kwargs appropriate for the target DB.

    Supabase (PgBouncer in transaction mode) constraints:
      * Prepared statements MUST be disabled — PgBouncer rewrites
        statements between transactions. For asyncpg this means
        ``statement_cache_size=0`` and ``prepared_statement_cache_size=0``.
      * ``pool_pre_ping`` guards against stale pooled connections.
    """
    kwargs: dict[str, Any] = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "echo": settings.APP_ENV == "development",
    }

    if settings.is_supabase:
        kwargs.update(
            {
                # Supabase poolers can be sensitive; avoid reusing connections.
                "poolclass": NullPool,
                "connect_args": {
                    "statement_cache_size": 0,
                    # Supabase requires TLS.
                    "ssl": "require",
                },
            }
        )
    else:
        kwargs.update({"pool_size": 5, "max_overflow": 10})

    return kwargs


_db_url, _url_connect_args = _sanitize_async_database_url(_pick_async_db_url())
_engine_kwargs = _build_engine_kwargs()
_engine_kwargs["connect_args"] = {
    **(_engine_kwargs.get("connect_args") or {}),
    **_url_connect_args,
}
engine = create_async_engine(_db_url, **_engine_kwargs)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Alias for scripts / newer call-sites.
AsyncSessionLocal = async_session_factory


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Bootstrap tables + pgvector. Safe to run repeatedly.

    On Supabase the ``vector`` extension is typically already installed at
    the cluster level, but the role may lack ``CREATE EXTENSION``
    privileges. We therefore wrap the statement in try/except and log a
    warning rather than aborting startup.
    """
    async with engine.begin() as conn:
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception as exc:
            logger.warning(
                "Could not CREATE EXTENSION vector (%s). "
                "If using Supabase, enable it once via Dashboard → Database → Extensions.",
                exc,
            )
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database initialised. supabase=%s", settings.is_supabase)


async def check_db_connection() -> bool:
    """Lightweight health-probe returning True iff ``SELECT 1`` succeeds."""
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("DB connection failed: %s", exc)
        return False
