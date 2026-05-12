"""Request handling for enquiries.

Shapes HTTP responses, converts service exceptions to HTTP status codes.
No DB queries. No business logic. Calls services only.
"""

import asyncio
import logging
import uuid
from typing import AsyncGenerator

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_middleware import CurrentUser
from core.exceptions import EnquiryParseError, ProductNotFoundError
from db.models import Enquiry
from services import enquiry_service
from services.email_display_infer import infer_company_from_email_raw

logger = logging.getLogger(__name__)


# ── Pydantic request / response models ──────────────────────

class UploadEmailRequest(BaseModel):
    email_text: str
    input_type: str = "email"


class EnquiryResponse(BaseModel):
    enquiry_id: str
    status: str
    flow_type: str | None = None
    message: str
    quotation_id: str | None = None
    pdf_available: bool = False
    pdf_path: str | None = None
    clarification_questions: str | None = None
    quote_number: str | None = None
    subtotal: float | None = None
    total_amount: float | None = None
    line_items: list[dict] = []
    ai_reasoning: list[str] = []
    requires_human_review: bool = False


class EnquiryListItem(BaseModel):
    enquiry_id: str
    client_org_name: str = ""
    status: str
    flow_type: str | None = None
    input_type: str
    created_at: str
    created_by_name: str | None = None
    erp_export_available: bool = False


class ManualSelectedProduct(BaseModel):
    id: str
    name: str
    size_inch: float | None = None
    size_mm: float | None = None
    material: str | None = None
    base_price: float
    unit: str
    display_label: str | None = None


class ManualLineItemRequest(BaseModel):
    category: str
    cascadeSelections: dict[str, str] = {}
    selectedProduct: ManualSelectedProduct
    quantity: int = 1
    customer_discount_pct: float | None = None
    component_pricing: dict | None = None


class ManualNewClientRequest(BaseModel):
    company_name: str
    gst_number: str | None = None
    industry: str | None = None
    branch_name: str = "Head Office"
    contact_name: str = ""
    designation: str | None = None
    phone: str = ""
    email: str = ""
    city: str = ""
    state: str | None = None
    pincode: str | None = None
    address_line1: str | None = None
    country: str = "India"
    address: str = ""


class ManualSupplierPricingPayload(BaseModel):
    supplier_id: str
    supplier_name: str
    margin_multiplier: float
    subtotal: float
    gst_amount: float
    pf_amount: float
    grand_total: float


class ManualNewClientEmployeeRequest(BaseModel):
    """Optional contact to create under the new branch when submitting manual entry."""

    model_config = ConfigDict(populate_by_name=True)

    full_name: str = Field(..., alias="fullName")
    email: str | None = None


class ManualDropdownProcessRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    clientMode: str
    selectedClientId: str | None = None
    newClient: ManualNewClientRequest | None = None
    lineItems: list[ManualLineItemRequest]
    priority: str = "Normal"
    notes: str = ""
    supplier_pricing: ManualSupplierPricingPayload | None = Field(None, alias="supplierPricing")
    target_enquiry_id: str | None = Field(None, alias="targetEnquiryId")
    #: Branch contact person for this quote (must belong to selected branch unless newClientEmployee creates one).
    client_employee_id: str | None = Field(None, alias="clientEmployeeId")
    new_client_employee: ManualNewClientEmployeeRequest | None = Field(None, alias="newClientEmployee")

    @model_validator(mode="after")
    def validate_fields(self):
        mode = (self.clientMode or "").strip().lower()
        if mode not in ("existing", "new"):
            raise ValueError("clientMode must be 'existing' or 'new'")
        if mode == "existing" and not self.selectedClientId:
            raise ValueError("selectedClientId required for existing clientMode")
        if mode == "new" and not self.newClient:
            raise ValueError("newClient required for new clientMode")
        if not self.lineItems:
            raise ValueError("At least one line item is required")
        return self


class MatcherProcessResponse(EnquiryResponse):
    """Matcher run + optional auto-quote (same shape as EnquiryResponse with extras)."""

    model_config = ConfigDict(extra="ignore")

    matcher: dict = Field(default_factory=dict)
    product_completeness: str | None = None
    matcher_confidence: float | None = None


class EmailInboxItem(BaseModel):
    enquiry_id: str
    sender_name: str
    sender_email: str
    company: str
    display_name: str = ""
    subject: str
    preview: str
    category: str | None = None
    status: str
    flow_type: str | None = None
    confidence: float | None = None
    input_type: str
    created_at: str
    has_quotation: bool = False
    inbox_processed: bool = False
    awaiting_human: bool = False
    hitl_cycle: int = 0
    mailbox_id: str | None = None

