"""HTTP handlers for purchase orders."""

import uuid
from datetime import date

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_middleware import CurrentUser
from core.exceptions import ProductNotFoundError
from db.models import PurchaseOrder
from services import purchase_order_service


def _po_api_dict(po: PurchaseOrder) -> dict:
    po_type = "quoted" if po.quotation_id else "non_quoted"
    return {
        "po_id": str(po.id),
        "po_number": po.po_number,
        "so_number": po.so_number,
        "quotation_id": str(po.quotation_id) if po.quotation_id else None,
        "quote_number": po.quote_number,
        "po_type": po_type,
        "client_name": po.client_name,
        "client_company": po.client_company,
        "client_email": po.client_email,
        "client_phone": po.client_phone,
        "client_employee_id": str(po.client_employee_id) if po.client_employee_id else None,
        "line_items": po.line_items if isinstance(po.line_items, list) else [],
        "subtotal": po.subtotal,
        "gst_rate": po.gst_rate,
        "gst_amount": po.gst_amount,
        "pf_rate": po.pf_rate,
        "pf_amount": po.pf_amount,
        "freight_note": po.freight_note,
        "freight_amount": po.freight_amount,
        "freight_rate": float(po.freight_rate) if po.freight_rate is not None else None,
        "total_amount": po.total_amount,
        "primary_category": po.primary_category,
        "item_desc_short": po.item_desc_short,
        "financial_config": po.financial_config if isinstance(po.financial_config, dict) else None,
        "pdf_path": po.pdf_path,
        "notes": po.notes,
        "created_at": po.created_at.isoformat() if po.created_at else None,
        "created_by_name": (po.created_by_name or "").strip() or None,
        "created_by_email": (
            str(po.created_by_user.email).strip()
            if getattr(po, "created_by_user", None) is not None and getattr(po.created_by_user, "email", None)
            else None
        ),
    }


class PurchaseOrderListItem(BaseModel):
    po_id: str
    po_number: str
    created_at: str
    client_name: str
    client_company: str | None = None
    po_type: str
    quote_number: str | None = None
    quotation_id: str | None = None
    primary_category: str
    item_desc_short: str
    total_amount: float
    so_number: str | None = None
    created_by_name: str | None = None


class PurchaseOrderSelectedLine(BaseModel):
    line_index: int = Field(..., ge=0)
    quantity: int = Field(..., ge=1)
    unit_price: float = Field(..., ge=0)
    quoted_unit_price: float | None = None


class PurchaseOrderCreateBody(BaseModel):
    quotation_id: str | None = Field(None, alias="quotationId")
    selected_lines: list[PurchaseOrderSelectedLine] | None = Field(None, alias="selectedLines")
    manual_line_items: list | None = Field(None, alias="manualLineItems")
    client_name: str | None = Field(None, alias="clientName")
    client_company: str | None = Field(None, alias="clientCompany")
    client_email: str | None = Field(None, alias="clientEmail")
    client_phone: str | None = Field(None, alias="clientPhone")
    client_employee_id: str | None = Field(None, alias="clientEmployeeId")
    so_number: str | None = Field(None, alias="soNumber")
    notes: str | None = None
    freight_note: str | None = Field(None, alias="freightNote")
    pf_applicable: bool = Field(True, alias="pfApplicable")
    pf_mode: str = Field("percent", alias="pfMode")
    pf_draft: str = Field("3", alias="pfDraft")
    freight_applicable: bool = Field(True, alias="freightApplicable")
    freight_mode: str = Field("percent", alias="freightMode")
    freight_draft: str = Field("", alias="freightDraft")
    cgst_applicable: bool = Field(True, alias="cgstApplicable")
    cgst_mode: str = Field("percent", alias="cgstMode")
    cgst_draft: str = Field("9", alias="cgstDraft")
    sgst_applicable: bool = Field(True, alias="sgstApplicable")
    sgst_mode: str = Field("percent", alias="sgstMode")
    sgst_draft: str = Field("9", alias="sgstDraft")
    igst_applicable: bool = Field(False, alias="igstApplicable")
    igst_mode: str = Field("percent", alias="igstMode")
    igst_draft: str = Field("18", alias="igstDraft")

    model_config = {"populate_by_name": True}


