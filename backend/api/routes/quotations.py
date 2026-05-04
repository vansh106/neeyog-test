"""Route definitions for quotation endpoints — thin router, no logic."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from controllers import quotation_controller
from controllers.quotation_controller import QuotationHistoryResponse, QuotationListItem
from core.auth_middleware import CurrentUser, require_permission
from core.database import get_db

router = APIRouter(prefix="/api/quotations", tags=["quotations"])


@router.get("/history", response_model=QuotationHistoryResponse)
async def get_product_quote_history_route(
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    category: str = Query(..., description="Product category key, e.g. butterfly_valve"),
    catalog_table: str | None = Query(None, description="Exact match: catalog table key"),
    catalog_row_id: str | None = Query(None, description="Exact match: catalog row UUID"),
    variant_type: str | None = Query(None),
    construction: str | None = Query(None),
    valve_size: str | None = Query(None),
    end_connection: str | None = Query(None),
    pressure: str | None = Query(None),
    body: str | None = Query(None),
    ball_disc: str | None = Query(None),
    stem: str | None = Query(None),
    seat: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await quotation_controller.handle_get_product_quote_history(
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


@router.get("/{quotation_id}/pdf")
async def get_quotation_pdf_route(
    quotation_id: str,
    _user: CurrentUser = Depends(require_permission(Permission.DOWNLOAD_PDF)),
    db: AsyncSession = Depends(get_db),
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
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    return await quotation_controller.handle_get_quotation(quotation_id, db)


@router.get("/", response_model=list[QuotationListItem])
async def list_quotations_route(
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    return await quotation_controller.handle_list_quotations(db, limit, offset)