# ── Controller functions ────────────────────────────────────


def _enquiry_client_org_name(e: Enquiry) -> str:
    """Display name for list rows: linked company via branch, else parsed enquiry fields."""
    branch = getattr(e, "branch", None)
    company = getattr(branch, "company", None) if branch is not None else None
    if company is not None and getattr(company, "company_name", None):
        name = str(company.company_name).strip()
        if name:
            return name
    pd = e.parsed_data
    if isinstance(pd, dict):
        for key in ("client_company", "company_name", "client_name", "organization", "org_name"):
            v = pd.get(key)
            if v is not None and str(v).strip():
                return str(v).strip()
    return ""


async def handle_upload_email(
    body: UploadEmailRequest,
    db: AsyncSession,
    user: CurrentUser,
) -> EnquiryResponse:
    enquiry_id = ""
    try:
        creator_id, creator_name = _quotation_creator_from_user(user)
        # Dedicated session + commit so the row is not held open by this request
        # while run_enquiry_flow uses another session (avoids PG duplicate-PK block).
        enquiry = await enquiry_service.create_enquiry(
            email_text=body.email_text,
            input_type=body.input_type,
            db=None,
            created_by_user_id=creator_id,
            created_by_name=creator_name,
        )
        enquiry_id = str(enquiry.id)
        result = await enquiry_service.process_enquiry(
            enquiry_id=enquiry_id,
            raw_input=body.email_text,
            input_type=body.input_type,
            db=db,
            emitter=None,
        )
        return EnquiryResponse(**result)
    except EnquiryParseError as e:
        return EnquiryResponse(
            enquiry_id=enquiry_id,
            status="failed",
            message=str(e),
        )
    except Exception as e:
        logger.exception("Unexpected error in handle_upload_email")
        raise HTTPException(status_code=500, detail=str(e))


async def handle_get_enquiry(
    enquiry_id: str,
    db: AsyncSession,
) -> dict:
    try:
        enquiry = await enquiry_service.get_enquiry(enquiry_id, db)
        pd = enquiry.parsed_data if isinstance(enquiry.parsed_data, dict) else {}
        co = str(pd.get("client_company", "") or "").strip()
        if not co or co.lower() == "unknown":
            co = infer_company_from_email_raw(enquiry.raw_input) or "Unknown"
        return {
            "enquiry_id": str(enquiry.id),
            "status": enquiry.status,
            "flow_type": enquiry.flow_type,
            "input_type": enquiry.input_type,
            "raw_input": enquiry.raw_input,
            "parsed_data": enquiry.parsed_data,
            "matched_products": enquiry.matched_products,
            "confidence_score": enquiry.confidence_score,
            "ai_reasoning": enquiry.ai_reasoning,
            "error_message": enquiry.error_message,
            "created_at": enquiry.created_at.isoformat() if enquiry.created_at else None,
            "display_company": co,
            "inbox_processed": enquiry_service.enquiry_inbox_pipeline_processed(enquiry),
            "processing_started_at": enquiry.processing_started_at.isoformat()
            if enquiry.processing_started_at
            else None,
            "processing_completed_at": enquiry.processing_completed_at.isoformat()
            if enquiry.processing_completed_at
            else None,
        }
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail=f"Enquiry {enquiry_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_get_erp_export(
    enquiry_id: str,
    db: AsyncSession,
) -> str:
    """Return absolute path to the generated ERP export XLSX for this enquiry."""
    try:
        return await enquiry_service.get_erp_export_path(enquiry_id, db)
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail="ERP export not found for this enquiry")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_list_enquiries(
    db: AsyncSession,
    status: str | None = None,
    flow_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
    company_id: str | None = None,
) -> list[EnquiryListItem]:
    try:
        enquiries = await enquiry_service.list_enquiries(
            db,
            status=status,
            flow_type=flow_type,
            limit=limit,
            offset=offset,
            company_id=company_id,
        )
        return [
            EnquiryListItem(
                enquiry_id=str(e.id),
                client_org_name=_enquiry_client_org_name(e),
                status=e.status,
                flow_type=e.flow_type,
                input_type=e.input_type,
                created_at=e.created_at.isoformat() if e.created_at else "",
                created_by_name=(e.created_by_name or "").strip() or None,
                erp_export_available=bool(getattr(e, "erp_export_path", None)),
            )
            for e in enquiries
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_process_email_matcher(
    enquiry_id: str,
    db: AsyncSession,
) -> MatcherProcessResponse:
    try:
        result = await enquiry_service.process_email_matcher(enquiry_id, db)
        return MatcherProcessResponse.model_validate(result)
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail=f"Enquiry {enquiry_id} not found")
    except Exception as e:
        logger.exception("process_email_matcher failed")
        raise HTTPException(status_code=500, detail=str(e))