class PurchaseOrderUpdateBody(BaseModel):
    selected_lines: list[PurchaseOrderSelectedLine] | None = Field(None, alias="selectedLines")
    manual_line_items: list | None = Field(None, alias="manualLineItems")
    client_name: str | None = Field(None, alias="clientName")
    client_company: str | None = Field(None, alias="clientCompany")
    client_email: str | None = Field(None, alias="clientEmail")
    client_phone: str | None = Field(None, alias="clientPhone")
    client_employee_id: str | None = Field(None, alias="clientEmployeeId")
    so_number: str | None = Field(None, alias="soNumber")
    notes: str | None = None
    freight_note: str | None = Field(None, alias="freightNote")
    pf_applicable: bool | None = Field(None, alias="pfApplicable")
    pf_mode: str | None = Field(None, alias="pfMode")
    pf_draft: str | None = Field(None, alias="pfDraft")
    freight_applicable: bool | None = Field(None, alias="freightApplicable")
    freight_mode: str | None = Field(None, alias="freightMode")
    freight_draft: str | None = Field(None, alias="freightDraft")
    cgst_applicable: bool | None = Field(None, alias="cgstApplicable")
    cgst_mode: str | None = Field(None, alias="cgstMode")
    cgst_draft: str | None = Field(None, alias="cgstDraft")
    sgst_applicable: bool | None = Field(None, alias="sgstApplicable")
    sgst_mode: str | None = Field(None, alias="sgstMode")
    sgst_draft: str | None = Field(None, alias="sgstDraft")
    igst_applicable: bool | None = Field(None, alias="igstApplicable")
    igst_mode: str | None = Field(None, alias="igstMode")
    igst_draft: str | None = Field(None, alias="igstDraft")

    model_config = {"populate_by_name": True}


async def handle_list_purchase_orders(
    db: AsyncSession,
    *,
    limit: int = 200,
    offset: int = 0,
    search: str | None = None,
    client_name: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    po_type: str | None = None,
) -> list[dict]:
    rows = await purchase_order_service.list_purchase_orders(
        db,
        limit=limit,
        offset=offset,
        search=search,
        client_name=client_name,
        date_from=date_from,
        date_to=date_to,
        po_type=po_type,
    )
    return [
        {
            "po_id": str(po.id),
            "po_number": po.po_number,
            "created_at": po.created_at.isoformat() if po.created_at else "",
            "client_name": po.client_name,
            "client_company": po.client_company,
            "po_type": "quoted" if po.quotation_id else "non_quoted",
            "quote_number": po.quote_number,
            "quotation_id": str(po.quotation_id) if po.quotation_id else None,
            "primary_category": po.primary_category,
            "item_desc_short": po.item_desc_short,
            "total_amount": po.total_amount,
            "so_number": po.so_number,
            "created_by_name": po.created_by_name,
        }
        for po in rows
    ]


async def handle_get_purchase_order(db: AsyncSession, po_id: str) -> dict:
    try:
        po = await purchase_order_service.get_purchase_order(db, po_id)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _po_api_dict(po)


async def handle_create_purchase_order(
    body: PurchaseOrderCreateBody,
    db: AsyncSession,
    user: CurrentUser,
) -> dict:
    payload = body.model_dump()
    payload["financial"] = {
        "pf_applicable": body.pf_applicable,
        "pf_mode": body.pf_mode,
        "pf_draft": body.pf_draft,
        "freight_applicable": body.freight_applicable,
        "freight_mode": body.freight_mode,
        "freight_draft": body.freight_draft,
        "cgst_applicable": body.cgst_applicable,
        "cgst_mode": body.cgst_mode,
        "cgst_draft": body.cgst_draft,
        "sgst_applicable": body.sgst_applicable,
        "sgst_mode": body.sgst_mode,
        "sgst_draft": body.sgst_draft,
        "igst_applicable": body.igst_applicable,
        "igst_mode": body.igst_mode,
        "igst_draft": body.igst_draft,
    }
    try:
        po = await purchase_order_service.create_purchase_order(
            db,
            payload,
            user_id=uuid.UUID(user.id),
            user_name=user.full_name or user.email,
            user_email=user.email,
        )
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _po_api_dict(po)


async def handle_update_purchase_order(
    po_id: str,
    body: PurchaseOrderUpdateBody,
    db: AsyncSession,
) -> dict:
    payload = body.model_dump(exclude_unset=True)
    try:
        po = await purchase_order_service.update_purchase_order(db, po_id, payload)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _po_api_dict(po)


async def handle_delete_purchase_order(db: AsyncSession, po_id: str) -> dict:
    try:
        deleted_id = await purchase_order_service.delete_purchase_order(db, po_id)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"po_id": deleted_id, "deleted": True}
