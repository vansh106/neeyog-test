"""Masters business logic — product and client data operations.

This service knows nothing about HTTP. It raises custom exceptions
from core.exceptions which controllers translate into HTTP responses.
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from core.config import get_settings
from core.exceptions import ProductNotFoundError
from masters.product_master import _parse_size_to_mm_inch, get_all_products, get_product_by_id
from services.client_service import get_dummy_clients, search_companies
from db.sheet_models import (
    CatalogBallValveRow,
    CatalogBracketsCouplerRow,
    CatalogButterflyValveRow,
    CatalogLimitSwitchRow,
    CatalogOperatorRow,
    CatalogPositionerRow,
    CatalogSovRow,
)


SHEET_MODEL_BY_KEY: dict[str, type] = {
    "butterfly_valve": CatalogButterflyValveRow,
    "ball_valve": CatalogBallValveRow,
    "operator": CatalogOperatorRow,
    "brackets_coupler": CatalogBracketsCouplerRow,
    "sov": CatalogSovRow,
    "limit_switch_box": CatalogLimitSwitchRow,
    "positioner": CatalogPositionerRow,
}

# Human-readable names for manual entry / masters UI (keys stay stable for APIs).
CATEGORY_LABEL_BY_KEY: dict[str, str] = {
    "ball_valve": "Ball valve",
    "butterfly_valve": "Butterfly valve",
    "operator": "Operator",
    "brackets_coupler": "Brackets and couplers",
    "sov": "SOV",
    "limit_switch_box": "Limit switch box",
    "positioner": "Positioner",
}

# Distinct-value column used like a sub-category in the Masters UI.
_SUBCATEGORY_FIELD: dict[str, str] = {
    "butterfly_valve": "variant_type",
    "ball_valve": "variant_type",
    "operator": "operator_for",
    "brackets_coupler": "bracket_operator",
    "sov": "variant_type",
    "limit_switch_box": "variant_type",
    "positioner": "variant_type",
}


def _category_label(key: str) -> str:
    return CATEGORY_LABEL_BY_KEY.get(key, key.replace("_", " ").title())


# Ordered cascade fields per sheet (DB column names). Manual entry narrows row-by-row.
CASCADE_STEPS: dict[str, list[str]] = {
    "butterfly_valve": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "pressure",
        "body",
        "ball_disc",
        "stem",
        "seat",
        "fasteners",
    ],
    "ball_valve": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "pressure",
        "body",
        "ball",
        "stem",
        "seat",
        "fasteners",
    ],
    "operator": ["operator_for", "construct", "size_text", "model_name"],
    "brackets_coupler": ["bracket_operator", "construct", "size_text"],
    "sov": ["variant_type"],
    "limit_switch_box": ["variant_type"],
    "positioner": ["variant_type"],
}


def _column_label(field: str) -> str:
    return field.replace("_", " ").title()


def get_cascade_schema(category: str) -> list[dict[str, str]]:
    """Static ordered steps for a catalog sheet key (no DB)."""
    steps = CASCADE_STEPS.get(category, [])
    return [{"key": s, "label": _column_label(s)} for s in steps]


def _cascade_prior_keys(category: str, field: str) -> list[str]:
    steps = CASCADE_STEPS.get(category, [])
    if field not in steps:
        return []
    idx = steps.index(field)
    return steps[:idx]


def _sanitize_cascade_filters(category: str, filters: dict[str, str], allowed_keys: set[str] | None = None) -> dict[str, str]:
    steps = set(CASCADE_STEPS.get(category, []))
    out: dict[str, str] = {}
    for k, v in (filters or {}).items():
        if k not in steps:
            continue
        if allowed_keys is not None and k not in allowed_keys:
            continue
        if v is None or not str(v).strip():
            continue
        out[k] = str(v).strip()
    return out


def _normalize_distinct_cell(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, float):
        s = str(int(v)) if v == int(v) else str(v).rstrip("0").rstrip(".") if "." in str(v) else str(v)
    else:
        s = str(v).strip()
    if not s:
        return None
    low = s.lower()
    if low in ("na", "n/a", "-", "—", "none", "null", "__none__"):
        return None
    return s


async def get_clients_for_dropdown(search: str | None, db: AsyncSession) -> list[dict]:
    """Client dropdown options (DB branches + dummy). Each row id is a branch UUID for FK linking."""
    settings = get_settings()
    companies = await search_companies(settings.ACTIVE_CLIENT, search, db, limit=50)
    db_clients: list[dict] = []
    for c in companies:
        active_branches = [b for b in (c.branches or []) if b.is_active]
        n_br = len(active_branches)
        for b in active_branches:
            label = c.company_name if n_br <= 1 else f"{c.company_name} — {b.branch_name}"
            db_clients.append(
                {
                    "id": str(b.id),
                    "company_name": label,
                    "contact_name": b.contact_name or "",
                    "email": b.email or "",
                    "phone": b.phone or "",
                    "city": b.city or "",
                    "erp_code": c.erp_code or "",
                    "source": "db",
                }
            )

    all_clients: list[dict] = db_clients + [{**d, "source": "dummy"} for d in get_dummy_clients()]

    if search:
        s2 = search.lower()
        all_clients = [
            c
            for c in all_clients
            if s2 in (c.get("company_name") or "").lower()
            or s2 in (c.get("contact_name") or "").lower()
        ]

    return all_clients


async def get_product_categories(db: AsyncSession) -> list[dict[str, str | int]]:
    """Categories backed by per-sheet product tables for the active client.

    Returns sheets that have at least one row. If none have data yet, returns
    the full catalog with zero counts so the UI can still offer choices.
    """
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT

    keyed: list[tuple[str, int]] = []
    for key, model in SHEET_MODEL_BY_KEY.items():
        total = (
            await db.execute(
                select(func.count()).select_from(model).where(model.client_id == client_id)
            )
        ).scalar_one()
        n = int(total or 0)
        keyed.append((key, n))

    with_products = [(k, n) for k, n in keyed if n > 0]
    use = with_products if with_products else keyed

    out: list[dict[str, str | int]] = [
        {"key": k, "label": _category_label(k), "count": n}
        for k, n in sorted(use, key=lambda t: _category_label(t[0]).lower())
    ]
    return out


async def get_product_subcategories(category: str, db: AsyncSession) -> list[str]:
    model = SHEET_MODEL_BY_KEY.get(category)
    if model is None:
        return []
    field = _SUBCATEGORY_FIELD.get(category)
    if not field or not hasattr(model, field):
        return []
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT
    col = getattr(model, field)
    result = await db.execute(
        select(func.distinct(col)).where(model.client_id == client_id, col.is_not(None)).order_by(col)
    )
    return [r[0] for r in result.all() if r[0]]


def _format_size_label(name: str, size_inch: float | None, size_mm: float | None, material: str, price: float, unit: str) -> str:
    parts: list[str] = []
    if size_inch:
        parts.append(f'{size_inch}"')
    if size_mm:
        parts.append(f"({size_mm:.0f}mm)")
    if material:
        parts.append(f"— {material}")
    parts.append(f"— ₹{price:,.0f}/{unit}")
    return " ".join(parts).strip()


def catalog_row_to_size_option(category: str, row: object) -> dict:
    """Build manual-entry / matcher line dict from a sheet ORM row."""
    name = ""
    size_mm: float | None = None
    size_inch: float | None = None
    material = ""

    if isinstance(row, CatalogButterflyValveRow):
        name = " ".join(
            x
            for x in [
                (row.variant_type or "").strip(),
                (row.construction or "").strip(),
                (row.valve_size or "").strip(),
            ]
            if x
        )
        size_mm, size_inch = _parse_size_to_mm_inch(row.valve_size)
        material = " / ".join(
            x
            for x in [row.body, row.ball_disc, row.stem, row.seat, row.fasteners]
            if x
        )
    elif isinstance(row, CatalogBallValveRow):
        name = " ".join(
            x
            for x in [
                (row.variant_type or "").strip(),
                (row.construction or "").strip(),
                (row.valve_size or "").strip(),
            ]
            if x
        )
        size_mm, size_inch = _parse_size_to_mm_inch(row.valve_size)
        material = " / ".join(x for x in [row.body, row.ball, row.stem, row.seat, row.fasteners] if x)
    elif isinstance(row, CatalogOperatorRow):
        name = ((row.model_name or "").strip() or (row.operator_for or "").strip() or "Operator")
        size_mm, size_inch = _parse_size_to_mm_inch(row.size_text)
        material = " / ".join(x for x in [row.construct, row.operator_for] if x)
    elif isinstance(row, CatalogBracketsCouplerRow):
        name = " ".join(
            x
            for x in [
                (row.bracket_operator or "").strip(),
                (row.construct or "").strip(),
                (row.size_text or "").strip(),
            ]
            if x
        )
        size_mm, size_inch = _parse_size_to_mm_inch(row.size_text)
        material = (row.construct or "").strip()
    elif isinstance(row, (CatalogSovRow, CatalogLimitSwitchRow, CatalogPositionerRow)):
        name = (row.variant_type or "").strip() or category.replace("_", " ").title()

    price = float(getattr(row, "price_inr", None) or 0.0)
    unit = "piece"
    nm = name or "Product"
    return {
        "id": f"{category}:{getattr(row, 'row_id')}",
        "name": nm,
        "size_inch": size_inch,
        "size_mm": size_mm,
        "material": material or "",
        "base_price": price,
        "unit": unit,
        "display_label": _format_size_label(nm, size_inch, size_mm, material or "", price, unit),
    }


async def get_cascade_distinct_field_values(
    category: str, field: str, filters: dict[str, str], db: AsyncSession
) -> list[str]:
    """Distinct non-empty values for one cascade column given prior selections."""
    model = SHEET_MODEL_BY_KEY.get(category)
    steps = CASCADE_STEPS.get(category, [])
    if model is None or field not in steps or not hasattr(model, field):
        return []
    allowed = set(_cascade_prior_keys(category, field))
    fdict = _sanitize_cascade_filters(category, filters, allowed_keys=allowed)
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT
    col = getattr(model, field)
    stmt = select(func.distinct(col)).where(model.client_id == client_id)
    for k, v in fdict.items():
        stmt = stmt.where(getattr(model, k) == v)
    stmt = stmt.order_by(col)
    result = await db.execute(stmt)
    out: list[str] = []
    seen: set[str] = set()
    for (cell,) in result.all():
        if _normalize_distinct_cell(cell) is None:
            continue
        if isinstance(cell, str):
            s = cell.strip()
        elif isinstance(cell, (int, float)):
            s = str(int(cell)) if isinstance(cell, float) and float(cell) == int(float(cell)) else str(cell)
        else:
            s = str(cell).strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    out.sort(key=str.lower)
    return out


async def get_cascade_matching_products(category: str, filters: dict[str, str], db: AsyncSession) -> list[dict]:
    """All catalog rows matching the current cascade filters (may be 0, 1, or many)."""
    model = SHEET_MODEL_BY_KEY.get(category)
    if model is None:
        return []
    fdict = _sanitize_cascade_filters(category, filters)
    if not fdict:
        return []
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT
    q = select(model).where(model.client_id == client_id)
    for k, v in fdict.items():
        if not hasattr(model, k):
            continue
        col = getattr(model, k)
        try:
            num = float(v)
            if hasattr(col, "type") and "Float" in type(col.type).__name__:
                q = q.where(col == num)
                continue
        except ValueError:
            pass
        q = q.where(col == v)
    if hasattr(model, "valve_size"):
        q = q.order_by(model.valve_size)
    elif hasattr(model, "size_text"):
        q = q.order_by(model.size_text)
    elif hasattr(model, "variant_type"):
        q = q.order_by(model.variant_type)
    elif hasattr(model, "model_name"):
        q = q.order_by(model.model_name)
    rows = (await db.execute(q)).scalars().all()
    return [catalog_row_to_size_option(category, r) for r in rows]


async def get_cascade_matching_rows(
    category: str,
    filters: dict[str, str],
    db: AsyncSession,
    *,
    limit: int = 200,
) -> dict:
    """Raw catalog rows matching current cascade filters (for Masters editing)."""
    model = SHEET_MODEL_BY_KEY.get(category)
    if model is None:
        return {"category": category, "columns": [], "items": []}

    fdict = _sanitize_cascade_filters(category, filters)
    if not fdict:
        return {"category": category, "columns": list(model.__table__.columns.keys()), "items": []}

    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT
    limit = min(max(1, int(limit or 200)), 500)

    q = select(model).where(model.client_id == client_id)
    for k, v in fdict.items():
        if not hasattr(model, k):
            continue
        q = q.where(getattr(model, k) == v)

    # Keep the rows stable and easy to scan.
    if hasattr(model, "valve_size"):
        q = q.order_by(model.valve_size.asc().nulls_last())
    elif hasattr(model, "size_text"):
        q = q.order_by(model.size_text.asc().nulls_last())
    elif hasattr(model, "variant_type"):
        q = q.order_by(model.variant_type.asc().nulls_last())
    elif hasattr(model, "model_name"):
        q = q.order_by(model.model_name.asc().nulls_last())
    q = q.limit(limit)

    rows = (await db.execute(q)).scalars().all()
    columns = list(model.__table__.columns.keys())
    items: list[dict] = []
    for r in rows:
        items.append({c: _jsonable(getattr(r, c)) for c in columns})

    return {"category": category, "columns": columns, "items": items}


async def get_full_category_catalog(category: str, db: AsyncSession) -> list[dict[str, Any]]:
    """Return every catalog row for a category as JSON-serializable dicts.

    Used for client-side cascade filtering in the Masters editor (one fetch
    per category per browser session on the frontend).
    """
    model = SHEET_MODEL_BY_KEY.get(category)
    if model is None:
        return []

    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT

    q = select(model).where(model.client_id == client_id)
    if hasattr(model, "valve_size"):
        q = q.order_by(model.valve_size.asc().nulls_last())
    elif hasattr(model, "size_text"):
        q = q.order_by(model.size_text.asc().nulls_last())
    elif hasattr(model, "variant_type"):
        q = q.order_by(model.variant_type.asc().nulls_last())
    elif hasattr(model, "model_name"):
        q = q.order_by(model.model_name.asc().nulls_last())
    else:
        q = q.order_by(model.row_id)

    rows = (await db.execute(q)).scalars().all()
    columns = list(model.__table__.columns.keys())
    return [{c: _jsonable(getattr(r, c)) for c in columns} for r in rows]


async def update_catalog_row_price(
    category: str,
    row_id: str,
    price_inr: float | None,
    db: AsyncSession,
) -> dict:
    raise ValueError("price_inr is no longer supported; pricing is supplier-specific")

async def get_products_for_size_dropdown(category: str, subcategory: str | None, db: AsyncSession) -> list[dict]:
    """Return products for size dropdown from sheet tables."""
    model = SHEET_MODEL_BY_KEY.get(category)
    if model is None:
        return []
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT

    q = select(model).where(model.client_id == client_id)
    sub_field = _SUBCATEGORY_FIELD.get(category)
    if subcategory and sub_field and hasattr(model, sub_field):
        q = q.where(getattr(model, sub_field) == subcategory)
    if hasattr(model, "valve_size"):
        q = q.order_by(model.valve_size)
    elif hasattr(model, "size_text"):
        q = q.order_by(model.size_text)
    elif hasattr(model, "variant_type"):
        q = q.order_by(model.variant_type)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [catalog_row_to_size_option(category, r) for r in rows]


async def get_product_materials(category: str, db: AsyncSession) -> list[str]:
    """Distinct material-like values for the given sheet."""
    model = SHEET_MODEL_BY_KEY.get(category)
    if model is None:
        return []
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT

    cols = []
    for c in [
        "body",
        "ball_disc",
        "ball",
        "stem",
        "seat",
        "fasteners",
        "construct",
        "operator_for",
        "bracket_operator",
        "variant_type",
    ]:
        if hasattr(model, c):
            cols.append(getattr(model, c))
    if not cols:
        return []
    # Distinct over a coalesce of the first available column (simple but useful for dropdown)
    col = cols[0]
    result = await db.execute(
        select(func.distinct(col)).where(model.client_id == client_id, col.is_not(None)).order_by(col)
    )
    return [r[0] for r in result.all() if r[0]]


def _jsonable(v: Any) -> Any:
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return v


async def list_products(
    db: AsyncSession,
    category: str | None = None,
    skip: int = 0,
    limit: int = 500,
) -> list[dict]:
    """List products for the active client with optional category filter."""
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT
    # NOTE: db parameter is kept for interface consistency, but queries are performed
    # via the product master helper which manages its own sessions by default.
    limit = min(max(1, limit), 500)
    skip = max(0, skip)

    # If the UI requests a specific category, return that category only.
    if category:
        items = await get_all_products(client_id=client_id, category=category, active_only=False)
        return items[skip : skip + limit]

    # Otherwise, return a "balanced" first page across categories so the Masters UI
    # immediately sees all categories (not only the biggest one).
    categories = [
        "butterfly_valve",
        "ball_valve",
        "operator",
        "brackets_coupler",
        "sov",
        "limit_switch_box",
        "positioner",
    ]
    per_cat = max(1, limit // max(1, len(categories)))
    combined: list[dict] = []
    for cat in categories:
        rows = await get_all_products(client_id=client_id, category=cat, active_only=False)
        combined.extend(rows[:per_cat])

    # If we still have room (due to small categories), top up from the full catalog.
    if len(combined) < limit:
        all_rows = await get_all_products(client_id=client_id, category=None, active_only=False)
        seen = {r.get("id") for r in combined}
        for r in all_rows:
            rid = r.get("id")
            if rid in seen:
                continue
            combined.append(r)
            if len(combined) >= limit:
                break

    return combined[:limit]


async def get_product(product_id: str, db: AsyncSession) -> dict:
    """Retrieve a single product by ID for the active client."""
    # New id format: '<table>:<uuid>'
    settings = get_settings()
    item = await get_product_by_id(product_id)
    if not item:
        raise ProductNotFoundError(f"Product {product_id} not found")
    if item.get("table") and settings.ACTIVE_CLIENT:
        return item
    return item


async def get_client_config() -> dict:
    """Load the active client configuration from JSON."""
    return get_settings().get_client_json()


async def list_sheet_rows(
    db: AsyncSession,
    sheet: str,
    skip: int = 0,
    limit: int = 50,
) -> dict:
    """Paginated listing of a single sheet table, returning raw columns."""
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT

    model = SHEET_MODEL_BY_KEY.get(sheet)
    if model is None:
        raise ValueError(f"Unknown sheet: {sheet}")

    skip = max(0, skip)
    limit = min(max(1, limit), 200)

    total = (
        await db.execute(
            select(func.count()).select_from(model).where(model.client_id == client_id)
        )
    ).scalar_one()

    order_parts = []
    if hasattr(model, "sr_no"):
        order_parts.append(model.sr_no.asc().nulls_last())
    if hasattr(model, "variant_type"):
        order_parts.append(model.variant_type.asc().nulls_last())
    if hasattr(model, "valve_size"):
        order_parts.append(model.valve_size.asc().nulls_last())
    if hasattr(model, "model_name"):
        order_parts.append(model.model_name.asc().nulls_last())
    order_parts.append(model.created_at.desc())

    stmt = select(model).where(model.client_id == client_id).order_by(*order_parts).offset(skip).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()

    columns = list(model.__table__.columns.keys())

    items: list[dict] = []
    for r in rows:
        d = {c: _jsonable(getattr(r, c)) for c in columns}
        items.append(d)

    return {
        "sheet": sheet,
        "columns": columns,
        "total": int(total or 0),
        "skip": skip,
        "limit": limit,
        "items": items,
    }
