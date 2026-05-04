"""Route definitions for enquiry endpoints — thin router, no logic."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from controllers import enquiry_controller
from controllers.enquiry_controller import (
    EmailInboxItem,
    EnquiryListItem,
    EnquiryResponse,
    ManualDropdownProcessRequest,
    UploadEmailRequest,
)
from core.auth_middleware import CurrentUser, require_permission
from core.database import get_db

router = APIRouter(prefix="/api/enquiries", tags=["enquiries"])


@router.post("/upload-email", response_model=EnquiryResponse)
async def upload_email_route(
    body: UploadEmailRequest,
    _user: CurrentUser = Depends(require_permission(Permission.UPLOAD_EMAIL)),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_upload_email(body, db)


@router.post("/upload-email-stream")
async def upload_email_stream_route(
    body: UploadEmailRequest,
    _user: CurrentUser = Depends(require_permission(Permission.UPLOAD_EMAIL)),
    db: AsyncSession = Depends(get_db),
):
    stream = await enquiry_controller.handle_upload_email_stream(body, db)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.post("/manual/process", response_model=EnquiryResponse)
async def manual_dropdown_process_route(
    body: ManualDropdownProcessRequest,
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_QUOTATIONS)),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_process_manual_dropdown(body, db)


@router.get("/", response_model=list[EnquiryListItem])
async def list_enquiries_route(
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    status: str | None = Query(None),
    flow_type: str | None = Query(None),
    company_id: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_list_enquiries(
        db, status, flow_type, limit, offset, company_id=company_id
    )


@router.get("/emails/inbox", response_model=list[EmailInboxItem])
async def list_email_inbox_route(
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    status: str | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_list_email_enquiries(db, status, limit, offset)


@router.get("/clients/search")
async def search_clients_route(
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    q: str | None = Query(None),
):
    return await enquiry_controller.handle_get_clients(q)


@router.get("/{enquiry_id}")
async def get_enquiry_route(
    enquiry_id: str,
    _user: CurrentUser = Depends(require_permission(Permission.VIEW_ENQUIRIES)),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_get_enquiry(enquiry_id, db)


@router.get("/{enquiry_id}/erp-export")
async def get_enquiry_erp_export_route(
    enquiry_id: str,
    _user: CurrentUser = Depends(require_permission(Permission.ERP_DOWNLOAD)),
    db: AsyncSession = Depends(get_db),
):
    path = await enquiry_controller.handle_get_erp_export(enquiry_id, db)
    return FileResponse(
        path=path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"EnquiryList_{enquiry_id}.xlsx",
    )
