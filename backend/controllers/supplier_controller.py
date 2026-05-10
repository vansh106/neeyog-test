"""HTTP-facing handlers for suppliers, supplier prices, and client pricing config."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Supplier, SupplierCategoryPricing, SupplierProductPrice
from masters.product_master import SHEET_TABLES
from services import pricing_service

VALID_CATALOG_TABLES = frozenset(k for k, _ in SHEET_TABLES)


class CreateSupplierRequest(BaseModel):
    name: str
    # Supplier-category pricing (optional at creation time)
    primary_category_key: str = "all"
    margin_multiplier: float | None = None
    supplier_discount_pct: float | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None


class UpdateSupplierRequest(BaseModel):
    name: str | None = None
    primary_category_key: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None


class SupplierResponse(BaseModel):
    id: str
    name: str
    primary_category_key: str
    contact_person: str | None
    phone: str | None
    email: str | None
    is_active: bool
    is_preferred: bool
    created_at: str


class SupplierCategoryPricingResponse(BaseModel):
    id: str
    supplier_id: str
    category_key: str
    margin_multiplier: float | None
    supplier_discount_pct: float | None


class UpsertPriceRequest(BaseModel):
    catalog_table: str
    catalog_row_id: str
    list_price_inr: float
    discount_pct_override: float | None = None


class BulkUpsertPricesRequest(BaseModel):
    prices: list[UpsertPriceRequest] = Field(default_factory=list)


class PricingConfigRequest(BaseModel):
    margin_multiplier: float
    default_supplier_id: str | None = None


class CalculatePriceRequest(BaseModel):
    list_price: float
    supplier_discount_pct: float
    margin_multiplier: float
    customer_discount_pct: float
    quantity: int = 1


class SupplierPriceRowResponse(BaseModel):
    id: str
    supplier_id: str
    catalog_table: str
    catalog_row_id: str
    list_price_inr: float
    discount_pct_override: float | None
    effective_discount_pct: float
    cost_to_parth: float


class PricingConfigResponse(BaseModel):
    margin_multiplier: float
    default_supplier_id: str | None
    default_supplier_name: str | None


def _supplier_to_response(s: Supplier) -> SupplierResponse:
    created = s.created_at
    if isinstance(created, datetime):
        created_s = created.isoformat()
    else:
        created_s = ""
    return SupplierResponse(
        id=str(s.id),
        name=s.name,
        primary_category_key=str(getattr(s, "primary_category_key", "all") or "all"),
        contact_person=s.contact_person,
        phone=s.phone,
        email=s.email,
        is_active=bool(s.is_active),
        is_preferred=bool(s.is_preferred),
        created_at=created_s,
    )


def _category_pricing_to_response(r: SupplierCategoryPricing) -> SupplierCategoryPricingResponse:
    return SupplierCategoryPricingResponse(
        id=str(r.id),
        supplier_id=str(r.supplier_id),
        category_key=r.category_key,
        margin_multiplier=float(r.margin_multiplier) if r.margin_multiplier is not None else None,
        supplier_discount_pct=float(r.supplier_discount_pct) if r.supplier_discount_pct is not None else None,
    )


def _price_row_response(row: SupplierProductPrice) -> SupplierPriceRowResponse:
    disc = row.effective_discount_pct
    cost = row.list_price_inr * (1.0 - disc / 100.0)
    return SupplierPriceRowResponse(
        id=str(row.id),
        supplier_id=str(row.supplier_id),
        catalog_table=row.catalog_table,
        catalog_row_id=str(row.catalog_row_id),
        list_price_inr=float(row.list_price_inr),
        discount_pct_override=float(row.discount_pct_override)
        if row.discount_pct_override is not None
        else None,
        effective_discount_pct=disc,
        cost_to_parth=round(cost, 2),
    )


async def handle_list_suppliers(db: AsyncSession, *, active_only: bool = False) -> list[SupplierResponse]:
    client_id = pricing_service.active_client_id()
    rows = await pricing_service.get_suppliers(client_id, db, active_only=active_only)
    return [_supplier_to_response(s) for s in rows]


async def handle_create_supplier(body: CreateSupplierRequest, db: AsyncSession) -> SupplierResponse:
    client_id = pricing_service.active_client_id()
    s = await pricing_service.create_supplier(
        client_id,
        body.name,
        body.primary_category_key,
        body.margin_multiplier,
        body.supplier_discount_pct,
        body.contact_person,
        body.phone,
        body.email,
        body.address,
        body.notes,
        db,
    )
    return _supplier_to_response(s)


async def handle_update_supplier(supplier_id: str, body: UpdateSupplierRequest, db: AsyncSession) -> SupplierResponse:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    row = await pricing_service.update_supplier(
        sid,
        client_id,
        db,
        name=body.name,
        primary_category_key=body.primary_category_key,
        contact_person=body.contact_person,
        phone=body.phone,
        email=body.email,
        address=body.address,
        notes=body.notes,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return _supplier_to_response(row)


async def handle_set_preferred(supplier_id: str, db: AsyncSession) -> SupplierResponse:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    row = await pricing_service.set_preferred_supplier(client_id, sid, db)
    if row is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return _supplier_to_response(row)


async def handle_deactivate_supplier(supplier_id: str, db: AsyncSession) -> SupplierResponse:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    row = await pricing_service.deactivate_supplier(sid, client_id, db)
    if row is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return _supplier_to_response(row)


async def handle_list_prices(
    supplier_id: str,
    db: AsyncSession,
    *,
    catalog_table: str | None,
) -> list[SupplierPriceRowResponse]:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    rows = await pricing_service.list_supplier_prices(sid, client_id, db, catalog_table=catalog_table)
    if not rows and await pricing_service.get_supplier_or_none(sid, client_id, db) is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return [_price_row_response(r) for r in rows]


async def handle_upsert_price(supplier_id: str, body: UpsertPriceRequest, db: AsyncSession) -> SupplierPriceRowResponse:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    if await pricing_service.get_supplier_or_none(sid, client_id, db) is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    row = await pricing_service.upsert_supplier_price(
        supplier_id,
        body.catalog_table,
        body.catalog_row_id,
        body.list_price_inr,
        body.discount_pct_override,
        db,
    )
    return _price_row_response(row)


async def handle_bulk_upsert_prices(supplier_id: str, body: BulkUpsertPricesRequest, db: AsyncSession) -> dict:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    if await pricing_service.get_supplier_or_none(sid, client_id, db) is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    items = [p.model_dump() for p in body.prices]
    return await pricing_service.bulk_upsert_supplier_prices(supplier_id, items, db)


async def handle_get_product_price(
    supplier_id: str,
    catalog_table: str,
    catalog_row_id: str,
    db: AsyncSession,
) -> SupplierPriceRowResponse:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    if await pricing_service.get_supplier_or_none(sid, client_id, db) is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    row = await pricing_service.get_price_for_product(supplier_id, catalog_table, catalog_row_id, db)
    if row is None:
        raise HTTPException(status_code=404, detail="Price not found")
    return _price_row_response(row)


async def handle_get_pricing_config(db: AsyncSession) -> PricingConfigResponse:
    raise HTTPException(status_code=410, detail="Client pricing config deprecated. Use supplier category pricing.")


async def handle_patch_pricing_config(body: PricingConfigRequest, db: AsyncSession) -> PricingConfigResponse:
    raise HTTPException(status_code=410, detail="Client pricing config deprecated. Use supplier category pricing.")


async def handle_list_supplier_category_pricing(
    supplier_id: str,
    db: AsyncSession,
) -> list[SupplierCategoryPricingResponse]:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    if await pricing_service.get_supplier_or_none(sid, client_id, db) is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    rows = await pricing_service.list_supplier_category_pricing(sid, db)
    return [_category_pricing_to_response(r) for r in rows]


async def handle_get_supplier_category_pricing(
    supplier_id: str,
    category_key: str,
    db: AsyncSession,
) -> dict:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    if await pricing_service.get_supplier_or_none(sid, client_id, db) is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return await pricing_service.get_resolved_supplier_category_pricing(sid, category_key or "all", db)


class UpsertSupplierCategoryPricingRequest(BaseModel):
    margin_multiplier: float | None = None
    supplier_discount_pct: float | None = None


async def handle_upsert_supplier_category_pricing(
    supplier_id: str,
    category_key: str,
    body: UpsertSupplierCategoryPricingRequest,
    db: AsyncSession,
) -> SupplierCategoryPricingResponse:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    if await pricing_service.get_supplier_or_none(sid, client_id, db) is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    row = await pricing_service.upsert_supplier_category_pricing(
        sid,
        category_key or "all",
        db,
        margin_multiplier=body.margin_multiplier,
        supplier_discount_pct=body.supplier_discount_pct,
    )
    return _category_pricing_to_response(row)


def handle_calculate_price(body: CalculatePriceRequest) -> dict:
    return pricing_service.calculate_price(
        body.list_price,
        body.supplier_discount_pct,
        body.margin_multiplier,
        body.customer_discount_pct,
        body.quantity,
    )


async def handle_preview_pricelist_import(
    supplier_id: str,
    catalog_table: str,
    column_map: dict[str, str],
    file_bytes: bytes,
    db: AsyncSession,
) -> dict:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    if catalog_table not in VALID_CATALOG_TABLES:
        raise HTTPException(status_code=400, detail="Invalid catalog_table")
    if await pricing_service.get_supplier_or_none(sid, client_id, db) is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    try:
        parsed = pricing_service.parse_supplier_xlsx_to_rows(file_bytes, column_map)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {e}") from e
    return await pricing_service.preview_supplier_pricelist(supplier_id, catalog_table, parsed, db)


async def handle_import_pricelist_import(
    supplier_id: str,
    catalog_table: str,
    column_map: dict[str, str],
    file_bytes: bytes,
    db: AsyncSession,
) -> dict:
    client_id = pricing_service.active_client_id()
    try:
        sid = uuid.UUID(supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid supplier id") from e
    if catalog_table not in VALID_CATALOG_TABLES:
        raise HTTPException(status_code=400, detail="Invalid catalog_table")
    if await pricing_service.get_supplier_or_none(sid, client_id, db) is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    try:
        parsed = pricing_service.parse_supplier_xlsx_to_rows(file_bytes, column_map)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {e}") from e
    return await pricing_service.import_supplier_pricelist(supplier_id, catalog_table, parsed, db)
