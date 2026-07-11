"""Replace all five Hose Fittings catalog sheets and load PVH supplier prices.

Clears each ``catalog_fp_fittings_*`` table, re-imports from
``docs/Final_Products/replacement/Fittings_Products (1).xlsx``, then upserts
``supplier_product_prices`` for supplier PVH.

Usage (from ``backend/``):
  python -m db.import_fittings_sheet_replacements --dry-run
  python -m db.import_fittings_sheet_replacements
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import uuid
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from sqlalchemy import delete, func, select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import get_settings  # noqa: E402
from core.database import async_session_factory, init_db  # noqa: E402
from db.final_product_models import FINAL_PRODUCT_SHEET_MODELS  # noqa: E402
from db.fittings_sheet_constants import (  # noqa: E402
    FITTINGS_CATALOG_KEYS,
    FITTINGS_REPLACEMENT_FILENAME,
    FITTINGS_REPLACEMENT_SHEETS,
    FITTINGS_SUPPLIER_NAME,
)
from db.import_final_products_catalog import (  # noqa: E402
    DOCS_FINAL,
    _build_header_map,
    _cell_float,
    _cell_str,
    _header_to_field,
)
from db.models import Supplier, SupplierProductPrice  # noqa: E402
from services.pricing_service import match_catalog_row  # noqa: E402

logger = logging.getLogger(__name__)

MODEL_BY_KEY: dict[str, type] = dict(FINAL_PRODUCT_SHEET_MODELS)
REPLACEMENT_PATH = DOCS_FINAL / "replacement" / FITTINGS_REPLACEMENT_FILENAME


def _price_column_index(header_row: tuple[Any, ...]) -> int | None:
    for i, cell in enumerate(header_row):
        if _header_to_field(cell) == "price":
            return i
    return None


def _end_connection_column_index(header_row: tuple[Any, ...]) -> int | None:
    """Replacement workbook uses a single End Connection column (not 1/2)."""
    for i, cell in enumerate(header_row):
        if _header_to_field(cell) == "end_connection":
            return i
    return None


def _apply_fittings_row_fields(
    kwargs: dict[str, Any],
    data_row: tuple[Any, ...],
    idx_map: dict[int, str],
    end_conn_idx: int | None,
) -> bool:
    """Populate ORM kwargs; return False if row is empty."""
    empty = True
    for col_idx, field in idx_map.items():
        if col_idx >= len(data_row):
            continue
        raw = data_row[col_idx]
        if field == "sr_no":
            kwargs[field] = _cell_float(raw)
        else:
            kwargs[field] = _cell_str(raw)
        if field != "sr_no" and kwargs.get(field) not in (None, ""):
            empty = False

    if end_conn_idx is not None and end_conn_idx < len(data_row):
        ec = _cell_str(data_row[end_conn_idx])
        if ec:
            kwargs["end_connection_1"] = ec
            kwargs["end_connection_2"] = ec
            empty = False

    return not empty


def _row_spec_and_price(
    data_row: tuple[Any, ...],
    idx_map: dict[int, str],
    price_idx: int | None,
    end_conn_idx: int | None,
) -> tuple[dict[str, str], float | None]:
    spec: dict[str, str] = {}
    for col_idx, field in idx_map.items():
        if col_idx >= len(data_row):
            continue
        raw = data_row[col_idx]
        if field == "sr_no":
            continue
        s = _cell_str(raw)
        if s:
            spec[field] = s

    if end_conn_idx is not None and end_conn_idx < len(data_row):
        ec = _cell_str(data_row[end_conn_idx])
        if ec:
            spec["end_connection_1"] = ec
            spec["end_connection_2"] = ec

    price: float | None = None
    if price_idx is not None and price_idx < len(data_row):
        price = _cell_float(data_row[price_idx])
    return spec, price


async def _find_supplier(session: Any, client_id: str, name_hint: str) -> Supplier | None:
    hint = name_hint.strip().lower()
    result = await session.execute(
        select(Supplier).where(
            Supplier.client_id == client_id,
            Supplier.is_active.is_(True),
            func.lower(Supplier.name) == hint,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        return row
    result = await session.execute(
        select(Supplier).where(
            Supplier.client_id == client_id,
            Supplier.is_active.is_(True),
            func.lower(Supplier.name).contains(hint),
        )
    )
    return result.scalars().first()


async def _run(dry_run: bool) -> None:
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT
    if not REPLACEMENT_PATH.is_file():
        raise FileNotFoundError(f"Missing workbook: {REPLACEMENT_PATH}")

    if dry_run:
        wb = load_workbook(REPLACEMENT_PATH, read_only=True, data_only=True)
        logger.info("Dry run — would replace fittings catalog + PVH prices for client_id=%s", client_id)
        for sheet_name, catalog_key in FITTINGS_REPLACEMENT_SHEETS:
            model = MODEL_BY_KEY.get(catalog_key)
            if sheet_name not in wb.sheetnames:
                logger.warning("  missing sheet %r", sheet_name)
                continue
            ws = wb[sheet_name]
            header = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), ())
            price_ix = _price_column_index(header)
            end_ix = _end_connection_column_index(header)
            idx_map = _build_header_map(header, model) if model else {}
            n = 0
            priced = 0
            for data_row in ws.iter_rows(min_row=2, values_only=True):
                if not data_row or not any(c is not None and str(c).strip() != "" for c in data_row):
                    continue
                n += 1
                if price_ix is not None and price_ix < len(data_row) and _cell_float(data_row[price_ix]) is not None:
                    priced += 1
            logger.info(
                "  %s -> %s supplier=%s rows=%d priced=%d end_conn_col=%s",
                sheet_name,
                catalog_key,
                FITTINGS_SUPPLIER_NAME,
                n,
                priced,
                end_ix,
            )
        wb.close()
        return

    await init_db()
    async with async_session_factory() as session:
        supplier = await _find_supplier(session, client_id, FITTINGS_SUPPLIER_NAME)
        if supplier is None:
            raise RuntimeError(
                f"No active supplier matching {FITTINGS_SUPPLIER_NAME!r} for client {client_id}. "
                "Create the supplier in Masters first."
            )
        logger.info("Using supplier %s (%s)", supplier.name, supplier.id)

        fittings_models = [MODEL_BY_KEY[k] for k in FITTINGS_CATALOG_KEYS if k in MODEL_BY_KEY]
        for model in fittings_models:
            await session.execute(delete(model).where(model.client_id == client_id))
        await session.execute(
            delete(SupplierProductPrice).where(
                SupplierProductPrice.catalog_table.in_(sorted(FITTINGS_CATALOG_KEYS)),
            )
        )
        await session.flush()

        wb = load_workbook(REPLACEMENT_PATH, read_only=True, data_only=True)
        catalog_counts: dict[str, int] = {}
        price_stats = {"created": 0, "updated": 0, "unmatched": 0, "no_price": 0}

        for sheet_name, catalog_key in FITTINGS_REPLACEMENT_SHEETS:
            model = MODEL_BY_KEY.get(catalog_key)
            if model is None:
                raise ValueError(f"Unknown catalog_key: {catalog_key}")
            if sheet_name not in wb.sheetnames:
                raise ValueError(
                    f"Sheet {sheet_name!r} not in {REPLACEMENT_PATH.name}; have: {wb.sheetnames}"
                )

            ws = wb[sheet_name]
            rows_iter = ws.iter_rows(values_only=True)
            header_row = next(rows_iter, ())
            idx_map = _build_header_map(header_row, model)
            price_idx = _price_column_index(header_row)
            end_conn_idx = _end_connection_column_index(header_row)
            if not idx_map:
                raise ValueError(f"No mappable headers for sheet {sheet_name!r}")

            sheet_rows: list[tuple[Any, ...]] = []
            n_cat = 0
            for data_row in rows_iter:
                if not data_row or not any(c is not None and str(c).strip() != "" for c in data_row):
                    continue
                kwargs: dict[str, Any] = {
                    "row_id": uuid.uuid4(),
                    "client_id": client_id,
                    "source_file": FITTINGS_REPLACEMENT_FILENAME,
                }
                if not _apply_fittings_row_fields(kwargs, data_row, idx_map, end_conn_idx):
                    continue
                session.add(model(**kwargs))
                sheet_rows.append(data_row)
                n_cat += 1

            await session.flush()

            for data_row in sheet_rows:
                spec, price_f = _row_spec_and_price(data_row, idx_map, price_idx, end_conn_idx)
                if price_f is None:
                    price_stats["no_price"] += 1
                    continue
                rid, reason = await match_catalog_row(catalog_key, spec, session)
                if rid is None:
                    price_stats["unmatched"] += 1
                    logger.warning("Price unmatched %s (%s): %s", catalog_key, reason, spec)
                    continue

                result = await session.execute(
                    select(SupplierProductPrice).where(
                        SupplierProductPrice.supplier_id == supplier.id,
                        SupplierProductPrice.catalog_table == catalog_key,
                        SupplierProductPrice.catalog_row_id == uuid.UUID(rid),
                    )
                )
                existing = result.scalar_one_or_none()
                if existing:
                    existing.list_price_inr = float(price_f)
                    price_stats["updated"] += 1
                else:
                    session.add(
                        SupplierProductPrice(
                            supplier_id=supplier.id,
                            catalog_table=catalog_key,
                            catalog_row_id=uuid.UUID(rid),
                            list_price_inr=float(price_f),
                            discount_pct_override=None,
                        )
                    )
                    price_stats["created"] += 1

            catalog_counts[catalog_key] = n_cat
            logger.info(
                "Imported %d catalog rows -> %s (%s, supplier=%s)",
                n_cat,
                model.__tablename__,
                sheet_name,
                supplier.name,
            )

        wb.close()
        await session.commit()

        logger.info("Catalog sheets: %s", catalog_counts)
        logger.info(
            "Fittings PVH prices: created=%d updated=%d unmatched=%d no_price=%d",
            price_stats["created"],
            price_stats["updated"],
            price_stats["unmatched"],
            price_stats["no_price"],
        )


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    p = argparse.ArgumentParser(description="Replace Hose Fittings masters from replacement workbook")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    asyncio.run(_run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
