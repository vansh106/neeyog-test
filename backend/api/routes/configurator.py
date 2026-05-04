"""Valve configurator routes — /api/configurator/..."""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from controllers import configurator_controller
from controllers.configurator_controller import (
    AccessoriesResponse,
    FullCategoryCatalogResponse,
    FullValveCatalogResponse,
    OperatorsResponse,
    PriceCalcRequest,
    PriceCalcResponse,
    ResolveValveResponse,
    ValveCategoryItem,
    ValveOptionsResponse,
)
from core.auth_middleware import CurrentUser, require_permission
from core.database import get_db

router = APIRouter(prefix="/api/configurator", tags=["configurator"])


@router.get("/valve-types", response_model=list[ValveCategoryItem])
async def list_valve_types_route(
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_VIEW)),
):
    return configurator_controller.handle_list_valve_types()


@router.get("/valve-options", response_model=ValveOptionsResponse)
async def valve_options_route(
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_VIEW)),
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
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_VIEW)),
    valve_type: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Return all valve rows for one valve type (one-shot client-side cascade)."""
    return await configurator_controller.handle_get_full_catalog(valve_type, db)


@router.get("/full-category-catalog", response_model=FullCategoryCatalogResponse)
async def full_category_catalog_route(
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_VIEW)),
    category: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Return all catalog rows for a masters category (one-shot client-side cascade)."""
    return await configurator_controller.handle_get_full_category_catalog(category, db)


@router.get(
    "/resolve-valve",
    response_model=ResolveValveResponse,
    dependencies=[Depends(require_permission(Permission.MASTERS_VIEW))],
)
async def resolve_valve_route(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Cascade field values as query params plus ``category`` (API key) or legacy ``valve_type``."""
    return await configurator_controller.handle_resolve_valve(request, db)


@router.get("/operators", response_model=OperatorsResponse)
async def operators_route(
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_VIEW)),
    valve_type: str = Query(...),
    construction: str = Query(...),
    valve_size: str = Query(...),
    category: str | None = Query(None, description="Catalog API key, e.g. butterfly_valve"),
    db: AsyncSession = Depends(get_db),
):
    return await configurator_controller.handle_get_operators(
        valve_type=valve_type,
        construction=construction,
        valve_size=valve_size,
        db=db,
        catalog_category=category,
    )


@router.get("/accessories", response_model=AccessoriesResponse)
async def accessories_route(
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    return await configurator_controller.handle_get_accessories(db)


@router.post(
    "/calculate-price",
    response_model=PriceCalcResponse,
    dependencies=[Depends(require_permission(Permission.MASTERS_VIEW))],
)
async def calculate_price_route(
    body: PriceCalcRequest,
):
    return configurator_controller.handle_calculate_price(body)
