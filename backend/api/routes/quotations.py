"""Route definitions for quotation endpoints — thin router, no logic."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from controllers import quotation_controller
from controllers.quotation_controller import (
    QuotationAuditResponse,
    QuotationCrmStatusBody,
    QuotationFinancialSummaryBody,
    QuotationHistoryResponse,
    QuotationListingDatesBody,
    QuotationListItem,
    QuotationPdfDisplayBody,
    QuotationTermCreateBody,
    QuotationUpdateLineItemsBody,
)
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


@router.get("/terms-master")
async def list_quotation_terms_master_route(
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    return await quotation_controller.handle_list_quotation_term_templates(db)


@router.post("/terms-master")
async def create_quotation_term_master_route(
    body: QuotationTermCreateBody,
    user: CurrentUser = Depends(require_permission(Permission.APPROVE_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    return await quotation_controller.handle_create_quotation_term_template(body, db, user)


@router.patch("/{quotation_id}/financial-summary")
async def patch_quotation_financial_summary_route(
    quotation_id: str,
    body: QuotationFinancialSummaryBody,
    user: CurrentUser = Depends(require_permission(Permission.APPROVE_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    return await quotation_controller.handle_patch_quotation_financial_summary(
        quotation_id, body, db, user
    )


@router.patch("/{quotation_id}")
async def patch_quotation_line_items_route(
    quotation_id: str,
    body: QuotationUpdateLineItemsBody,
    user: CurrentUser = Depends(require_permission(Permission.APPROVE_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    """Rebuild quote lines from manual configurator payloads (same shape as manual dropdown)."""
    return await quotation_controller.handle_patch_quotation_line_items(quotation_id, body, db, user)


@router.patch("/{quotation_id}/pdf-display")
async def patch_quotation_pdf_display_route(
    quotation_id: str,
    body: QuotationPdfDisplayBody,
    user: CurrentUser = Depends(require_permission(Permission.APPROVE_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    """PDF-only text overlays for this quotation; regenerates the stored PDF."""
    return await quotation_controller.handle_patch_quotation_pdf_display(quotation_id, body, db, user)


@router.patch("/{quotation_id}/crm-status")
async def patch_quotation_crm_status_route(
    quotation_id: str,
    body: QuotationCrmStatusBody,
    user: CurrentUser = Depends(require_permission(Permission.APPROVE_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    """CRM status on the quotation list (PO received, Ongoing, Lost, Hold + remarks)."""
    return await quotation_controller.handle_patch_quotation_crm_status(quotation_id, body, db, user)


@router.patch("/{quotation_id}/listing-dates")
async def patch_quotation_listing_dates_route(
    quotation_id: str,
    body: QuotationListingDatesBody,
    user: CurrentUser = Depends(require_permission(Permission.APPROVE_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    """Validity and next follow-up dates on the quotation list."""
    return await quotation_controller.handle_patch_quotation_listing_dates(quotation_id, body, db, user)


@router.get("/{quotation_id}/audit", response_model=QuotationAuditResponse)
async def get_quotation_audit_route(
    quotation_id: str,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await quotation_controller.handle_get_quotation_audit(quotation_id, db, user, limit=limit)


@router.get("/{quotation_id}/pdf")
async def get_quotation_pdf_route(
    quotation_id: str,
    user: CurrentUser = Depends(require_permission(Permission.DOWNLOAD_PDF)),
    db: AsyncSession = Depends(get_db),
):
    pdf_path = await quotation_controller.handle_get_quotation_pdf(quotation_id, db, user)
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"quotation_{quotation_id}.pdf",
    )


@router.get("/{quotation_id}")
async def get_quotation_route(
    quotation_id: str,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    return await quotation_controller.handle_get_quotation(quotation_id, db, user)


@router.get("/", response_model=list[QuotationListItem])
async def list_quotations_route(
    user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    limit: int = Query(50, le=2000),
    offset: int = Query(0),
    search: str | None = Query(None, description="Quote number or client (partial)"),
    client_name: str | None = Query(None, description="Filter by client name or company (partial)"),
    status: str | None = Query(None, description="po_received | ongoing | lost | hold"),
    date_from: date | None = Query(None, description="Created on/after (UTC date)"),
    date_to: date | None = Query(None, description="Created on/before (UTC date)"),
    db: AsyncSession = Depends(get_db),
):
    return await quotation_controller.handle_list_quotations(
        db,
        user,
        limit,
        offset,
        search=search,
        client_name=client_name,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )
