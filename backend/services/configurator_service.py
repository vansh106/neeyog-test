"""Valve configurator service — cascading selection + assembly pricing.

Powers the ManualEntryForm valve product builder. All reads go against the
existing `catalog_*` tables (butterfly valves, operators, brackets &
couplers, SOV, limit switch box, positioner).
"""

from __future__ import annotations

import re
from typing import Any

import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from db.sheet_models import (
    CatalogBracketsCouplerRow,
    CatalogButterflyValveRow,
    CatalogLimitSwitchRow,
    CatalogOperatorRow,
    CatalogPositionerRow,
    CatalogSovRow,
)
from masters import product_master
from services import masters_service


# ── Valve spec columns ────────────────────────────────────────────────────
# Column names shown in the UI cascade. Order matters.
VALVE_SPEC_COLUMNS: dict[str, list[str]] = {
    "Butterfly Valve": [
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
}

_VALVE_MODEL_BY_TYPE: dict[str, type] = {
    "Butterfly Valve": CatalogButterflyValveRow,
}

# First-step configurator: every sheet-backed product family except accessories / operators.
_CONFIGURATOR_EXCLUDED_CATEGORIES = frozenset(
    {"operator", "brackets_coupler", "sov", "limit_switch_box", "positioner"},
)


def list_valve_catalog_categories() -> list[dict[str, str]]:
    """Stable API keys + labels for the manual valve picker (step 1).

    Fittings (``fp_fittings_*``) are excluded — they are add-ons after qualifying hose sheets.
    """
    out: list[dict[str, str]] = []
    for key, _model in product_master.SHEET_TABLES:
        if key in _CONFIGURATOR_EXCLUDED_CATEGORIES:
            continue
        if key.startswith("fp_fittings_"):
            continue
        label = masters_service.CATEGORY_LABEL_BY_KEY.get(key, key.replace("_", " ").title())
        out.append({"key": key, "label": label})
    return out


def _operator_sheet_filter_for_category(catalog_category: str | None, valve_type: str) -> str | None:
    """Return ``operator_for`` ILIKE pattern for ``CatalogOperatorRow``, or None = no filter."""
    if catalog_category == "butterfly_valve":
        return "Butterfly Valve"
    if catalog_category and catalog_category.startswith("fp_ball_valve_"):
        return "Ball Valve"
    if catalog_category:
        return None
    key = _valve_type_key(valve_type)
    if key == "Butterfly Valve":
        return "Butterfly Valve"
    t = (valve_type or "").strip().lower()
    if "ball" in t and "butterfly" not in t:
        return "Ball Valve"
    return None

# Human-readable label per valve type for operator_options. Excel stores
# inconsistent casing ("Ball Valve" vs "Ball valve"), so we normalize via ILIKE.


def _valve_type_key(valve_type: str) -> str:
    """Normalize any variant (case/whitespace) to the canonical key."""
    if not valve_type:
        return ""
    t = valve_type.strip().lower()
    if "butterfly" in t:
        return "Butterfly Valve"
    return valve_type.strip()


def _model_for_valve_type(valve_type: str) -> type:
    key = _valve_type_key(valve_type)
    model = _VALVE_MODEL_BY_TYPE.get(key)
    if model is None:
        raise ValueError(f"Unknown valve_type: {valve_type!r}")
    return model


def _active_client_id() -> str:
    return get_settings().ACTIVE_CLIENT


def _extract_construct_way(construction: str | None) -> str | None:
    """Extract '2 Way' / '3 Way' from a construction string.

    Examples:
        "1-Piece, 2 Way" -> "2 Way"
        "L-Port, 3 Way"  -> "3 Way"
    """
    if not construction:
        return None
    m = re.search(r"(\d+)\s*Way", str(construction), flags=re.IGNORECASE)
    if m:
        return f"{m.group(1)} Way"
    return None


def _infer_operator_type(model_name: str | None) -> str | None:
    if not model_name:
        return None
    name = str(model_name).strip().upper()
    if name.startswith("DA"):
        return "da"
    if name.startswith("SA"):
        return "sa"
    return None


# ── FUNCTION 1: get_distinct_values ───────────────────────────────────────
async def get_distinct_values(
    valve_type: str,
    field: str,
    filters: dict[str, str],
    db: AsyncSession,
) -> list[str]:
    """Distinct values for `field` given the already-chosen filters.

    Raises ValueError if field isn't declared in VALVE_SPEC_COLUMNS for this type.
    """
    key = _valve_type_key(valve_type)
    allowed = VALVE_SPEC_COLUMNS.get(key)
    if not allowed:
        raise ValueError(f"Unknown valve_type: {valve_type!r}")
    if field not in allowed:
        raise ValueError(f"Field {field!r} is not a valid spec column for {key!r}")

    model = _model_for_valve_type(valve_type)
    col = getattr(model, field, None)
    if col is None:
        return []

    stmt = select(func.distinct(col)).where(
        model.client_id == _active_client_id(),
        model.variant_type.ilike(key),
    )
    for k, v in (filters or {}).items():
        if k == field:
            continue
        if k not in allowed:
            continue
        if v is None or not str(v).strip():
            continue
        fcol = getattr(model, k, None)
        if fcol is None:
            continue
        stmt = stmt.where(fcol == v)

    stmt = stmt.where(col.is_not(None)).order_by(col)
    rows = (await db.execute(stmt)).all()

    out: list[str] = []
    seen: set[str] = set()
    for (val,) in rows:
        if val is None:
            continue
        s = str(val).strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


async def get_full_valve_catalog(valve_type: str, db: AsyncSession) -> list[dict[str, Any]]:
    """Return every catalog row for a legacy display valve type (maps to API category).

    Delegates to ``masters_service.get_full_category_catalog`` so the configurator
    stays aligned with Masters / Final_Products tables.
    """
    cat = _category_from_legacy_valve_display(valve_type)
    if not cat:
        raise ValueError(f"Unknown valve_type: {valve_type!r}")
    rows = await masters_service.get_full_category_catalog(cat, db)
    for r in rows:
        rid = r.get("row_id")
        if rid is not None and "id" not in r:
            r["id"] = str(rid)
        r["price_inr"] = None
    return rows


def _category_from_legacy_valve_display(valve_type: str) -> str | None:
    key = _valve_type_key(valve_type)
    if key == "Butterfly Valve":
        return "butterfly_valve"
    return None


def _normalize_configurator_category(category: str | None, valve_type: str | None) -> str | None:
    c = (category or "").strip()
    if c and c in masters_service.SHEET_MODEL_BY_KEY and c not in _CONFIGURATOR_EXCLUDED_CATEGORIES:
        return c
    if valve_type:
        return _category_from_legacy_valve_display(valve_type)
    return None


# ── FUNCTION 2: resolve_valve ─────────────────────────────────────────────
async def resolve_valve(
    *,
    category: str | None,
    valve_type: str | None,
    specs: dict[str, str],
    db: AsyncSession,
) -> dict | None:
    """Find the matching valve row given cascade field values (API category key)."""
    cat = _normalize_configurator_category(category, valve_type)
    if not cat:
        return None
    model = masters_service.SHEET_MODEL_BY_KEY.get(cat)
    if model is None:
        return None
    allowed = masters_service.CASCADE_STEPS.get(cat, [])
    if not allowed:
        return None

    stmt = select(model).where(model.client_id == _active_client_id())
    for field in allowed:
        raw = (specs or {}).get(field)
        if raw is None or not str(raw).strip():
            return None
        col = getattr(model, field, None)
        if col is None:
            return None
        stmt = stmt.where(col == str(raw).strip())

    rows = (await db.execute(stmt.limit(2))).scalars().all()
    if not rows:
        return None
    row = rows[0]

    label = masters_service.CATEGORY_LABEL_BY_KEY.get(cat, cat)
    out: dict[str, Any] = {
        "id": str(row.row_id),
        "type": label,
        "catalog_category": cat,
        "base_price": None,
        "has_price": False,
    }
    for col_name in allowed:
        out[col_name] = getattr(row, col_name, None)
    return out


# ── FUNCTION 3: get_operators_for_valve ───────────────────────────────────
def _row_to_operator(r: CatalogOperatorRow) -> dict | None:
    otype = _infer_operator_type(r.model_name)
    if otype is None:
        return None
    return {
        "id": str(r.row_id),
        "model_name": r.model_name,
        "size": r.size_text,
        "base_price": None,
        "operator_type": otype,
    }


async def get_operators_for_valve(
    valve_type: str,
    construction: str,
    valve_size: str,  # noqa: ARG001 — kept in signature for route compatibility
    db: AsyncSession,
    *,
    catalog_category: str | None = None,
) -> dict:
    """Return every DA/SA actuator row that matches the valve's construct-way.

    The only link between a valve and an actuator row is the ``construct``
    (2 Way vs 3 Way) — sizes don't line up cleanly (valves use mm/DN/bore,
    actuators are imperial-only). So we *never* auto-match by size; instead
    we hand the UI the full list for the construct and let the user pick the
    actuator model + size they want.
    """
    op_pattern = _operator_sheet_filter_for_category(catalog_category, valve_type)
    way = _extract_construct_way(construction)

    da_operators: list[dict] = []
    sa_operators: list[dict] = []

    stmt = select(CatalogOperatorRow).where(CatalogOperatorRow.client_id == _active_client_id())
    # Prefer construct-way match when present, but butterfly/bulk catalogs often don't encode 2/3-way.
    if way:
        stmt = stmt.where(CatalogOperatorRow.construct.ilike(way))

    # Include:
    # - rows explicitly marked for the valve type (legacy), and/or
    # - rows normalized to "All valves" (preferred), and/or
    # - any NULL/empty operator_for (treat as global).
    if op_pattern:
        stmt = stmt.where(
            sa.or_(
                CatalogOperatorRow.operator_for.ilike(op_pattern),
                CatalogOperatorRow.operator_for.ilike("all valves"),
                CatalogOperatorRow.operator_for.is_(None),
                CatalogOperatorRow.operator_for == "",
            )
        )
    stmt = stmt.order_by(CatalogOperatorRow.construct, CatalogOperatorRow.size_text, CatalogOperatorRow.model_name).limit(600)

    for r in (await db.execute(stmt)).scalars().all():
        item = _row_to_operator(r)
        if item is None:
            continue
        if item["operator_type"] == "da":
            da_operators.append(item)
        else:
            sa_operators.append(item)

    return {
        "da_operators": da_operators,
        "sa_operators": sa_operators,
        "has_da": bool(da_operators),
        "has_sa": bool(sa_operators),
        "construct_way": way,
    }


# ── FUNCTION 4: get_bracket_for_valve ─────────────────────────────────────
async def get_bracket_for_valve(
    valve_type: str,
    valve_size: str,
    db: AsyncSession,
    *,
    catalog_category: str | None = None,
) -> dict | None:
    eff_cat = catalog_category or _category_from_legacy_valve_display(valve_type)
    if eff_cat != "butterfly_valve":
        return None
    key = "Butterfly Valve"
    if not valve_size:
        return None
    stmt = select(CatalogBracketsCouplerRow).where(
        CatalogBracketsCouplerRow.client_id == _active_client_id(),
        CatalogBracketsCouplerRow.bracket_operator.ilike(key),
        CatalogBracketsCouplerRow.size_text == valve_size,
    ).limit(1)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        return None
    return {
        "id": str(row.row_id),
        "size": row.size_text,
        "price": None,
    }


# ── FUNCTION 5: get_all_accessories ───────────────────────────────────────
async def get_all_accessories(db: AsyncSession) -> dict:
    client_id = _active_client_id()

    async def _list(model) -> list[dict]:
        stmt = select(model).where(model.client_id == client_id).order_by(model.sr_no.nulls_last())
        rows = (await db.execute(stmt)).scalars().all()
        out: list[dict] = []
        for r in rows:
            out.append(
                {
                    "id": str(r.row_id),
                    "sr_no": int(r.sr_no) if r.sr_no is not None else 0,
                    "type": r.variant_type or "",
                    "price": None,
                }
            )
        return out

    return {
        "sov": await _list(CatalogSovRow),
        "limit_switch_boxes": await _list(CatalogLimitSwitchRow),
        "positioners": await _list(CatalogPositionerRow),
    }


# ── FUNCTION 6: calculate_assembly_price ──────────────────────────────────
_OPERATOR_KEYS = {"bare_shaft", "manual", "gear_box", "da", "sa", "electric_actuator"}


def calculate_assembly_price(
    valve_price: float | None,
    operator_type: str,
    operator_price: float | None,
    sov_price: float | None,
    lsb_price: float | None,
    positioner_price: float | None,
    bracket_price: float | None,
) -> dict:
    """Pure price calculator for a configured valve assembly."""
    key = (operator_type or "").strip().lower()
    if key not in _OPERATOR_KEYS:
        raise ValueError(f"Unknown operator_type: {operator_type!r}")

    subtotal = 0.0
    has_unknown = False
    unknown: list[str] = []
    breakdown: list[dict] = []

    def _row(component: str, price: float | None, selected: bool = True) -> None:
        nonlocal subtotal, has_unknown
        if not selected:
            return
        if price is None:
            has_unknown = True
            unknown.append(component)
        else:
            subtotal += float(price)
        breakdown.append({"component": component, "price": price})

    _row("Base valve", valve_price, selected=True)

    if key in ("da", "sa"):
        label = "Double Acting actuator" if key == "da" else "Single Acting actuator"
        _row(label, operator_price, selected=True)
    elif key == "manual":
        _row("Manual operator", None, selected=True)
    elif key == "gear_box":
        _row("Gear box", None, selected=True)
    elif key == "electric_actuator":
        _row("Electric actuator", None, selected=True)
    # bare_shaft contributes nothing

    if sov_price is not None or (sov_price is None and False):
        pass  # placeholder for static analyzers
    if sov_price is not None:
        _row("SOV", sov_price, selected=True)
    if lsb_price is not None:
        _row("Limit switch box", lsb_price, selected=True)
    if positioner_price is not None:
        _row("Positioner", positioner_price, selected=True)
    if bracket_price is not None:
        _row("Bracket & coupler", bracket_price, selected=True)

    return {
        "subtotal": round(subtotal, 2),
        "has_unknown_prices": has_unknown,
        "unknown_components": unknown,
        "breakdown": breakdown,
    }


# ── Operator options helper (used by controller) ─────────────────────────
def build_operator_options(
    da_operators: list[dict],
    sa_operators: list[dict],
) -> list[dict]:
    """Build the six fixed operator cards with current availability info."""
    return [
        {
            "key": "bare_shaft",
            "label": "Bare Shaft",
            "description": "No operator — valve only",
            "has_price": True,
            "price": 0,
            "unlocks_accessories": False,
        },
        {
            "key": "manual",
            "label": "Manual",
            "description": "Manual operation — price on request",
            "has_price": False,
            "price": None,
            "unlocks_accessories": False,
        },
        {
            "key": "gear_box",
            "label": "Gear Box",
            "description": "Gear box operation — price on request",
            "has_price": False,
            "price": None,
            "unlocks_accessories": False,
        },
        {
            "key": "da",
            "label": "Double Acting (DA)",
            "description": "Pneumatic double acting actuator",
            "has_price": bool(da_operators and any(m.get("base_price") is not None for m in da_operators)),
            "price": None,
            "models": da_operators,
            "unlocks_accessories": True,
        },
        {
            "key": "sa",
            "label": "Single Acting (SA)",
            "description": "Pneumatic single acting actuator",
            "has_price": bool(sa_operators and any(m.get("base_price") is not None for m in sa_operators)),
            "price": None,
            "models": sa_operators,
            "unlocks_accessories": True,
        },
        {
            "key": "electric_actuator",
            "label": "Electric Actuator",
            "description": "Electric actuator — price on request",
            "has_price": False,
            "price": None,
            "unlocks_accessories": True,
        },
    ]
