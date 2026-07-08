"""Route definitions for enquiry endpoints — thin router, no logic."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from controllers import enquiry_controller
from controllers.enquiry_controller import (
    EmailApprovalRequest,
    EmailApprovalResponse,
    EmailInboxItem,
    EnquiryAssignUserBody,
    EnquiryListItem,
    EnquiryDetailTypeBody,
    EnquiryListingDatesBody,
    EnquiryProductNotesBody,
    EnquiryQuoteStatusBody,
    EnquiryResponse,
    ManualDropdownProcessRequest,
    ManualEnquiryCreateRequest,
    MatcherProcessResponse,
    UploadEmailRequest,
)
from core.auth_middleware import CurrentUser, require_permission
from core.database import get_db

router = APIRouter(prefix="/api/enquiries", tags=["enquiries"])


@router.post("/upload-email", response_model=EnquiryResponse)
async def upload_email_route(
    body: UploadEmailRequest,
    user: CurrentUser = Depends(require_permission(Permission.UPLOAD_EMAIL)),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_upload_email(body, db, user)


@router.post("/upload-email-stream")
async def upload_email_stream_route(
    body: UploadEmailRequest,
    user: CurrentUser = Depends(require_permission(Permission.UPLOAD_EMAIL)),
    db: AsyncSession = Depends(get_db),
):
    stream = await enquiry_controller.handle_upload_email_stream(body, db, user)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.post("/manual/create", response_model=EnquiryResponse)
async def manual_enquiry_create_route(
    body: ManualEnquiryCreateRequest,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_create_manual_enquiry(body, db, user)


@router.post("/manual/process", response_model=EnquiryResponse)
async def manual_dropdown_process_route(
    body: ManualDropdownProcessRequest,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_process_manual_dropdown(body, db, user)


@router.get("/", response_model=list[EnquiryListItem])
async def list_enquiries_route(
    user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    status: str | None = Query(None),
    flow_type: str | None = Query(None),
    company_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_list_enquiries(
        db, user, status, flow_type, limit, offset, company_id=company_id
    )


@router.get("/emails/inbox", response_model=list[EmailInboxItem])
async def list_email_inbox_route(
    user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    status: str | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    mailbox_id: str | None = Query(None, description="Filter to one connected mailbox"),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_list_email_enquiries(db, status, limit, offset, mailbox_id, user)


@router.get("/clients/search")
async def search_clients_route(
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    q: str | None = Query(None),
):
    return await enquiry_controller.handle_get_clients(q)


@router.patch("/{enquiry_id}/listing-dates")
async def patch_enquiry_listing_dates_route(
    enquiry_id: str,
    body: EnquiryListingDatesBody,
    user: CurrentUser = Depends(require_permission(Permission.APPROVE_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    """Next follow-up date on the enquiry list."""
    return await enquiry_controller.handle_patch_enquiry_listing_dates(enquiry_id, body, db, user)


@router.patch("/{enquiry_id}/product-notes")
async def patch_enquiry_product_notes_route(
    enquiry_id: str,
    body: EnquiryProductNotesBody,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    """Update structured product notes on an enquiry."""
    return await enquiry_controller.handle_patch_enquiry_product_notes(enquiry_id, body, db, user)


@router.patch("/{enquiry_id}/detail-type")
async def patch_enquiry_detail_type_route(
    enquiry_id: str,
    body: EnquiryDetailTypeBody,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    """Update whether client/product details were complete at intake."""
    return await enquiry_controller.handle_patch_enquiry_detail_type(enquiry_id, body, db, user)


@router.patch("/{enquiry_id}/quote-status")
async def patch_enquiry_quote_status_route(
    enquiry_id: str,
    body: EnquiryQuoteStatusBody,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    """Update enquiry listing quote status (Not Quoted / Quoted)."""
    return await enquiry_controller.handle_patch_enquiry_quote_status(enquiry_id, body, db, user)


@router.patch("/{enquiry_id}/assign-user")
async def assign_enquiry_user_route(
    enquiry_id: str,
    body: EnquiryAssignUserBody,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    db: AsyncSession = Depends(get_db),
):
    """Reassign enquiry ownership to another user (admin / superadmin only)."""
    return await enquiry_controller.handle_assign_enquiry_user(enquiry_id, body, db, user)


@router.post("/{enquiry_id}/archive")
async def archive_enquiry_route(
    enquiry_id: str,
    user: CurrentUser = Depends(require_permission(Permission.DELETE_ENQUIRIES)),
    db: AsyncSession = Depends(get_db),
):
    """Soft-archive an enquiry and its quotations (excluded from analytics)."""
    return await enquiry_controller.handle_archive_enquiry(enquiry_id, db, user)


@router.post("/{enquiry_id}/email-approval", response_model=EmailApprovalResponse)
async def email_approval_route(
    enquiry_id: str,
    body: EmailApprovalRequest,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_decide_email_approval(enquiry_id, body, db, user)


@router.post("/{enquiry_id}/process-matcher", response_model=MatcherProcessResponse)
async def process_email_matcher_route(
    enquiry_id: str,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_process_email_matcher(enquiry_id, db, user)


@router.get("/{enquiry_id}/revert-request-draft")
async def revert_request_draft_route(
    enquiry_id: str,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_revert_request_email_draft(enquiry_id, db, user)


@router.get("/{enquiry_id}")
async def get_enquiry_route(
    enquiry_id: str,
    user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_get_enquiry(enquiry_id, db, user)


@router.get("/{enquiry_id}/erp-export")
async def get_enquiry_erp_export_route(
    enquiry_id: str,
    user: CurrentUser = Depends(require_permission(Permission.ERP_DOWNLOAD)),
    db: AsyncSession = Depends(get_db),
):
    path = await enquiry_controller.handle_get_erp_export(enquiry_id, db, user)
    return FileResponse(
        path=path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"EnquiryList_{enquiry_id}.xlsx",
    )
