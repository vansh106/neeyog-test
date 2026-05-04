"""Supplier pricing API — router only; logic lives in ``supplier_controller``."""

import json
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from controllers import supplier_controller
from controllers.supplier_controller import (
    BulkUpsertPricesRequest,
    CalculatePriceRequest,
    CreateSupplierRequest,
    UpdateSupplierRequest,
    UpsertPriceRequest,
)
from core.auth_middleware import CurrentUser, require_permission
from core.database import get_db

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("/{supplier_id}/category-pricing")
async def list_supplier_category_pricing_route(
    supplier_id: str,
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_list_supplier_category_pricing(supplier_id, db)


@router.get("/{supplier_id}/category-pricing/{category_key}")
async def get_supplier_category_pricing_route(
    supplier_id: str,
    category_key: str,
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_get_supplier_category_pricing(supplier_id, category_key, db)


@router.patch("/{supplier_id}/category-pricing/{category_key}")
async def upsert_supplier_category_pricing_route(
    supplier_id: str,
    category_key: str,
    body: supplier_controller.UpsertSupplierCategoryPricingRequest,
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_upsert_supplier_category_pricing(supplier_id, category_key, body, db)


@router.post(
    "/calculate-price",
    dependencies=[Depends(require_permission(Permission.MASTERS_VIEW))],
)
async def calculate_price_route(
    body: CalculatePriceRequest,
):
    return supplier_controller.handle_calculate_price(body)


@router.get("/")
async def list_suppliers_route(
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_VIEW)),
    active_only: bool = Query(False, description="If true, return only active suppliers."),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_list_suppliers(db, active_only=active_only)


@router.post("/")
async def create_supplier_route(
    body: CreateSupplierRequest,
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_create_supplier(body, db)


@router.patch("/{supplier_id}")
async def update_supplier_route(
    supplier_id: str,
    body: UpdateSupplierRequest,
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_update_supplier(supplier_id, body, db)


@router.patch("/{supplier_id}/preferred")
async def set_preferred_supplier_route(
    supplier_id: str,
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_set_preferred(supplier_id, db)


@router.patch("/{supplier_id}/deactivate")
async def deactivate_supplier_route(
    supplier_id: str,
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_deactivate_supplier(supplier_id, db)


@router.get("/{supplier_id}/prices")
async def list_supplier_prices_route(
    supplier_id: str,
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_VIEW)),
    catalog_table: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_list_prices(supplier_id, db, catalog_table=catalog_table)


@router.post("/{supplier_id}/prices")
async def upsert_supplier_price_route(
    supplier_id: str,
    body: UpsertPriceRequest,
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_upsert_price(supplier_id, body, db)


@router.post("/{supplier_id}/prices/bulk")
async def bulk_upsert_supplier_prices_route(
    supplier_id: str,
    body: BulkUpsertPricesRequest,
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_bulk_upsert_prices(supplier_id, body, db)


@router.post("/{supplier_id}/preview-pricelist")
async def preview_pricelist_route(
    supplier_id: str,
    catalog_table: str = Form(...),
    column_map: str = Form("{}"),
    file: UploadFile = File(...),
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_UPLOAD_PRICELIST)),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not str(file.filename).lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Upload an Excel .xlsx file")
    try:
        col_map = json.loads(column_map) if column_map.strip() else {}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail="Invalid column_map JSON") from e
    if not isinstance(col_map, dict):
        raise HTTPException(status_code=400, detail="column_map must be a JSON object")
    col_map_str = {str(k): str(v) for k, v in col_map.items()}
    content = await file.read()
    return await supplier_controller.handle_preview_pricelist_import(
        supplier_id, catalog_table, col_map_str, content, db
    )


@router.post("/{supplier_id}/import-pricelist")
async def import_pricelist_route(
    supplier_id: str,
    catalog_table: str = Form(...),
    column_map: str = Form("{}"),
    file: UploadFile = File(...),
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_UPLOAD_PRICELIST)),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not str(file.filename).lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Upload an Excel .xlsx file")
    try:
        col_map = json.loads(column_map) if column_map.strip() else {}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail="Invalid column_map JSON") from e
    if not isinstance(col_map, dict):
        raise HTTPException(status_code=400, detail="column_map must be a JSON object")
    col_map_str = {str(k): str(v) for k, v in col_map.items()}
    content = await file.read()
    return await supplier_controller.handle_import_pricelist_import(
        supplier_id, catalog_table, col_map_str, content, db
    )


@router.get("/{supplier_id}/prices/{catalog_table}/{catalog_row_id}")
async def get_supplier_product_price_route(
    supplier_id: str,
    catalog_table: str,
    catalog_row_id: str,
    _user: CurrentUser = Depends(require_permission(Permission.MASTERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    return await supplier_controller.handle_get_product_price(
        supplier_id, catalog_table, catalog_row_id, db
    )
