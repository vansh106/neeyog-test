"""Route definitions for enquiry endpoints — thin router, no logic."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from controllers import enquiry_controller
from controllers.enquiry_controller import (
    ClientHITLDecisionRequest,
    ClientVerificationResponse,
    EmailInboxItem,
    EnquiryListItem,
    EnquiryResponse,
    HITLDecisionRequest,
    HITLStateResponse,
    ProductHITLDecisionRequest,
    ManualDropdownProcessRequest,
    UploadEmailRequest,
)
from core.auth_middleware import require_permission
from core.database import get_db
from pathlib import Path

router = APIRouter(prefix="/api/enquiries", tags=["enquiries"])


@router.post("/upload-email", response_model=EnquiryResponse)
async def upload_email_route(
    body: UploadEmailRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.UPLOAD_EMAIL)),
):
    return await enquiry_controller.handle_upload_email(body, db)


@router.post("/upload-email-stream")
async def upload_email_stream_route(
    body: UploadEmailRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.UPLOAD_EMAIL)),
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
    _user=Depends(require_permission(Permission.UPLOAD_EMAIL)),
):
    return await enquiry_controller.handle_process_manual_dropdown(body, db)


@router.get("/", response_model=list[EnquiryListItem])
async def list_enquiries_route(
    status: str | None = Query(None),
    flow_type: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.VIEW_ENQUIRIES)),
):
    return await enquiry_controller.handle_list_enquiries(db, status, flow_type, limit, offset)


@router.get("/emails/inbox", response_model=list[EmailInboxItem])
async def list_email_inbox_route(
    status: str | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.VIEW_ENQUIRIES)),
):
    return await enquiry_controller.handle_list_email_enquiries(db, status, limit, offset)


@router.get("/{enquiry_id}/hitl-state", response_model=HITLStateResponse)
async def get_hitl_state_route(enquiry_id: str, _user=Depends(require_permission(Permission.VIEW_ENQUIRIES))):
    return await enquiry_controller.handle_get_hitl_state(enquiry_id)


@router.post("/{enquiry_id}/review")
async def submit_review_route(
    enquiry_id: str,
    body: HITLDecisionRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.HITL_APPROVE)),
):
    return await enquiry_controller.handle_submit_review(enquiry_id, body, db)


@router.post("/{enquiry_id}/review-stream")
async def submit_review_stream_route(
    enquiry_id: str,
    body: HITLDecisionRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.HITL_APPROVE)),
):
    stream = await enquiry_controller.handle_submit_review_stream(enquiry_id, body, db)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/clients/search")
async def search_clients_route(
    q: str | None = Query(None),
    _user=Depends(require_permission(Permission.CLIENT_VIEW)),
):
    return await enquiry_controller.handle_get_clients(q)


@router.post("/{enquiry_id}/client-verify", response_model=ClientVerificationResponse)
async def client_verify_route(
    enquiry_id: str,
    body: ClientHITLDecisionRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.CLIENT_VERIFY)),
):
    return await enquiry_controller.handle_client_verification(enquiry_id, body, db)


@router.post("/{enquiry_id}/client-verify-stream")
async def client_verify_stream_route(
    enquiry_id: str,
    body: ClientHITLDecisionRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.CLIENT_VERIFY)),
):
    stream = await enquiry_controller.handle_client_verification_stream(enquiry_id, body, db)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.post("/{enquiry_id}/product-complete")
async def product_complete_route(
    enquiry_id: str,
    body: ProductHITLDecisionRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.HITL_APPROVE)),
):
    return await enquiry_controller.handle_product_completion(enquiry_id, body, db)


@router.post("/{enquiry_id}/product-complete-stream")
async def product_complete_stream_route(
    enquiry_id: str,
    body: ProductHITLDecisionRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.HITL_APPROVE)),
):
    stream = await enquiry_controller.handle_product_completion_stream(enquiry_id, body, db)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/{enquiry_id}/erp-export")
async def get_erp_export_route(
    enquiry_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.ERP_DOWNLOAD)),
):
    path = await enquiry_controller.handle_get_erp_export_path(enquiry_id, db)
    return FileResponse(
        path=path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=Path(path).name,
    )


@router.get("/{enquiry_id}")
async def get_enquiry_route(
    enquiry_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.VIEW_ENQUIRIES)),
):
    return await enquiry_controller.handle_get_enquiry(enquiry_id, db)
