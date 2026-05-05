"""Request handling for quotations.

Shapes HTTP responses, converts service exceptions to HTTP status codes.
No DB queries. No business logic. Calls services only.
"""

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ProductNotFoundError, QuotationBuildError
from services import quotation_service


# ── Pydantic response models ────────────────────────────────

class QuotationListItem(BaseModel):
    quotation_id: str
    quote_number: str
    client_name: str
    total_amount: float
    status: str
    created_at: str


class QuotationHistoryItem(BaseModel):
    quotation_id: str
    enquiry_id: str
    quote_number: str
    quoted_at: str
    client_name: str | None
    client_company: str | None
    unit_price: float
    quantity: int
    line_total: float
    currency: str
    category: str
    product: dict


class QuotationHistoryResponse(BaseModel):
    total: int
    items: list[QuotationHistoryItem]


class QuotationUpdateLineItemsBody(BaseModel):
    """Same ``lineItems`` shape as ``POST /api/enquiries/manual/process``."""

    lineItems: list[dict] = Field(default_factory=list)


# ── Controller functions ────────────────────────────────────

async def handle_patch_quotation_line_items(
    quotation_id: str,
    body: QuotationUpdateLineItemsBody,
    db: AsyncSession,
) -> dict:
    try:
        q = await quotation_service.update_quotation_from_manual_line_items(
            quotation_id,
            body.lineItems,
            db,
        )
        return {
            "quotation_id": str(q.id),
            "enquiry_id": str(q.enquiry_id),
            "quote_number": q.quote_number,
            "client_name": q.client_name,
            "client_company": q.client_company,
            "client_email": q.client_email,
            "client_phone": q.client_phone,
            "line_items": q.line_items,
            "subtotal": q.subtotal,
            "gst_rate": q.gst_rate,
            "gst_amount": q.gst_amount,
            "pf_rate": q.pf_rate,
            "pf_amount": q.pf_amount,
            "freight_note": q.freight_note,
            "total_amount": q.total_amount,
            "validity_days": q.validity_days,
            "status": q.status,
            "pdf_path": q.pdf_path,
            "notes": q.notes,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        }
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Quotation not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_get_quotation(
    quotation_id: str,
    db: AsyncSession,
) -> dict:
    try:
        q = await quotation_service.get_quotation(quotation_id, db)
        return {
            "quotation_id": str(q.id),
            "enquiry_id": str(q.enquiry_id),
            "quote_number": q.quote_number,
            "client_name": q.client_name,
            "client_company": q.client_company,
            "client_email": q.client_email,
            "client_phone": q.client_phone,
            "line_items": q.line_items,
            "subtotal": q.subtotal,
            "gst_rate": q.gst_rate,
            "gst_amount": q.gst_amount,
            "pf_rate": q.pf_rate,
            "pf_amount": q.pf_amount,
            "freight_note": q.freight_note,
            "total_amount": q.total_amount,
            "validity_days": q.validity_days,
            "status": q.status,
            "pdf_path": q.pdf_path,
            "notes": q.notes,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        }
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Quotation not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_get_quotation_pdf(
    quotation_id: str,
    db: AsyncSession,
) -> str:
    try:
        return await quotation_service.get_quotation_pdf_path(quotation_id, db)
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Quotation not found")
    except QuotationBuildError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_list_quotations(
    db: AsyncSession,
    limit: int = 50,
    offset: int = 0,
) -> list[QuotationListItem]:
    try:
        quotations = await quotation_service.list_quotations(db, limit=limit, offset=offset)
        return [
            QuotationListItem(
                quotation_id=str(q.id),
                quote_number=q.quote_number,
                client_name=q.client_name,
                total_amount=q.total_amount,
                status=q.status,
                created_at=q.created_at.isoformat() if q.created_at else "",
            )
            for q in quotations
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_get_product_quote_history(
    db: AsyncSession,
    *,
    category: str,
    catalog_table: str | None = None,
    catalog_row_id: str | None = None,
    variant_type: str | None = None,
    construction: str | None = None,
    valve_size: str | None = None,
    end_connection: str | None = None,
    pressure: str | None = None,
    body: str | None = None,
    ball_disc: str | None = None,
    stem: str | None = None,
    seat: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> QuotationHistoryResponse:
    try:
        total, rows = await quotation_service.get_product_quote_history(
            db,
            category=category,
            catalog_table=catalog_table,
            catalog_row_id=catalog_row_id,
            variant_type=variant_type,
            construction=construction,
            valve_size=valve_size,
            end_connection=end_connection,
            pressure=pressure,
            body=body,
            ball_disc=ball_disc,
            stem=stem,
            seat=seat,
            limit=limit,
            offset=offset,
        )
        return QuotationHistoryResponse(
            total=total,
            items=[
                QuotationHistoryItem(
                    quotation_id=str(r.quotation_id),
                    enquiry_id=str(r.enquiry_id),
                    quote_number=r.quote_number,
                    quoted_at=r.quoted_at.isoformat() if r.quoted_at else "",
                    client_name=r.client_name,
                    client_company=r.client_company,
                    unit_price=float(r.unit_price or 0),
                    quantity=int(r.quantity or 0),
                    line_total=float(r.line_total or 0),
                    currency=r.currency or "INR",
                    category=r.category,
                    product={
                        "catalog_table": r.catalog_table,
                        "catalog_row_id": str(r.catalog_row_id) if r.catalog_row_id else None,
                        "variant_type": r.variant_type,
                        "construction": r.construction,
                        "valve_size": r.valve_size,
                        "end_connection": r.end_connection,
                        "pressure": r.pressure,
                        "body": r.body,
                        "ball_disc": r.ball_disc,
                        "stem": r.stem,
                        "seat": r.seat,
                    },
                )
                for r in rows
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
