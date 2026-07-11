#!/usr/bin/env python3
"""Quick connection verification.

Usage:
    cd backend
    python scripts/verify_connection.py

Prints a short report: connection type, Postgres version, pgvector status,
list of public tables, and row counts for a few key tables.
"""

from __future__ import annotations

import asyncio
import os
import sys

# Make ``backend/`` importable when the script is launched directly.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func, select, text  # noqa: E402

from core.config import get_settings  # noqa: E402
from core.database import async_session_factory  # noqa: E402


async def verify() -> None:
    settings = get_settings()

    print(
        f"\nConnection type: {'Supabase' if settings.is_supabase else 'Local'}"
    )
    url = settings.DATABASE_URL or ""
    print(f"URL preview:     {url[:55]}...")

    try:
        async with async_session_factory() as db:
            version = (await db.execute(text("SELECT version()"))).scalar()
            print("\n✓ Connected")
            print(f"  PostgreSQL: {str(version)[:60]}...")

            vec = (
                await db.execute(
                    text(
                        "SELECT installed_version FROM pg_available_extensions "
                        "WHERE name = 'vector'"
                    )
                )
            ).scalar()
            if vec:
                print(f"  pgvector:   {vec} ✓")
            else:
                print("  pgvector:   not installed ⚠")

            rows = (
                await db.execute(
                    text(
                        "SELECT table_name FROM information_schema.tables "
                        "WHERE table_schema = 'public' ORDER BY table_name"
                    )
                )
            ).all()
            tables = [r[0] for r in rows]
            print(f"\n  Tables ({len(tables)}):")
            for t in tables:
                print(f"    - {t}")

            try:
                from db.models import Enquiry, Quotation, User  # noqa: E402
                from db.sheet_models import (  # noqa: E402
                    CatalogButterflyValveRow,
                    CatalogOperatorRow,
                )

                users = await db.scalar(select(func.count(User.id)))
                enquiries = await db.scalar(select(func.count(Enquiry.id)))
                quotations = await db.scalar(select(func.count(Quotation.id)))
                butterfly = await db.scalar(
                    select(func.count(CatalogButterflyValveRow.row_id))
                )
                operators = await db.scalar(
                    select(func.count(CatalogOperatorRow.row_id))
                )
                print(f"\n  Users:          {users}")
                print(f"  Enquiries:      {enquiries}")
                print(f"  Quotations:     {quotations}")
                print(f"  Butterfly rows: {butterfly}")
                print(f"  Operators:      {operators}")
            except Exception as exc:
                print(f"\n  (Row counts skipped — tables not yet migrated: {exc})")

    except Exception as exc:
        print(f"\n✗ Connection failed: {exc}")
        sys.exit(1)

    print("\n✓ All checks passed\n")


if __name__ == "__main__":
    asyncio.run(verify())
