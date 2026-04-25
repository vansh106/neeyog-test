"""Valve configurator routes — /api/configurator/..."""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from controllers import configurator_controller
from controllers.configurator_controller import (
    AccessoriesResponse,
    FullCategoryCatalogResponse,
    FullValveCatalogResponse,
    OperatorsResponse,
    PriceCalcRequest,
    PriceCalcResponse,
    ResolveValveResponse,
    ValveOptionsResponse,
)
from core.database import get_db
from services.configurator_service import VALVE_SPEC_COLUMNS

router = APIRouter(prefix="/api/configurator", tags=["configurator"])


@router.get("/valve-types", response_model=list[str])
async def list_valve_types_route():
    return configurator_controller.handle_list_valve_types()


@router.get("/valve-options", response_model=ValveOptionsResponse)
async def valve_options_route(
    valve_type: str = Query(...),
    field: str = Query(...),
    filters: str | None = Query(None, description="JSON-encoded filter dict"),
    db: AsyncSession = Depends(get_db),
):
    return await configurator_controller.handle_valve_options(
        valve_type=valve_type, field=field, filters_json=filters, db=db
    )


@router.get("/full-catalog", response_model=FullValveCatalogResponse)
async def full_catalog_route(
    valve_type: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Return all valve rows for one valve type (one-shot client-side cascade)."""
    return await configurator_controller.handle_get_full_catalog(valve_type, db)


@router.get("/full-category-catalog", response_model=FullCategoryCatalogResponse)
async def full_category_catalog_route(
    category: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Return all catalog rows for a masters category (one-shot client-side cascade)."""
    return await configurator_controller.handle_get_full_category_catalog(category, db)


@router.get("/resolve-valve", response_model=ResolveValveResponse)
async def resolve_valve_route(
    request: Request,
    valve_type: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """All spec fields are passed as individual query params (construction, valve_size, ...).

    Rather than binding each param explicitly, pull the whole query string and
    forward any spec columns we know about to the service.
    """
    allowed = set(VALVE_SPEC_COLUMNS.get(valve_type, []))
    qp = dict(request.query_params)
    specs = {k: v for k, v in qp.items() if k in allowed}
    return await configurator_controller.handle_resolve_valve(
        valve_type=valve_type, specs=specs, db=db
    )


@router.get("/operators", response_model=OperatorsResponse)
async def operators_route(
    valve_type: str = Query(...),
    construction: str = Query(...),
    valve_size: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    return await configurator_controller.handle_get_operators(
        valve_type=valve_type,
        construction=construction,
        valve_size=valve_size,
        db=db,
    )


@router.get("/accessories", response_model=AccessoriesResponse)
async def accessories_route(db: AsyncSession = Depends(get_db)):
    return await configurator_controller.handle_get_accessories(db)


@router.post("/calculate-price", response_model=PriceCalcResponse)
async def calculate_price_route(body: PriceCalcRequest):
    return configurator_controller.handle_calculate_price(body)
