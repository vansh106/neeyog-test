"""Purchase order API routes."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from controllers import purchase_order_controller
from controllers.purchase_order_controller import (
    PurchaseOrderCreateBody,
    PurchaseOrderListItem,
    PurchaseOrderUpdateBody,
)
from core.auth_middleware import CurrentUser, require_permission
from core.database import get_db

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase-orders"])


@router.get("/", response_model=list[PurchaseOrderListItem])
async def list_purchase_orders_route(
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_PURCHASE_ORDERS)),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(200, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None),
    client_name: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    po_type: str | None = Query(None, description="quoted | non_quoted"),
):
    return await purchase_order_controller.handle_list_purchase_orders(
        db,
        limit=limit,
        offset=offset,
        search=search,
        client_name=client_name,
        date_from=date_from,
        date_to=date_to,
        po_type=po_type,
    )


@router.post("/")
async def create_purchase_order_route(
    body: PurchaseOrderCreateBody,
    user: CurrentUser = Depends(require_permission(Permission.CREATE_PURCHASE_ORDERS)),
    db: AsyncSession = Depends(get_db),
):
    return await purchase_order_controller.handle_create_purchase_order(body, db, user)


@router.get("/{po_id}")
async def get_purchase_order_route(
    po_id: str,
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_PURCHASE_ORDERS)),
    db: AsyncSession = Depends(get_db),
):
    return await purchase_order_controller.handle_get_purchase_order(db, po_id)


@router.patch("/{po_id}")
async def update_purchase_order_route(
    po_id: str,
    body: PurchaseOrderUpdateBody,
    _user: CurrentUser = Depends(require_permission(Permission.CREATE_PURCHASE_ORDERS)),
    db: AsyncSession = Depends(get_db),
):
    return await purchase_order_controller.handle_update_purchase_order(po_id, body, db)


@router.delete("/{po_id}")
async def delete_purchase_order_route(
    po_id: str,
    _user: CurrentUser = Depends(require_permission(Permission.DELETE_PURCHASE_ORDERS)),
    db: AsyncSession = Depends(get_db),
):
    return await purchase_order_controller.handle_delete_purchase_order(db, po_id)
