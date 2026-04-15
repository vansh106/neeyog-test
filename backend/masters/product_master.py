"""Product master data access and helpers (Option B).

The catalog is stored in per-sheet tables (see `db/sheet_models.py`) rather than a
single `products` table. This module provides cross-table search helpers and a
formatter for passing catalog rows to the Matcher agent.
"""

import uuid
import re

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import async_session_factory
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

INCH_TO_MM: dict[float, float] = {
    0.5: 15.0, 0.75: 20.0, 1.0: 25.0, 1.25: 32.0, 1.5: 38.0,
    2.0: 51.0, 2.5: 63.5, 3.0: 76.0, 4.0: 102.0, 5.0: 125.0,
    6.0: 150.0, 8.0: 200.0, 10.0: 250.0, 12.0: 300.0, 14.0: 350.0,
    16.0: 400.0, 18.0: 450.0, 20.0: 500.0, 24.0: 600.0,
}

SHEET_TABLES: list[tuple[str, type]] = [
    ("butterfly_valve", ButterflyValveRow),
    ("ball_valve", BallValveRow),
    ("diaphragm_valve", DiaphragmValveRow),
    ("nvr", NvrRow),
    ("hoses", HosesRow),
    ("speciality_valve", SpecialityValveRow),
    ("sight_glass", SightGlassRow),
    ("strainer", StrainerRow),
]


def _parse_size_to_mm_inch(size_raw: object | None) -> tuple[float | None, float | None]:
    if size_raw is None:
        return None, None
    s = str(size_raw).strip().replace("”", '"').replace("″", '"')
    if not s:
        return None, None

    up = s.upper()

    m = re.search(r"\bDN\s*(\d+(?:\.\d+)?)\b", up)
    if m:
        return float(m.group(1)), None

    m = re.search(r"\b(\d+(?:\.\d+)?)\s*MM\b", up)
    if m:
        return float(m.group(1)), None

    m = re.search(r"\b(\d+)\s+(\d+)\s*/\s*(\d+)\s*\"\b", up)
    if m:
        whole = float(m.group(1))
        num = float(m.group(2))
        den = float(m.group(3)) if float(m.group(3)) else 1.0
        return None, whole + (num / den)

    m = re.search(r"\b(\d+)\s*/\s*(\d+)\s*\"\b", up)
    if m:
        num = float(m.group(1))
        den = float(m.group(2)) if float(m.group(2)) else 1.0
        return None, num / den

    return None, None


def _row_to_catalog_item(table_key: str, row: object) -> dict:
    """Convert a sheet ORM row into a unified dict used by the matcher."""
    if isinstance(row, HosesRow):
        name = (row.product_name or "").strip() or "Hose"
        size_mm = row.id_mm
        size_inch = row.id_inch
        material = row.moc_variant
    else:
        name = (getattr(row, "product", None) or "").strip() or "Product"
        size_mm, size_inch = _parse_size_to_mm_inch(getattr(row, "size", None))
        material = " / ".join(
            [x for x in [
                getattr(row, "body_material", None),
                getattr(row, "seat_material", None),
                getattr(row, "stem_material", None),
                getattr(row, "moc_variant", None),
                getattr(row, "disc_moc_variant", None),
            ] if x]
        ) or None

    unit_raw = getattr(row, "price_unit", None) or "piece"
    unit = "meter" if "meter" in str(unit_raw).lower() else "piece"

    price = getattr(row, "price_inr", None)
    try:
        base_price = float(price) if price is not None else 0.0
    except Exception:
        base_price = 0.0

    return {
        "id": f"{table_key}:{getattr(row, 'row_id')}",
        "table": table_key,
        "name": name,
        "category": table_key,
        "sub_category": getattr(row, "sub_category", None),
        "size_mm": size_mm,
        "size_inch": size_inch,
        "pressure_rating": getattr(row, "pressure_rating", None),
        "material": material,
        "base_price": base_price,
        "unit": unit,
        "currency": "INR",
        "is_active": True if price is not None else False,
    }


async def get_all_products(
    client_id: str,
    category: str | None = None,
    active_only: bool = True,
    session: AsyncSession | None = None,
) -> list[dict]:
    """Return catalog items across all sheet tables for a client."""
    async def _query(s: AsyncSession) -> list[dict]:
        out: list[dict] = []
        for table_key, model in SHEET_TABLES:
            if category and category != table_key:
                continue
            stmt = select(model).where(model.client_id == client_id)
            if active_only and hasattr(model, "price_inr"):
                stmt = stmt.where(model.price_inr.is_not(None))
            result = await s.execute(stmt)
            rows = list(result.scalars().all())
            out.extend([_row_to_catalog_item(table_key, r) for r in rows])
        return out

    if session:
        return await _query(session)
    async with async_session_factory() as s:
        return await _query(s)


