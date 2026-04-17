"""Route definitions for quotation endpoints — thin router, no logic."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from controllers import quotation_controller
from controllers.quotation_controller import QuotationListItem
from config.permissions import Permission
from core.auth_middleware import require_permission
from core.database import get_db

router = APIRouter(prefix="/api/quotations", tags=["quotations"])


@router.get("/{quotation_id}/pdf")
async def get_quotation_pdf_route(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.DOWNLOAD_PDF)),
):
    pdf_path = await quotation_controller.handle_get_quotation_pdf(quotation_id, db)
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"quotation_{quotation_id}.pdf",
    )


@router.get("/{quotation_id}")
async def get_quotation_route(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.VIEW_QUOTATIONS)),
):
    return await quotation_controller.handle_get_quotation(quotation_id, db)


@router.get("/", response_model=list[QuotationListItem])
async def list_quotations_route(
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.VIEW_QUOTATIONS)),
):
    return await quotation_controller.handle_list_quotations(db, limit, offset)
