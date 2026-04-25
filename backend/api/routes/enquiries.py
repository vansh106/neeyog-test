"""Route definitions for enquiry endpoints — thin router, no logic."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from controllers import enquiry_controller
from controllers.enquiry_controller import (
    EmailInboxItem,
    EnquiryListItem,
    EnquiryResponse,
    ManualDropdownProcessRequest,
    UploadEmailRequest,
)
from core.database import get_db

router = APIRouter(prefix="/api/enquiries", tags=["enquiries"])


@router.post("/upload-email", response_model=EnquiryResponse)
async def upload_email_route(
    body: UploadEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_upload_email(body, db)


@router.post("/upload-email-stream")
async def upload_email_stream_route(
    body: UploadEmailRequest,
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
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_process_manual_dropdown(body, db)


@router.get("/", response_model=list[EnquiryListItem])
async def list_enquiries_route(
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
    status: str | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_list_email_enquiries(db, status, limit, offset)


@router.get("/clients/search")
async def search_clients_route(
    q: str | None = Query(None),
):
    return await enquiry_controller.handle_get_clients(q)


@router.get("/{enquiry_id}")
async def get_enquiry_route(
    enquiry_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await enquiry_controller.handle_get_enquiry(enquiry_id, db)
