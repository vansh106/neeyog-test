"""Request handling for the valve configurator."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from services import configurator_service, masters_service
from services.configurator_service import VALVE_SPEC_COLUMNS, build_operator_options

logger = logging.getLogger(__name__)


# ── Request / response models ────────────────────────────────────────────
class ValveOptionsResponse(BaseModel):
    field: str
    options: list[str]


class ResolveValveResponse(BaseModel):
    found: bool
    product: dict | None = None
    multiple_matches: bool = False


class OperatorsResponse(BaseModel):
    operator_options: list[dict]
    da_operators: list[dict]
    sa_operators: list[dict]
    bracket: dict | None = None
    construct_way: str | None = None


class AccessoriesResponse(BaseModel):
    sov: list[dict]
    limit_switch_boxes: list[dict]
    positioners: list[dict]


class PriceCalcRequest(BaseModel):
    valve_price: float | None = None
    operator_type: str = "bare_shaft"
    operator_price: float | None = None
    sov_price: float | None = None
    lsb_price: float | None = None
    positioner_price: float | None = None
    bracket_price: float | None = None


class PriceCalcResponse(BaseModel):
    subtotal: float
    has_unknown_prices: bool
    unknown_components: list[str]
    breakdown: list[dict] = Field(default_factory=list)


class FullValveCatalogResponse(BaseModel):
    valve_type: str
    count: int
    rows: list[dict[str, Any]]


class FullCategoryCatalogResponse(BaseModel):
    category: str
    count: int
    rows: list[dict[str, Any]]


# ── Handlers ─────────────────────────────────────────────────────────────
def handle_list_valve_types() -> list[str]:
    return list(VALVE_SPEC_COLUMNS.keys())


def _parse_filters(raw: str | None) -> dict[str, str]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"filters must be valid JSON: {e}")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="filters must be a JSON object")
    out: dict[str, str] = {}
    for k, v in data.items():
        if v is None:
            continue
        out[str(k)] = str(v)
    return out


async def handle_valve_options(
    valve_type: str,
    field: str,
    filters_json: str | None,
    db: AsyncSession,
) -> ValveOptionsResponse:
    filters = _parse_filters(filters_json)
    try:
        options = await configurator_service.get_distinct_values(
            valve_type=valve_type, field=field, filters=filters, db=db
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("valve-options failed")
        raise HTTPException(status_code=500, detail=str(e))
    return ValveOptionsResponse(field=field, options=options)


async def handle_resolve_valve(
    valve_type: str,
    specs: dict[str, Any],
    db: AsyncSession,
) -> ResolveValveResponse:
    cleaned = {k: str(v) for k, v in (specs or {}).items() if v is not None and str(v).strip()}
    try:
        product = await configurator_service.resolve_valve(
            valve_type=valve_type, specs=cleaned, db=db
        )
    except Exception as e:
        logger.exception("resolve-valve failed")
        raise HTTPException(status_code=500, detail=str(e))
    return ResolveValveResponse(found=product is not None, product=product, multiple_matches=False)


async def handle_get_operators(
    valve_type: str,
    construction: str,
    valve_size: str,
    db: AsyncSession,
) -> OperatorsResponse:
    try:
        ops = await configurator_service.get_operators_for_valve(
            valve_type=valve_type,
            construction=construction,
            valve_size=valve_size,
            db=db,
        )
        bracket = await configurator_service.get_bracket_for_valve(
            valve_type=valve_type, valve_size=valve_size, db=db
        )
    except Exception as e:
        logger.exception("operators lookup failed")
        raise HTTPException(status_code=500, detail=str(e))
    options = build_operator_options(ops["da_operators"], ops["sa_operators"])
    return OperatorsResponse(
        operator_options=options,
        da_operators=ops["da_operators"],
        sa_operators=ops["sa_operators"],
        bracket=bracket,
        construct_way=ops.get("construct_way"),
    )


async def handle_get_accessories(db: AsyncSession) -> AccessoriesResponse:
    try:
        data = await configurator_service.get_all_accessories(db)
    except Exception as e:
        logger.exception("accessories lookup failed")
        raise HTTPException(status_code=500, detail=str(e))
    return AccessoriesResponse(**data)


def handle_calculate_price(body: PriceCalcRequest) -> PriceCalcResponse:
    try:
        result = configurator_service.calculate_assembly_price(
            valve_price=body.valve_price,
            operator_type=body.operator_type,
            operator_price=body.operator_price,
            sov_price=body.sov_price,
            lsb_price=body.lsb_price,
            positioner_price=body.positioner_price,
            bracket_price=body.bracket_price,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return PriceCalcResponse(**result)


async def handle_get_full_catalog(valve_type: str, db: AsyncSession) -> FullValveCatalogResponse:
    try:
        rows = await configurator_service.get_full_valve_catalog(valve_type, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("full-catalog failed")
        raise HTTPException(status_code=500, detail=str(e))
    return FullValveCatalogResponse(valve_type=valve_type, count=len(rows), rows=rows)


async def handle_get_full_category_catalog(category: str, db: AsyncSession) -> FullCategoryCatalogResponse:
    try:
        rows = await masters_service.get_full_category_catalog(category, db)
    except Exception as e:
        logger.exception("full-category-catalog failed")
        raise HTTPException(status_code=500, detail=str(e))
    return FullCategoryCatalogResponse(category=category, count=len(rows), rows=rows)
