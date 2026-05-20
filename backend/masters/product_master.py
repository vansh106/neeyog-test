"""Product master data access — Parth revamp `catalog_*` sheet tables.

Each worksheet from the revamp workbook maps to one table (see `db/sheet_models.py`).
"""

import re
import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import async_session_factory
from db.final_product_models import (
    FINAL_PRODUCT_LABEL_BY_KEY,
    FINAL_PRODUCT_SHEET_MODELS,
    FinalProductSheetMarker,
)
from db.sheet_models import (
    CatalogBracketsCouplerRow,
    CatalogButterflyValveRow,
    CatalogLimitSwitchRow,
    CatalogOperatorRow,
    CatalogPositionerRow,
    CatalogSovRow,
)

INCH_TO_MM: dict[float, float] = {
    0.5: 15.0,
    0.75: 20.0,
    1.0: 25.0,
    1.25: 32.0,
    1.5: 38.0,
    2.0: 51.0,
    2.5: 63.5,
    3.0: 76.0,
    4.0: 102.0,
    5.0: 125.0,
    6.0: 150.0,
    8.0: 200.0,
    10.0: 250.0,
    12.0: 300.0,
    14.0: 350.0,
    16.0: 400.0,
    18.0: 450.0,
    20.0: 500.0,
    24.0: 600.0,
}

SHEET_TABLES: list[tuple[str, type]] = [
    ("butterfly_valve", CatalogButterflyValveRow),
    *FINAL_PRODUCT_SHEET_MODELS,
    ("operator", CatalogOperatorRow),
    ("brackets_coupler", CatalogBracketsCouplerRow),
    ("sov", CatalogSovRow),
    ("limit_switch_box", CatalogLimitSwitchRow),
    ("positioner", CatalogPositionerRow),
]

_KEYWORD_COLUMNS: dict[str, list[str]] = {
    "butterfly_valve": [
        "variant_type",
        "construction",
        "valve_size",
        "end_connection",
        "pressure",
        "body",
        "ball_disc",
        "seat",
        "source_file",
    ],
    "operator": ["operator_for", "construct", "size_text", "model_name"],
    "brackets_coupler": ["bracket_operator", "construct", "size_text"],
    "sov": ["variant_type"],
    "limit_switch_box": ["variant_type"],
    "positioner": ["variant_type"],
}

