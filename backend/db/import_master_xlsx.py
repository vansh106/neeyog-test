"""Import the Parth master product list XLSX into the products table.

This importer is designed for the normalized, row-oriented XLSX format where:
- Row 1 is a header row.
- Each subsequent row is a single product/variant with a single price column.

It supports importing multiple worksheets (tabs) in one run.
"""

import argparse
import asyncio
import logging
import re
import sys
import uuid
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from openpyxl import load_workbook  # noqa: E402
from sqlalchemy import delete, select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from core.database import async_session_factory, init_db  # noqa: E402
from db.models import Product  # noqa: E402

logger = logging.getLogger(__name__)


def _norm(s: object | None) -> str:
    if s is None:
        return ""
    return str(s).strip()


def _slug(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def _parse_size_to_mm_inch(size_raw: object | None) -> tuple[float | None, float | None]:
    """Best-effort parse for values like DN100, 15 MM, 1/2", 1 1/4", 2\"."""
    if size_raw is None:
        return None, None

    s = _norm(size_raw)
    if not s:
        return None, None

    up = s.upper().replace("”", '"').replace("″", '"')

    # DN100
    m = re.search(r"\bDN\s*(\d+(?:\.\d+)?)\b", up)
    if m:
        mm = float(m.group(1))
        return mm, None

    # 15 MM
    m = re.search(r"\b(\d+(?:\.\d+)?)\s*MM\b", up)
    if m:
        mm = float(m.group(1))
        return mm, None

    # 1 1/4" or 1/2"
    m = re.search(r"\b(\d+)\s+(\d+)\s*/\s*(\d+)\s*\"\b", up)
    if m:
        whole = float(m.group(1))
        num = float(m.group(2))
        den = float(m.group(3)) if float(m.group(3)) else 1.0
        inch = whole + (num / den)
        return None, inch

    m = re.search(r"\b(\d+)\s*/\s*(\d+)\s*\"\b", up)
    if m:
        num = float(m.group(1))
        den = float(m.group(2)) if float(m.group(2)) else 1.0
        inch = num / den
        return None, inch

    # plain numeric (fallback): treat as mm
    m = re.search(r"(\d+(?:\.\d+)?)", up)
    if m:
        return float(m.group(1)), None

    return None, None


def _map_unit(price_unit_raw: object | None) -> str:
    s = _norm(price_unit_raw).lower()
    if "meter" in s or "metre" in s:
        return "meter"
    if "piece" in s or "pc" in s:
        return "piece"
    return "piece"


def _to_float(val: object | None) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = _norm(val)
    if not s or s in {"-", "–", "—"}:
        return None
    s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def _json_safe(v: object) -> object:
    """Convert common XLSX cell types into JSON-serializable values."""
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, dict):
        return {str(k): _json_safe(val) for k, val in v.items()}
    if isinstance(v, (list, tuple)):
        return [_json_safe(x) for x in v]
    return v


async def _upsert_product(session: AsyncSession, product_data: dict) -> str:
    """Insert or update a product. Returns 'inserted', 'updated', or 'skipped'."""
    with session.no_autoflush:
        stmt = select(Product).where(
            Product.client_id == product_data["client_id"],
            Product.category == product_data["category"],
            Product.name == product_data["name"],
            Product.size_mm == product_data["size_mm"],
            Product.material == product_data["material"],
        )
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

    if existing:
        changed = False
        if existing.base_price != product_data["base_price"]:
            existing.base_price = product_data["base_price"]
            changed = True
        if existing.pricelist_version != product_data["pricelist_version"]:
            existing.pricelist_version = product_data["pricelist_version"]
            changed = True
        existing.raw_specs = product_data.get("raw_specs")
        if changed:
            return "updated"
        return "skipped"

    session.add(Product(id=uuid.uuid4(), **product_data))
    return "inserted"


