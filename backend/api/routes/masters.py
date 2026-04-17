"""Route definitions for master data endpoints — no business logic here."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from controllers import masters_controller
from core.auth_middleware import require_permission
from core.database import get_db

router = APIRouter(prefix="/masters", tags=["masters"])


class CascadeValuesBody(BaseModel):
    category: str
    field: str
    filters: dict[str, str] = Field(default_factory=dict)


class CascadeMatchBody(BaseModel):
    category: str
    filters: dict[str, str] = Field(default_factory=dict)


# Catalog categories live here (not under /products/...) so an old server build cannot
# accidentally match GET /products/{product_id} with product_id="categories" (404).
@router.get("/categories")
async def list_catalog_categories_route(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MASTERS_VIEW)),
):
    return await masters_controller.handle_product_categories(db)


@router.get("/products")
async def list_products_route(
    category: str | None = None,
    skip: int = 0,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MASTERS_VIEW)),
):
    return await masters_controller.handle_list_products(db, category=category, skip=skip, limit=limit)


# Static /products/... paths MUST be declared before /products/{product_id}, otherwise
# "categories", "sizes", etc. are captured as product_id (404).
@router.get("/products/categories")
async def list_product_categories_route(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MASTERS_VIEW)),
):
    return await masters_controller.handle_product_categories(db)


@router.get("/products/subcategories")
async def list_product_subcategories_route(
    category: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MASTERS_VIEW)),
):
    return await masters_controller.handle_product_subcategories(db, category)


@router.get("/products/sizes")
async def list_product_sizes_route(
    category: str = Query(...),
    subcategory: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MASTERS_VIEW)),
):
    return await masters_controller.handle_product_sizes(db, category, subcategory)


@router.get("/products/materials")
async def list_product_materials_route(
    category: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MASTERS_VIEW)),
):
    return await masters_controller.handle_product_materials(db, category)


@router.get("/products/cascade-schema")
async def cascade_schema_route(category: str = Query(...), _user=Depends(require_permission(Permission.MASTERS_VIEW))):
    return masters_controller.handle_cascade_schema(category)


@router.post("/products/cascade-values")
async def cascade_values_route(
    body: CascadeValuesBody,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MASTERS_VIEW)),
):
    return await masters_controller.handle_cascade_values(db, body.category, body.field, body.filters)


@router.post("/products/cascade-match")
async def cascade_match_route(
    body: CascadeMatchBody,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MASTERS_VIEW)),
):
    return await masters_controller.handle_cascade_match(db, body.category, body.filters)


@router.get("/products/{product_id}")
async def get_product_route(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MASTERS_VIEW)),
):
    return await masters_controller.handle_get_product(product_id, db)


@router.get("/client-config")
async def get_client_config_route(_user=Depends(require_permission(Permission.MASTERS_VIEW))):
    return await masters_controller.handle_get_client_config()


@router.get("/sheets/{sheet}/rows")
async def list_sheet_rows_route(
    sheet: str,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MASTERS_VIEW)),
):
    return await masters_controller.handle_list_sheet_rows(db, sheet=sheet, skip=skip, limit=limit)


@router.get("/clients")
async def list_clients_dropdown_route(
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.CLIENT_VIEW)),
):
    return await masters_controller.handle_clients_dropdown(db, search)