for _fp_key, _fp_model in FINAL_PRODUCT_SHEET_MODELS:
    _KEYWORD_COLUMNS[_fp_key] = [
        c.key
        for c in _fp_model.__table__.columns
        if c.key
        not in ("row_id", "client_id", "created_at", "updated_at", "sr_no")
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


def _join_parts(*parts: object | None) -> str:
    xs = [str(p).strip() for p in parts if p is not None and str(p).strip()]
    return " ".join(xs)


def _row_to_catalog_item(table_key: str, row: object) -> dict:
    """Convert a catalog ORM row into a unified dict for Masters / matcher."""
    name = "Product"
    size_mm: float | None = None
    size_inch: float | None = None
    material: str | None = None
    pressure_rating: str | None = None
    sub_category: str | None = None

    if isinstance(row, CatalogButterflyValveRow):
        name = _join_parts(row.variant_type, row.construction, row.valve_size) or "Butterfly valve"
        size_mm, size_inch = _parse_size_to_mm_inch(row.valve_size)
        material = _join_parts(
            row.body,
            row.ball_disc,
            getattr(row, "stem", None),
            row.seat,
            getattr(row, "fasteners", None),
        ) or None
        pressure_rating = row.pressure
        sub_category = row.variant_type
    elif isinstance(row, FinalProductSheetMarker):
        name = _join_parts(
            getattr(row, "variant_type", None),
            getattr(row, "construction", None),
            getattr(row, "valve_size", None),
        ) or FINAL_PRODUCT_LABEL_BY_KEY.get(table_key, table_key.replace("_", " ").title())
        size_mm, size_inch = _parse_size_to_mm_inch(getattr(row, "valve_size", None))
        material = _join_parts(
            getattr(row, "body", None),
            getattr(row, "bonnet", None),
            getattr(row, "stem", None),
            getattr(row, "seat", None),
            getattr(row, "ball", None),
            getattr(row, "ball_disc", None),
            getattr(row, "diaphragm", None),
            getattr(row, "wheel_moc", None),
            getattr(row, "actuator_moc", None),
            getattr(row, "tc_od", None),
            getattr(row, "pipe_od", None),
        )
        pressure_rating = (
            getattr(row, "pressure", None)
            or getattr(row, "set_pressure", None)
            or getattr(row, "inlet_pressure", None)
            or getattr(row, "set_pressure_range", None)
        )
        sub_category = getattr(row, "variant_type", None)
    elif isinstance(row, CatalogOperatorRow):
        name = (row.model_name or "").strip() or (row.operator_for or "").strip() or "Operator"
        size_mm, size_inch = _parse_size_to_mm_inch(row.size_text)
        material = _join_parts(row.construct, row.operator_for) or None
        sub_category = row.operator_for
    elif isinstance(row, CatalogBracketsCouplerRow):
        name = _join_parts(row.bracket_operator, row.construct, row.size_text) or "Bracket / coupler"
        size_mm, size_inch = _parse_size_to_mm_inch(row.size_text)
        material = row.construct
        sub_category = row.bracket_operator
    elif isinstance(row, (CatalogSovRow, CatalogLimitSwitchRow, CatalogPositionerRow)):
        name = (row.variant_type or "").strip() or table_key.replace("_", " ").title()
        sub_category = row.variant_type

    unit = "piece"
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
        "sub_category": sub_category,
        "size_mm": size_mm,
        "size_inch": size_inch,
        "pressure_rating": pressure_rating,
        "material": material,
        "base_price": base_price,
        "unit": unit,
        "currency": "INR",
        "is_active": True if price is not None else False,
    }


def _size_patterns(target_mm: float) -> list[str]:
    dn = int(target_mm)
    return [
        f"DN{dn}",
        f"DN {dn}",
        f"{dn} MM",
        f"{dn}MM",
        f'{dn}"',
        f"{dn} inch",
        f"{dn} Inch",
    ]


async def get_all_products(
    client_id: str,
    category: str | None = None,
    active_only: bool = True,
    session: AsyncSession | None = None,
) -> list[dict]:
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
    target_mm = size_mm
    if target_mm is None and size_inch is not None:
        target_mm = INCH_TO_MM.get(size_inch, size_inch * 25.4)

    if target_mm is None:
        return []

    patterns = _size_patterns(target_mm)

    async def _query(s: AsyncSession) -> list[dict]:
        out: list[dict] = []
        for table_key, model in SHEET_TABLES:
            if category and category != table_key:
                continue
            text_cols = []
            if hasattr(model, "valve_size"):
                text_cols.append(getattr(model, "valve_size"))
            if hasattr(model, "size_text"):
                text_cols.append(getattr(model, "size_text"))
            if not text_cols:
                continue
            stmt = select(model).where(model.client_id == client_id)
            conds = []
            for col in text_cols:
                for p in patterns:
                    conds.append(col.ilike(f"%{p}%"))
            stmt = stmt.where(or_(*conds))
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
    pattern = f"%{search_text}%"

    async def _query(s: AsyncSession) -> list[dict]:
        out: list[dict] = []
        for table_key, model in SHEET_TABLES:
            cols = _KEYWORD_COLUMNS.get(table_key, [])
            stmt = select(model).where(model.client_id == client_id)
            ors = []
            for col in cols:
                if hasattr(model, col):
                    ors.append(getattr(model, col).ilike(pattern))
            if not ors:
                continue
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
            f'| Price: ₹{float(p.get("base_price") or 0.0):.2f}/{p.get("unit")} '
            f'| Material: {p.get("material") or "N/A"}'
        )
    return "\n".join(lines)