async def import_master_xlsx(
    file_path: str,
    client_id: str = "parth_valves",
    version: str = "master",
    clear_existing: bool = False,
) -> dict[str, int]:
    wb = load_workbook(file_path, data_only=True, read_only=True)
    counts = {
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
        "deleted": 0,
        "missing_price_imported": 0,
    }

    async with async_session_factory() as session:
        if clear_existing:
            res = await session.execute(delete(Product).where(Product.client_id == client_id))
            counts["deleted"] = int(res.rowcount or 0)
            await session.commit()

        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            rows_iter = ws.iter_rows(min_row=1, values_only=True)
            try:
                headers = [str(h).strip() if h is not None else "" for h in next(rows_iter)]
            except StopIteration:
                continue

            header_map = {h: idx for idx, h in enumerate(headers) if h}

            def get(row: tuple, key: str) -> object | None:
                idx = header_map.get(key)
                if idx is None or idx >= len(row):
                    return None
                return row[idx]

            # Category strategy:
            # - Use worksheet name as stable internal category slug (works with API filter).
            # - Preserve original Category/Sub-Category in raw_specs.
            category_slug = _slug(sheet_name)

            for row in rows_iter:
                if not row or all(v is None or _norm(v) == "" for v in row):
                    continue

                product = _norm(get(row, "Product") or get(row, "Product Name"))
                if not product:
                    counts["errors"] += 1
                    continue

                size_raw = get(row, "Size") or get(row, "Size (as printed)")
                mm, inch = _parse_size_to_mm_inch(size_raw)

                price = _to_float(get(row, "Price (₹)"))
                price_missing = False
                if price is None or price <= 0:
                    # Some rows in the master XLSX intentionally have no price.
                    # We still import them into the master catalog but mark them inactive.
                    price_missing = True
                    price = 0.0

                operator = _norm(get(row, "Operator / Config") or get(row, "Operator / Operation"))
                variant = _norm(get(row, "MOC Variant") or get(row, "Disc MOC Variant") or get(row, "MOC / Variant"))

                # Build a deterministic, human-readable name
                name_parts = [product]
                if operator and operator.upper() not in {"NA", "N/A", "-"}:
                    name_parts.append(operator)
                if size_raw:
                    name_parts.append(_norm(size_raw))
                if variant and variant.upper() not in {"NA", "N/A", "-"}:
                    name_parts.append(variant)
                name = " | ".join(name_parts)

                body = _norm(get(row, "Body Material"))
                seat = _norm(get(row, "Seat Material") or get(row, "Seat"))
                stem = _norm(get(row, "Stem Material") or get(row, "Stem / Spindle"))
                pressure = _norm(get(row, "Pressure Rating"))

                material_parts = []
                if body:
                    material_parts.append(f"Body:{body}")
                if seat:
                    material_parts.append(f"Seat:{seat}")
                if stem:
                    material_parts.append(f"Stem:{stem}")
                if variant:
                    material_parts.append(f"Variant:{variant}")
                material = " / ".join(material_parts) if material_parts else (variant or None)

                raw_specs: dict[str, object] = {
                    "sheet": sheet_name,
                    "pricelist_title": get(row, "Pricelist Title"),
                    "source_category": get(row, "Category"),
                    "source_sub_category": get(row, "Sub-Category"),
                    "end_connection": get(row, "End Connection"),
                    "drilling_std": get(row, "Drilling / Std"),
                    "paint_finish": get(row, "Paint / Finish"),
                    "gst_percent": get(row, "GST %"),
                    "pf_percent": get(row, "P&F %"),
                    "gst_amount": get(row, "GST Amt (₹)"),
                    "pf_amount": get(row, "P&F Amt (₹)"),
                    "effective_price": get(row, "Effective Price (₹)"),
                    "price_date": get(row, "Price Date"),
                    "source_file": get(row, "Source File"),
                    "price_missing": price_missing,
                }
                raw_specs = _json_safe(raw_specs)  # type: ignore[assignment]

                product_data = {
                    "client_id": client_id,
                    "name": name,
                    "category": category_slug,
                    "sub_category": _slug(_norm(get(row, "Sub-Category")) or sheet_name) or None,
                    "size_inch": inch,
                    "size_mm": mm,
                    "pressure_rating": pressure or None,
                    "material": material,
                    "unit": _map_unit(get(row, "Price Unit")),
                    "base_price": round(float(price), 2),
                    "currency": "INR",
                    "pricelist_version": version,
                    "is_active": (not price_missing),
                    "raw_specs": raw_specs,
                }

                try:
                    action = await _upsert_product(session, product_data)
                    counts[action] += 1
                    if price_missing and action in {"inserted", "updated", "skipped"}:
                        counts["missing_price_imported"] += 1
                except Exception as e:
                    logger.warning("Failed to upsert product %s (%s): %s", name, sheet_name, e)
                    counts["errors"] += 1
                    await session.rollback()

        await session.commit()

    wb.close()
    return counts


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Import master product XLSX into products table")
    parser.add_argument("--file", type=str, required=True, help="Path to XLSX file")
    parser.add_argument("--client", type=str, default="parth_valves")
    parser.add_argument("--version", type=str, default="master")
    parser.add_argument(
        "--clear-existing",
        action="store_true",
        help="Delete existing products for the client before importing",
    )
    args = parser.parse_args()

    await init_db()

    xlsx_path = Path(args.file)
    if not xlsx_path.exists():
        raise SystemExit(f"File not found: {xlsx_path}")

    counts = await import_master_xlsx(
        file_path=str(xlsx_path),
        client_id=args.client,
        version=args.version,
        clear_existing=args.clear_existing,
    )

    print(
        f"Deleted {counts['deleted']} existing products. "
        f"Inserted {counts['inserted']}, updated {counts['updated']}, "
        f"skipped {counts['skipped']}, errors {counts['errors']}. "
        f"Missing-price rows imported (inactive): {counts['missing_price_imported']}."
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_main())

