"""
Replace butterfly valve master *sheets* in ``catalog_fp_butterfly_all_products``.

Each masters sidebar leaf maps to a ``source_file`` label (see ``butterfly_sheet_constants``).
This script replaces catalog rows for the requested sheets from the replacement workbooks,
preserves Industrial Delval rows, then refreshes supplier list prices.

Usage (from ``backend/``):
  python -m db.import_butterfly_sheet_replacements --dry-run
  python -m db.import_butterfly_sheet_replacements
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import openpyxl
from sqlalchemy import delete, select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import get_settings  # noqa: E402
from core.database import async_session_factory, init_db  # noqa: E402
from db.import_butterfly_supplier_prices_from_replacement import (  # noqa: E402
    ReplacementSource,
    run as run_supplier_price_import,
)
from db.models import SupplierProductPrice  # noqa: E402
from db.sheet_models import CatalogButterflyValveRow  # noqa: E402

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCS_FINAL = REPO_ROOT / "docs" / "Final_Products"
REPLACEMENT_DIR = DOCS_FINAL / "replacement"
COMBINATIONS_FILE = DOCS_FINAL / "Butterfly_Valve_All_Combinations.xlsx"

DELVAL_SOURCE_FILE = "Industrial Butterfly Valve Delval Make.xlsx"


@dataclass(frozen=True)
class SheetReplaceSpec:
    source_file: str
    xlsx_path: Path
    variant_type: str
    supplier_name: str | None = None


def _clean_str(v: object | None) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _normalize_valve_size(v: object | None) -> str | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        if isinstance(v, float) and v.is_integer():
            return f"DN{int(v)}"
        if isinstance(v, int):
            return f"DN{v}"
        s = str(v)
        if "." in s:
            s = s.rstrip("0").rstrip(".")
        return s
    s = str(v).strip()
    if not s:
        return None
    up = s.upper().replace(" ", "")
    if up.startswith("DN"):
        return "DN" + up[2:]
    if s.isdigit():
        return f"DN{int(s)}"
    try:
        fv = float(s.replace(",", ""))
    except ValueError:
        return s
    if fv.is_integer():
        return f"DN{int(fv)}"
    s2 = str(fv)
    if "." in s2:
        s2 = s2.rstrip("0").rstrip(".")
    return s2


def _normalize_end_connection(v: object | None) -> str | None:
    s = _clean_str(v)
    if not s:
        return None
    if s.strip().upper() == "FULL FLANGED":
        return "Flanged"
    return s


def _normalize_construction(variant_type: object | None, construction: object | None) -> str | None:
    v = _clean_str(variant_type)
    c = _clean_str(construction)
    if not c:
        return c
    if v and v.strip().lower() == "industrial butterfly valve":
        if c.strip().upper() == "CENTRIC DESIGN - WAFER TYPE":
            return "Centric Design - Wafer Type with Mounting Lugs"
    return c


def _norm_price_value(raw: object | None) -> float | None:
    if raw is None:
        return None
    try:
        s = str(raw).strip().replace(",", "")
    except Exception:
        return None
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _catalog_natural_key(row: dict[str, Any]) -> tuple:
    return (
        (row.get("variant_type") or "").strip().lower(),
        (row.get("construction") or "").strip().lower(),
        (row.get("valve_size") or "").strip().lower(),
        (row.get("end_connection") or "").strip().lower(),
        (row.get("pressure") or "").strip().lower(),
        (row.get("body") or "").strip().lower(),
        (row.get("ball_disc") or "").strip().lower(),
        (row.get("seat") or "").strip().lower(),
    )


def _parse_catalog_rows_from_xlsx(
    path: Path,
    *,
    source_file: str,
    max_sr_no: int | None = None,
    require_price: bool = False,
) -> list[dict[str, Any]]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        ws = wb[wb.sheetnames[0]]
        rows_iter = ws.iter_rows(min_row=1, values_only=True)
        header = next(rows_iter, ())
        idx = {str(h).strip(): i for i, h in enumerate(header) if h is not None}

        def cell(row: tuple, col: str) -> object | None:
            i = idx.get(col)
            if i is None or i >= len(row):
                return None
            return row[i]

        out: list[dict[str, Any]] = []
        for row in rows_iter:
            if not row or all(v is None or (isinstance(v, str) and not str(v).strip()) for v in row):
                continue

            sr_raw = cell(row, "Sr No")
            sr_no = _norm_price_value(sr_raw)
            if max_sr_no is not None and sr_no is not None and sr_no > max_sr_no:
                continue

            price_raw = cell(row, "Price")
            if require_price and _norm_price_value(price_raw) is None:
                continue

            variant_type = _clean_str(cell(row, "Variant Type"))
            if not variant_type:
                continue

            out.append(
                {
                    "sr_no": sr_no,
                    "variant_type": variant_type,
                    "construction": _normalize_construction(
                        cell(row, "Variant Type"),
                        cell(row, "Construction"),
                    ),
                    "valve_size": _normalize_valve_size(cell(row, "Valve Size")),
                    "end_connection": _normalize_end_connection(cell(row, "End Connection")),
                    "pressure": _clean_str(cell(row, "Pressure")),
                    "body": _clean_str(cell(row, "Body")),
                    "ball_disc": _clean_str(cell(row, "Disc")),
                    "seat": _clean_str(cell(row, "Seat")),
                    "source_file": source_file,
                }
            )
        return out
    finally:
        wb.close()


def _load_delval_rows_from_combinations(omval_keys: set[tuple]) -> list[dict[str, Any]]:
    """Industrial Delval specs = combinations workbook minus Omval replacement specs."""
    if not COMBINATIONS_FILE.is_file():
        raise FileNotFoundError(COMBINATIONS_FILE)

    wb = openpyxl.load_workbook(COMBINATIONS_FILE, read_only=True, data_only=True)
    try:
        ws = wb["All Products"] if "All Products" in wb.sheetnames else wb[wb.sheetnames[0]]
        rows_iter = ws.iter_rows(min_row=1, values_only=True)
        header = next(rows_iter, ())
        idx = {str(h).strip(): i for i, h in enumerate(header) if h is not None}

        def cell(row: tuple, col: str) -> object | None:
            i = idx.get(col)
            if i is None or i >= len(row):
                return None
            return row[i]

        seen: set[tuple] = set()
        out: list[dict[str, Any]] = []
        sr = 0.0
        for row in rows_iter:
            variant_type = _clean_str(cell(row, "Variant Type"))
            if variant_type != "Industrial Butterfly Valve":
                continue
            parsed = {
                "variant_type": variant_type,
                "construction": _normalize_construction(
                    variant_type,
                    cell(row, "Construction"),
                ),
                "valve_size": _normalize_valve_size(cell(row, "Valve Size")),
                "end_connection": _normalize_end_connection(cell(row, "End Connection")),
                "pressure": _clean_str(cell(row, "Pressure")),
                "body": _clean_str(cell(row, "Body")),
                "ball_disc": _clean_str(cell(row, "Disc")),
                "seat": _clean_str(cell(row, "Seat")),
                "source_file": DELVAL_SOURCE_FILE,
            }
            key = _catalog_natural_key(parsed)
            if key in omval_keys or key in seen:
                continue
            seen.add(key)
            sr += 1.0
            parsed["sr_no"] = sr
            out.append(parsed)
        return out
    finally:
        wb.close()


async def _delete_rows_for_source_files(
    db,
    client_id: str,
    source_files: set[str],
) -> tuple[int, int]:
    """Delete catalog rows (and their supplier prices) for the given source_file labels."""
    if not source_files:
        return 0, 0

    row_ids = (
        await db.execute(
            select(CatalogButterflyValveRow.row_id).where(
                CatalogButterflyValveRow.client_id == client_id,
                CatalogButterflyValveRow.source_file.in_(sorted(source_files)),
            )
        )
    ).scalars().all()

    if not row_ids:
        return 0, 0

    price_del = await db.execute(
        delete(SupplierProductPrice).where(
            SupplierProductPrice.catalog_table == "butterfly_valve",
            SupplierProductPrice.catalog_row_id.in_(row_ids),
        )
    )
    cat_del = await db.execute(
        delete(CatalogButterflyValveRow).where(
            CatalogButterflyValveRow.client_id == client_id,
            CatalogButterflyValveRow.source_file.in_(sorted(source_files)),
        )
    )
    return int(cat_del.rowcount or 0), int(price_del.rowcount or 0)


async def _delete_variant_type_rows(db, client_id: str, variant_type: str) -> tuple[int, int]:
    row_ids = (
        await db.execute(
            select(CatalogButterflyValveRow.row_id).where(
                CatalogButterflyValveRow.client_id == client_id,
                CatalogButterflyValveRow.variant_type == variant_type,
            )
        )
    ).scalars().all()
    if not row_ids:
        return 0, 0
    price_del = await db.execute(
        delete(SupplierProductPrice).where(
            SupplierProductPrice.catalog_table == "butterfly_valve",
            SupplierProductPrice.catalog_row_id.in_(row_ids),
        )
    )
    cat_del = await db.execute(
        delete(CatalogButterflyValveRow).where(
            CatalogButterflyValveRow.client_id == client_id,
            CatalogButterflyValveRow.variant_type == variant_type,
        )
    )
    return int(cat_del.rowcount or 0), int(price_del.rowcount or 0)


def _build_replace_specs() -> list[SheetReplaceSpec]:
    return [
        SheetReplaceSpec(
            source_file="Hygienic Butterfly Valve Alfa Laval Make.xlsx",
            xlsx_path=REPLACEMENT_DIR / "Hygienic Butterfly Valve Alfa Laval Make.xlsx",
            variant_type="Hygienic Butterfly Valve",
            supplier_name="Alfa Laval",
        ),
        SheetReplaceSpec(
            source_file="Hygienic Butterfly Valve PVH Make.xlsx",
            xlsx_path=REPLACEMENT_DIR / "Hygienic Butterfly Valve PVH Make.xlsx",
            variant_type="Hygienic Butterfly Valve",
            supplier_name="PVH",
        ),
        SheetReplaceSpec(
            source_file="Aluminium Butterfly Valve PVH Make.xlsx",
            xlsx_path=REPLACEMENT_DIR / "Aluminium Butterfly Valve PVH Make.xlsx",
            variant_type="Aluminium Butterfly Valve",
            supplier_name="PVH",
        ),
        SheetReplaceSpec(
            source_file="Industrial Butterfly Valve Omval Make.xlsx",
            xlsx_path=REPLACEMENT_DIR / "Industrial Butterfly Valve Omval Make.xlsx",
            variant_type="Industrial Butterfly Valve",
            supplier_name="Omval",
        ),
    ]


async def run(*, dry_run: bool) -> None:
    await init_db()
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT
    specs = _build_replace_specs()

    missing = [s.xlsx_path for s in specs if not s.xlsx_path.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing replacement files: {[p.as_posix() for p in missing]}")

    # Parse replacement workbooks.
    parsed_by_source: dict[str, list[dict[str, Any]]] = {}
    for spec in specs:
        max_sr = 18 if "Alfa Laval" in spec.source_file else None
        require_price = max_sr is not None
        rows = _parse_catalog_rows_from_xlsx(
            spec.xlsx_path,
            source_file=spec.source_file,
            max_sr_no=max_sr,
            require_price=require_price,
        )
        parsed_by_source[spec.source_file] = rows
        print(f"Parsed {len(rows)} catalog rows from {spec.xlsx_path.name}")

    omval_keys = {_catalog_natural_key(r) for r in parsed_by_source["Industrial Butterfly Valve Omval Make.xlsx"]}
    delval_rows = _load_delval_rows_from_combinations(omval_keys)
    print(f"Preserving {len(delval_rows)} Industrial Delval catalog rows from combinations workbook")

    if dry_run:
        print("\n[DRY-RUN] Would replace butterfly master sheets:")
        for sf, rows in parsed_by_source.items():
            print(f"  {sf}: {len(rows)} rows")
        print(f"  {DELVAL_SOURCE_FILE}: {len(delval_rows)} rows (unchanged specs, re-tagged)")
        return

    async with async_session_factory() as db:
        # Remove legacy combination rows for variant types we are replacing wholesale.
        for variant_type in (
            "Hygienic Butterfly Valve",
            "Aluminium Butterfly Valve",
        ):
            deleted, prices = await _delete_variant_type_rows(db, client_id, variant_type)
            print(f"Deleted variant_type={variant_type!r}: catalog={deleted} supplier_prices={prices}")

        # Industrial: drop Omval + legacy combination rows; Delval re-inserted below.
        for sf in (
            "Industrial Butterfly Valve Omval Make.xlsx",
            "Butterfly_Valve_All_Combinations.xlsx",
            DELVAL_SOURCE_FILE,
        ):
            deleted, prices = await _delete_rows_for_source_files(db, client_id, {sf})
            if deleted:
                print(f"Deleted source_file={sf!r}: catalog={deleted} supplier_prices={prices}")

        inserted = 0
        for spec in specs:
            for row in parsed_by_source[spec.source_file]:
                db.add(
                    CatalogButterflyValveRow(
                        row_id=uuid.uuid4(),
                        client_id=client_id,
                        **row,
                    )
                )
                inserted += 1

        for row in delval_rows:
            db.add(
                CatalogButterflyValveRow(
                    row_id=uuid.uuid4(),
                    client_id=client_id,
                    **row,
                )
            )
            inserted += 1

        await db.commit()
        print(f"Inserted {inserted} butterfly catalog rows")

    # Refresh supplier list prices for the four replacement suppliers.
    price_sources = [
        ReplacementSource(
            xlsx_path=REPLACEMENT_DIR / "Aluminium Butterfly Valve PVH Make.xlsx",
            supplier_name="PVH",
        ),
        ReplacementSource(
            xlsx_path=REPLACEMENT_DIR / "Hygienic Butterfly Valve Alfa Laval Make.xlsx",
            supplier_name="Alfa Laval",
        ),
        ReplacementSource(
            xlsx_path=REPLACEMENT_DIR / "Hygienic Butterfly Valve PVH Make.xlsx",
            supplier_name="PVH",
        ),
        ReplacementSource(
            xlsx_path=REPLACEMENT_DIR / "Industrial Butterfly Valve Omval Make.xlsx",
            supplier_name="Omval",
        ),
    ]
    await run_supplier_price_import(replacements=price_sources, dry_run=False)


def main() -> None:
    parser = argparse.ArgumentParser(description="Replace butterfly valve master sheets from replacement Excel files")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine.Engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)

    asyncio.run(run(dry_run=bool(args.dry_run)))


if __name__ == "__main__":
    main()
