"""Request handling for quotations.

Shapes HTTP responses, converts service exceptions to HTTP status codes.
No DB queries. No business logic. Calls services only.
"""

from fastapi import HTTPException
from pydantic import BaseModel
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


# ── Controller functions ────────────────────────────────────

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