async def handle_revert_request_email_draft(
    enquiry_id: str,
    db: AsyncSession,
) -> dict:
    try:
        enquiry = await enquiry_service.get_enquiry(enquiry_id, db)
        pd = enquiry.parsed_data if isinstance(enquiry.parsed_data, dict) else {}
        company = str(pd.get("client_company") or "Customer").strip()
        lines = [
            f"Subject: RE: RFQ — additional information required",
            "",
            f"Dear {company},",
            "",
            "Thank you for your enquiry. To prepare an accurate quotation, we need a few more product details (sizes, materials, end connections, quantities, delivery location, etc.).",
            "",
            "Could you please reply with the missing specifications?",
            "",
            "Best regards,",
            "Sales Team",
        ]
        return {
            "subject": f"RE: Additional details for your enquiry",
            "body": "\n".join(lines),
            "mailto_hint": "Use your mail client to send this message to the customer address from the enquiry.",
        }
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail=f"Enquiry {enquiry_id} not found")
    except Exception as e:
        logger.exception("revert draft email failed")
        raise HTTPException(status_code=500, detail=str(e))


def _quotation_creator_from_user(user: CurrentUser) -> tuple[uuid.UUID | None, str | None]:
    try:
        uid = uuid.UUID(str(user.id))
    except (ValueError, TypeError):
        uid = None
    raw = ((user.full_name or "").strip() or (user.email or "").strip()) or ""
    name = raw[:255] if raw else None
    return uid, name


async def handle_process_manual_dropdown(
    body: ManualDropdownProcessRequest,
    db: AsyncSession,
    user: CurrentUser,
) -> EnquiryResponse:
    """Manual dropdown processing: skip AI pipeline and generate quote directly."""
    try:
        creator_id, creator_name = _quotation_creator_from_user(user)
        result = await enquiry_service.process_manual_dropdown(
            body.model_dump(by_alias=True),
            db,
            created_by_user_id=creator_id,
            created_by_name=creator_name,
        )
        return EnquiryResponse(**result)
    except EnquiryParseError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Manual dropdown processing failed")
        raise HTTPException(status_code=500, detail=str(e))


async def handle_list_email_enquiries(
    db: AsyncSession,
    status: str | None,
    limit: int,
    offset: int,
    mailbox_id: str | None,
    user: CurrentUser,
) -> list[EmailInboxItem]:
    from services.mailbox_service import actor_can_view_mailbox, list_viewable_mailbox_ids

    try:
        mb_filter: uuid.UUID | None = None
        if mailbox_id:
            mb_filter = uuid.UUID(mailbox_id)
            if not await actor_can_view_mailbox(user, mb_filter, db):
                raise HTTPException(status_code=403, detail="No access to this mailbox")

        viewable = await list_viewable_mailbox_ids(user, db)
        is_sa = user.tier == "superadmin"
        items = await enquiry_service.list_email_enquiries(
            db,
            viewable_mailbox_ids=viewable,
            is_superadmin=is_sa,
            mailbox_id_filter=mb_filter,
            limit=limit,
            offset=offset,
            status=status,
        )
        return [EmailInboxItem(**x) for x in items]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_upload_email_stream(
    body: UploadEmailRequest,
    db: AsyncSession,
    user: CurrentUser,
) -> AsyncGenerator[str, None]:
    """Create emitter, kick off pipeline as background task, return stream."""
    from services.sse_service import SSEEventEmitter

    creator_id, creator_name = _quotation_creator_from_user(user)
    enquiry = await enquiry_service.create_enquiry(
        email_text=body.email_text,
        input_type=body.input_type,
        db=None,
        created_by_user_id=creator_id,
        created_by_name=creator_name,
    )

    emitter = SSEEventEmitter()

    await emitter.emit({
        "type": "enquiry_created",
        "agent": "system",
        "message": "Enquiry received — starting AI pipeline",
        "enquiry_id": str(enquiry.id),
        "status": "running",
    })

    asyncio.create_task(
        enquiry_service.process_enquiry(
            enquiry_id=str(enquiry.id),
            raw_input=body.email_text,
            input_type=body.input_type,
            db=db,
            emitter=emitter,
        )
    )

    return emitter.stream()


async def handle_get_clients(search: str | None = None) -> list[dict]:
    try:
        return await enquiry_service.list_clients(search)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