async def get_product_by_id(
    product_id: str | uuid.UUID,
    session: AsyncSession | None = None,
) -> dict | None:
    """Retrieve a single catalog item by composite id: '<table>:<uuid>'."""
    if isinstance(product_id, uuid.UUID):
        return None
    if ":" not in product_id:
        return None
    table_key, uid = product_id.split(":", 1)
    try:
        row_uuid = uuid.UUID(uid)
    except ValueError:
        return None

    model = next((m for k, m in SHEET_TABLES if k == table_key), None)
    if model is None:
        return None

    async def _query(s: AsyncSession) -> dict | None:
        result = await s.execute(select(model).where(model.row_id == row_uuid))
        row = result.scalar_one_or_none()
        return _row_to_catalog_item(table_key, row) if row else None

    if session:
        return await _query(session)
    async with async_session_factory() as s:
        return await _query(s)


async def search_products_by_size(
    client_id: str,
    category: str | None = None,
    size_mm: float | None = None,
    size_inch: float | None = None,
    session: AsyncSession | None = None,
) -> list[dict]:
    """Return catalog items matching a given size (best-effort across tables)."""
    target_mm = size_mm
    if target_mm is None and size_inch is not None:
        target_mm = INCH_TO_MM.get(size_inch, size_inch * 25.4)

    if target_mm is None:
        return []

    async def _query(s: AsyncSession) -> list[dict]:
        out: list[dict] = []
        for table_key, model in SHEET_TABLES:
            if category and category != table_key:
                continue
            if model is HosesRow:
                stmt = select(model).where(
                    model.client_id == client_id,
                    model.id_mm == target_mm,
                )
            else:
                # Most sheets store size as text; we approximate by matching common encodings.
                # e.g. DN100, 100 MM
                patterns = [f"DN{int(target_mm)}", f"{int(target_mm)} MM", f"{int(target_mm)}MM"]
                stmt = select(model).where(model.client_id == client_id)
                stmt = stmt.where(or_(*[model.size.ilike(f"%{p}%") for p in patterns if hasattr(model, "size")]))

            result = await s.execute(stmt)
            rows = list(result.scalars().all())
            out.extend([_row_to_catalog_item(table_key, r) for r in rows])
        return out

    if session:
        return await _query(session)
    async with async_session_factory() as s:
        return await _query(s)


async def search_products_keyword(
    client_id: str,
    search_text: str,
    session: AsyncSession | None = None,
) -> list[dict]:
    """ILIKE search across key text columns in all sheet tables."""
    pattern = f"%{search_text}%"

    async def _query(s: AsyncSession) -> list[dict]:
        out: list[dict] = []
        for table_key, model in SHEET_TABLES:
            stmt = select(model).where(model.client_id == client_id)
            ors = []
            for col in ["product", "product_name", "sub_category", "category", "moc_variant", "disc_moc_variant", "body_material"]:
                if hasattr(model, col):
                    ors.append(getattr(model, col).ilike(pattern))
            if ors:
                stmt = stmt.where(or_(*ors))
            result = await s.execute(stmt)
            rows = list(result.scalars().all())
            out.extend([_row_to_catalog_item(table_key, r) for r in rows])
        return out

    if session:
        return await _query(session)
    async with async_session_factory() as s:
        return await _query(s)


def format_products_for_agent(products: list[dict]) -> str:
    """Format a product list as a clean string for the Matcher agent's user prompt."""
    if not products:
        return "No products found in catalog."

    lines = []
    for p in products:
        size_str = ""
        if p.get("size_inch") and p.get("size_mm"):
            size_str = f'{p["size_inch"]}" ({p["size_mm"]}mm)'
        elif p.get("size_mm"):
            size_str = f'{p["size_mm"]}mm'
        elif p.get("size_inch"):
            size_str = f'{p["size_inch"]}"'

        lines.append(
            f'ID: {p.get("id")} | {p.get("name")} | Size: {size_str} '
            f'| Price: \u20b9{float(p.get("base_price") or 0.0):.2f}/{p.get("unit")} '
            f'| Material: {p.get("material") or "N/A"}'
        )
    return "\n".join(lines)
