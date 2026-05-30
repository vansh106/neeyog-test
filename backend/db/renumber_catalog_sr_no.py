"""Renumber ``sr_no`` to 1..N within each masters sheet (sidebar leaf partition).

Usage (from ``backend/``):
  python -m db.renumber_catalog_sr_no --dry-run
  python -m db.renumber_catalog_sr_no
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import get_settings  # noqa: E402
from core.database import async_session_factory, init_db  # noqa: E402
from db.export_product_masters_snapshot import _build_filters, _load_nav_leaves  # noqa: E402
from services.masters_service import (  # noqa: E402
    MASTERS_HIDDEN_SHEET_KEYS,
    SHEET_MODEL_BY_KEY,
)

logger = logging.getLogger(__name__)


def _row_order(model: type) -> list:
    order_parts = []
    if hasattr(model, "sr_no"):
        order_parts.append(model.sr_no.asc().nulls_last())
    if hasattr(model, "variant_type"):
        order_parts.append(model.variant_type.asc().nulls_last())
    if hasattr(model, "valve_size"):
        order_parts.append(model.valve_size.asc().nulls_last())
    if hasattr(model, "size_mm"):
        order_parts.append(model.size_mm.asc().nulls_last())
    if hasattr(model, "model_name"):
        order_parts.append(model.model_name.asc().nulls_last())
    if hasattr(model, "created_at"):
        order_parts.append(model.created_at.asc())
    return order_parts


async def _renumber_leaf(
    session: Any,
    leaf: dict[str, Any],
    client_id: str,
    *,
    dry_run: bool,
) -> tuple[int, int]:
    sheet = leaf["key"]
    if sheet in MASTERS_HIDDEN_SHEET_KEYS:
        return 0, 0

    model = SHEET_MODEL_BY_KEY.get(sheet)
    if model is None or not hasattr(model, "sr_no"):
        return 0, 0

    filters = [model.client_id == client_id, *_build_filters(leaf)]
    rows = (
        await session.execute(select(model).where(*filters).order_by(*_row_order(model)))
    ).scalars().all()

    changed = 0
    for i, row in enumerate(rows, 1):
        new_sr = float(i)
        if row.sr_no != new_sr:
            changed += 1
            if not dry_run:
                row.sr_no = new_sr
    return len(rows), changed


async def _renumber_whole_table(
    session: Any,
    model: type,
    client_id: str,
    *,
    dry_run: bool,
) -> tuple[int, int]:
    if not hasattr(model, "sr_no"):
        return 0, 0

    rows = (
        await session.execute(
            select(model).where(model.client_id == client_id).order_by(*_row_order(model))
        )
    ).scalars().all()

    changed = 0
    for i, row in enumerate(rows, 1):
        new_sr = float(i)
        if row.sr_no != new_sr:
            changed += 1
            if not dry_run:
                row.sr_no = new_sr
    return len(rows), changed


async def _run(dry_run: bool) -> None:
    leaves = _load_nav_leaves()
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT

    await init_db()
    total_rows = 0
    total_changed = 0
    touched_models: set[type] = set()

    async with async_session_factory() as session:
        for leaf in leaves:
            sheet = leaf["key"]
            model = SHEET_MODEL_BY_KEY.get(sheet)
            if model is not None:
                touched_models.add(model)

            n_rows, n_changed = await _renumber_leaf(session, leaf, client_id, dry_run=dry_run)
            if n_rows == 0:
                continue
            total_rows += n_rows
            total_changed += n_changed
            logger.info(
                "%s / %s: %d rows, %d sr_no updates",
                " / ".join(leaf["path"]),
                leaf["label"],
                n_rows,
                n_changed,
            )

        for model in {m for m in SHEET_MODEL_BY_KEY.values() if hasattr(m, "sr_no")}:
            if model in touched_models:
                continue
            n_rows, n_changed = await _renumber_whole_table(session, model, client_id, dry_run=dry_run)
            if n_rows:
                logger.info("%s (whole table): %d rows, %d sr_no updates", model.__tablename__, n_rows, n_changed)
                total_rows += n_rows
                total_changed += n_changed

        if not dry_run:
            await session.commit()

    logger.info(
        "Done%s: %d row partitions, %d sr_no values updated",
        " (dry run)" if dry_run else "",
        total_rows,
        total_changed,
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    p = argparse.ArgumentParser(description="Renumber catalog sr_no to 1..N per masters sheet")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    asyncio.run(_run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
