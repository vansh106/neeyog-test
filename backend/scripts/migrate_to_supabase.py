#!/usr/bin/env python3
"""Migration script: Local PostgreSQL → Supabase.

Usage:
    cd backend
    python scripts/migrate_to_supabase.py

Steps:
    1. Verifies the DATABASE_URL points at Supabase and is reachable.
    2. Runs ``alembic upgrade head`` (uses DATABASE_URL_DIRECT — see env.py).
    3. Seeds essential data — pgvector extension, demo products if empty.
    4. Prints a row-count summary.
    5. Prints next-step instructions.
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys

# Make ``backend/`` importable when invoked directly.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func, select, text  # noqa: E402

from core.config import get_settings  # noqa: E402
from core.database import async_session_factory, check_db_connection  # noqa: E402

settings = get_settings()
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


async def step1_verify_connection() -> None:
    print("\n[1/5] Verifying Supabase connection...")

    if not settings.is_supabase:
        print("  ERROR: DATABASE_URL does not look like a Supabase URL.")
        print(f"  Current URL starts with: {settings.DATABASE_URL[:40]}...")
        print("  Update .env first (see .env.example).")
        sys.exit(1)

    if not await check_db_connection():
        print("  ERROR: Cannot connect to Supabase.")
        print("  Check:")
        print("    1. DATABASE_URL is correct")
        print("    2. Supabase project is not paused")
        print("    3. Password is correct")
        print("    4. Your IP is not blocked by Supabase network rules")
        sys.exit(1)

    print("  ✓ Connected to Supabase")
    if settings.SUPABASE_URL:
        print(f"  ✓ Project: {settings.SUPABASE_URL}")


def step2_run_migrations() -> None:
    print("\n[2/5] Running Alembic migrations...")
    preview = settings.migration_url[:60] if settings.migration_url else "<unset>"
    print(f"  Using: {preview}...")

    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
        cwd=BACKEND_DIR,
    )

    if result.returncode != 0:
        print("  ERROR: Alembic migration failed")
        print(result.stderr)
        sys.exit(1)

    print("  ✓ All migrations applied")
    for line in (result.stdout or "").strip().splitlines():
        print(f"    {line}")


async def step3_seed_data() -> None:
    print("\n[3/5] Seeding essential data...")

    async with async_session_factory() as db:
        try:
            await db.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await db.commit()
            print("  ✓ pgvector extension enabled")
        except Exception as exc:
            print(f"  ⚠ pgvector: {exc}")
            print(
                "    Enable it manually: Supabase Dashboard → Database → "
                "Extensions → vector"
            )

    # Catalog — report whether the revamp catalog has been imported.
    # Actual import is done separately via:
    #   python -m db.import_revamp_catalog --clear-existing
    # (kept out of this migration script to avoid surprise data writes).
    try:
        from db.sheet_models import CatalogButterflyValveRow  # noqa: E402

        async with async_session_factory() as db:
            count = await db.scalar(
                select(func.count(CatalogButterflyValveRow.row_id))
            )
        if not count:
            print(
                "  ⚠ Catalog is empty. After this script finishes run:\n"
                "      python -m db.import_revamp_catalog --clear-existing"
            )
        else:
            print(f"  ✓ Catalog already populated ({count} butterfly rows)")
    except Exception as exc:
        print(f"  ⚠ Catalog check skipped: {exc}")


async def step4_verify_data() -> None:
    print("\n[4/5] Verifying data on Supabase...")

    try:
        from db.models import Enquiry, Quotation, User  # noqa: E402
        from db.sheet_models import CatalogButterflyValveRow  # noqa: E402

        async with async_session_factory() as db:
            users = await db.scalar(select(func.count(User.id)))
            enquiries = await db.scalar(select(func.count(Enquiry.id)))
            quotations = await db.scalar(select(func.count(Quotation.id)))
            butterfly = await db.scalar(
                select(func.count(CatalogButterflyValveRow.row_id))
            )

        print(f"  Users:          {users}")
        print(f"  Enquiries:      {enquiries}")
        print(f"  Quotations:     {quotations}")
        print(f"  Butterfly rows: {butterfly}")
        print("  ✓ Data verified")
    except Exception as exc:
        print(f"  ⚠ Could not verify data: {exc}")


def step5_print_summary() -> None:
    print("\n[5/5] Migration complete!")
    print("\n" + "=" * 50)
    print("  SUPABASE MIGRATION SUCCESSFUL")
    print("=" * 50)
    if settings.SUPABASE_URL:
        print(f"\n  Project: {settings.SUPABASE_URL}")
    print("\n  Next steps:")
    print("    1. Test the API:")
    print("         uvicorn api.main:app --reload --port 8000")
    print("         curl http://localhost:8000/health")
    print("")
    print("    2. Frontend: ensure NEXT_PUBLIC_API_URL points at the")
    print("       deployed API host.")
    print("")
    print("    3. (Optional) stop local Postgres:")
    print("         docker-compose stop postgres")
    print("")
    print("    4. Keep .env.local around to fall back to local dev.")
    print("=" * 50)


async def main() -> None:
    print("Parth CPQ — Supabase Migration")
    print("=" * 50)

    await step1_verify_connection()
    step2_run_migrations()
    await step3_seed_data()
    await step4_verify_data()
    step5_print_summary()


if __name__ == "__main__":
    asyncio.run(main())
