"""Request handling for enquiries.

Shapes HTTP responses, converts service exceptions to HTTP status codes.
No DB queries. No business logic. Calls services only.
"""

import asyncio
import logging
import uuid
from datetime import date
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
    enquiry_number: str | None = None
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
    enquiry_number: str | None = None
    client_org_name: str = ""
    status: str
    flow_type: str | None = None
    input_type: str
    source: str = "manual"
    item_desc_short: str = "—"
    item_desc_lines: list[dict[str, str]] = Field(default_factory=list)
    quotation_id: str | None = None
    quote_number: str | None = None
    next_follow_up_date: str | None = None
    created_at: str
    created_by_user_id: str | None = None
    created_by_name: str | None = None
    erp_export_available: bool = False
    category: str | None = None
    items_search_text: str = ""
    is_non_standard_customer: bool = False
    series: str | None = None
    is_sales_enquiry: bool = False
    is_archived: bool = False


class EnquiryListingDatesBody(BaseModel):
    next_follow_up_date: date | None = None


class EnquiryAssignUserBody(BaseModel):
    user_id: str


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


class ManualOrderTotalsPayload(BaseModel):
    """P&F and freight toggles from manual entry Net total section."""

    model_config = ConfigDict(populate_by_name=True)

    pf_applicable: bool = Field(True, alias="pfApplicable")
    pf_mode: str | None = Field(None, alias="pfMode")
    pf_amount: float | None = Field(None, alias="pfAmount")
    pf_rate: float | None = Field(None, alias="pfRate")
    freight_applicable: bool = Field(False, alias="freightApplicable")
    freight_mode: str | None = Field(None, alias="freightMode")
    freight_amount: float | None = Field(None, alias="freightAmount")
    freight_rate: float | None = Field(None, alias="freightRate")


class ManualNewClientEmployeeRequest(BaseModel):
    """Optional contact to create under the new branch when submitting manual entry."""

    model_config = ConfigDict(populate_by_name=True)

    address_code: str | None = Field(None, alias="addressCode")
    full_name: str = Field(..., alias="fullName")
    phone: str | None = None
    email: str | None = None
    department: str | None = None
    designation: str | None = None


ENQUIRY_SOURCE_VALUES = frozenset({"email", "indiamart", "manual", "referral"})


class ManualEnquiryCreateRequest(BaseModel):
    """Step 1 of manual flow — client only; products are added on the enquiry detail page."""

    model_config = ConfigDict(populate_by_name=True)

    clientMode: str
    selectedClientId: str | None = None
    newClient: ManualNewClientRequest | None = None
    priority: str = "Normal"
    notes: str = ""
    source: str = "manual"
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
        src = (self.source or "").strip().lower()
        if src not in ENQUIRY_SOURCE_VALUES:
            raise ValueError("source must be one of: email, indiamart, manual, referral")
        self.source = src
        return self


class ManualDropdownProcessRequest(BaseModel):
    """Step 2 of manual flow — add products and generate quotation on an existing enquiry."""

    model_config = ConfigDict(populate_by_name=True)

    clientMode: str
    selectedClientId: str | None = None
    newClient: ManualNewClientRequest | None = None
    lineItems: list[ManualLineItemRequest]
    priority: str = "Normal"
    notes: str = ""
    supplier_pricing: ManualSupplierPricingPayload | None = Field(None, alias="supplierPricing")
    order_totals: ManualOrderTotalsPayload | None = Field(None, alias="orderTotals")
    target_enquiry_id: str = Field(..., alias="targetEnquiryId")
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
        if not (self.target_enquiry_id or "").strip():
            raise ValueError("targetEnquiryId is required")
        return self


class EmailApprovalRequest(BaseModel):
    decision: str = Field(..., description="'approve' or 'reject'")
    notes: str = ""


class EmailApprovalResponse(BaseModel):
    enquiry_id: str
    enquiry_number: str | None = None
    status: str
    flow_type: str | None = None
    message: str
    email_approval: dict = Field(default_factory=dict)
    quotation_id: str | None = None
    already_processed: bool = False
    matcher: dict | None = None
    product_completeness: str | None = None
    matcher_confidence: float | None = None


class MatcherProcessResponse(EnquiryResponse):
    """Matcher run + optional auto-quote (same shape as EnquiryResponse with extras)."""

    model_config = ConfigDict(extra="ignore")

    matcher: dict = Field(default_factory=dict)
    product_completeness: str | None = None
    matcher_confidence: float | None = None


class EmailInboxItem(BaseModel):
    enquiry_id: str
    enquiry_number: str | None = None
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


def _is_admin_scope(user: CurrentUser) -> bool:
    return user.tier in ("admin", "superadmin")


def _ensure_enquiry_access(enquiry: Enquiry, user: CurrentUser) -> None:
    if _is_admin_scope(user):
        return
    if enquiry.created_by_user_id is None or str(enquiry.created_by_user_id) != str(user.id):
        raise HTTPException(status_code=404, detail=f"Enquiry {enquiry.id} not found")


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


def _enquiry_list_category(e: Enquiry) -> str | None:
    parsed = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    products = parsed.get("products_requested", []) if isinstance(parsed, dict) else []
    if not isinstance(products, list) or not products:
        return None
    first = products[0] if products else {}
    if not isinstance(first, dict):
        return None
    cat = str(first.get("category") or "").strip()
    if cat:
        return cat
    desc_txt = str(first.get("product_description", "") or "").lower()
    if "hose" in desc_txt:
        return "Hose"
    if "valve" in desc_txt or "butterfly" in desc_txt:
        return "Valve"
    if "fitting" in desc_txt:
        return "Fitting"
    desc = str(first.get("product_description", "") or "").strip()
    return desc[:40] if desc else None


def _enquiry_items_search_text(e: Enquiry) -> str:
    parts: list[str] = []
    parsed = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    products = parsed.get("products_requested", []) if isinstance(parsed, dict) else []
    if isinstance(products, list):
        for p in products:
            if not isinstance(p, dict):
                continue
            for key in (
                "product_description",
                "description",
                "item_no",
                "item_number",
                "catalog_part",
                "part_no",
                "product_name",
                "category",
            ):
                v = p.get(key)
                if v is not None and str(v).strip():
                    parts.append(str(v).strip())
    matched = e.matched_products
    if isinstance(matched, list):
        for m in matched:
            if isinstance(m, dict):
                for key in ("name", "product_name", "description", "display_label", "catalog_table"):
                    v = m.get(key)
                    if v is not None and str(v).strip():
                        parts.append(str(v).strip())
    elif isinstance(matched, dict):
        for key in ("name", "product_name", "description"):
            v = matched.get(key)
            if v is not None and str(v).strip():
                parts.append(str(v).strip())
    eno = (e.enquiry_number or "").strip()
    if eno:
        parts.append(eno)
    return " ".join(parts).lower()


def _enquiry_series(e: Enquiry) -> str | None:
    eno = (e.enquiry_number or "").strip()
    if len(eno) >= 2 and eno[:2].isdigit():
        return eno[:2]
    return None


def _enquiry_is_sales(e: Enquiry) -> bool:
    return (e.input_type or "").lower() in ("manual", "manual_dropdown")


def _enquiry_list_source(e: Enquiry) -> str:
    """Business source for listing: email, indiamart, manual, referral."""
    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    raw = str(pd.get("enquiry_source") or "").strip().lower()
    if raw in ENQUIRY_SOURCE_VALUES:
        return raw
    it = (e.input_type or "").strip().lower()
    if it in ("email", "email_sync"):
        return "email"
    if it == "indiamart":
        return "indiamart"
    if it in ("manual", "manual_dropdown"):
        return "manual"
    return "email"


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
    user: CurrentUser,
) -> dict:
    try:
        enquiry = await enquiry_service.get_enquiry(enquiry_id, db)
        _ensure_enquiry_access(enquiry, user)
        pd = enquiry.parsed_data if isinstance(enquiry.parsed_data, dict) else {}
        co = str(pd.get("client_company", "") or "").strip()
        if not co or co.lower() == "unknown":
            co = infer_company_from_email_raw(enquiry.raw_input) or "Unknown"
        return {
            "enquiry_id": str(enquiry.id),
            "enquiry_number": (enquiry.enquiry_number or "").strip() or None,
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
            "email_approval": enquiry_service.email_approval_record(enquiry),
            "requires_email_approval": enquiry_service.requires_email_approval(enquiry),
            "is_email_agent_enquiry": enquiry_service.is_email_agent_enquiry(enquiry),
        }
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail=f"Enquiry {enquiry_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_get_erp_export(
    enquiry_id: str,
    db: AsyncSession,
    user: CurrentUser,
) -> str:
    """Return absolute path to the generated ERP export XLSX for this enquiry."""
    try:
        enquiry = await enquiry_service.get_enquiry(enquiry_id, db)
        _ensure_enquiry_access(enquiry, user)
        return await enquiry_service.get_erp_export_path(enquiry_id, db)
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail="ERP export not found for this enquiry")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_list_enquiries(
    db: AsyncSession,
    user: CurrentUser,
    status: str | None = None,
    flow_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
    company_id: str | None = None,
) -> list[EnquiryListItem]:
    try:
        scoped_user_id = None
        if not _is_admin_scope(user):
            scoped_user_id = uuid.UUID(str(user.id))
        enquiries = await enquiry_service.list_enquiries(
            db,
            status=status,
            flow_type=flow_type,
            limit=limit,
            offset=offset,
            company_id=company_id,
            created_by_user_id=scoped_user_id,
        )
        quote_by_enquiry = await enquiry_service.latest_quotations_by_enquiry_ids(
            db, [e.id for e in enquiries]
        )
        return [
            EnquiryListItem(
                enquiry_id=str(e.id),
                enquiry_number=(e.enquiry_number or "").strip() or None,
                client_org_name=_enquiry_client_org_name(e),
                status=e.status,
                flow_type=e.flow_type,
                input_type=e.input_type,
                source=_enquiry_list_source(e),
                item_desc_short=enquiry_service.item_desc_short_from_enquiry(
                    e, quote_by_enquiry.get(str(e.id))
                ),
                item_desc_lines=enquiry_service.item_desc_lines_from_enquiry(
                    e, quote_by_enquiry.get(str(e.id))
                ),
                quotation_id=(
                    str(quote_by_enquiry[str(e.id)].id)
                    if str(e.id) in quote_by_enquiry
                    else None
                ),
                quote_number=(
                    quote_by_enquiry[str(e.id)].quote_number
                    if str(e.id) in quote_by_enquiry
                    else None
                ),
                next_follow_up_date=(
                    e.next_follow_up_date.isoformat()
                    if getattr(e, "next_follow_up_date", None)
                    else None
                ),
                created_at=e.created_at.isoformat() if e.created_at else "",
                created_by_user_id=str(e.created_by_user_id) if e.created_by_user_id else None,
                created_by_name=(e.created_by_name or "").strip() or None,
                erp_export_available=bool(getattr(e, "erp_export_path", None)),
                category=_enquiry_list_category(e),
                items_search_text=_enquiry_items_search_text(e),
                is_non_standard_customer=e.company_id is None,
                series=_enquiry_series(e),
                is_sales_enquiry=_enquiry_is_sales(e),
                is_archived=bool(getattr(e, "is_archived", False)),
            )
            for e in enquiries
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_patch_enquiry_listing_dates(
    enquiry_id: str,
    body: EnquiryListingDatesBody,
    db: AsyncSession,
    user: CurrentUser,
) -> dict:
    try:
        current = await enquiry_service.get_enquiry(enquiry_id, db)
        _ensure_enquiry_access(current, user)
        fields_set = body.model_fields_set
        e = await enquiry_service.update_enquiry_listing_dates(
            enquiry_id,
            db,
            next_follow_up_date=body.next_follow_up_date,
            set_follow_up="next_follow_up_date" in fields_set,
            performed_by=user.email,
            performed_by_name=user.full_name or None,
        )
        return {"enquiry_id": str(e.id), "next_follow_up_date": (
            e.next_follow_up_date.isoformat() if getattr(e, "next_follow_up_date", None) else None
        )}
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_assign_enquiry_user(
    enquiry_id: str,
    body: EnquiryAssignUserBody,
    db: AsyncSession,
    user: CurrentUser,
) -> dict:
    if not _is_admin_scope(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        assignee_id = uuid.UUID(str(body.user_id).strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")
    try:
        e = await enquiry_service.assign_enquiry_user(
            enquiry_id,
            assignee_id,
            db,
            performed_by=user.email,
            performed_by_name=user.full_name or None,
        )
        return {
            "enquiry_id": str(e.id),
            "created_by_user_id": str(e.created_by_user_id) if e.created_by_user_id else None,
            "created_by_name": (e.created_by_name or "").strip() or None,
        }
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_archive_enquiry(
    enquiry_id: str,
    db: AsyncSession,
    user: CurrentUser,
) -> dict:
    try:
        current = await enquiry_service.get_enquiry(enquiry_id, db)
        _ensure_enquiry_access(current, user)
        e = await enquiry_service.archive_enquiry(
            enquiry_id,
            db,
            performed_by=user.email,
            performed_by_name=user.full_name or None,
        )
        return {
            "enquiry_id": str(e.id),
            "is_archived": bool(getattr(e, "is_archived", False)),
        }
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_decide_email_approval(
    enquiry_id: str,
    body: EmailApprovalRequest,
    db: AsyncSession,
    user: CurrentUser,
) -> EmailApprovalResponse:
    try:
        current = await enquiry_service.get_enquiry(enquiry_id, db)
        _ensure_enquiry_access(current, user)
        uid, name = _quotation_creator_from_user(user)
        result = await enquiry_service.decide_email_approval(
            enquiry_id,
            body.decision,
            db,
            decided_by_user_id=uid,
            decided_by_name=name,
            notes=body.notes,
        )
        return EmailApprovalResponse(**result)
    except EnquiryParseError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail=f"Enquiry {enquiry_id} not found")
    except Exception as e:
        logger.exception("decide_email_approval failed")
        raise HTTPException(status_code=500, detail=str(e))


async def handle_process_email_matcher(
    enquiry_id: str,
    db: AsyncSession,
    user: CurrentUser,
) -> MatcherProcessResponse:
    try:
        current = await enquiry_service.get_enquiry(enquiry_id, db)
        _ensure_enquiry_access(current, user)
        result = await enquiry_service.process_email_matcher(enquiry_id, db)
        return MatcherProcessResponse.model_validate(result)
    except EnquiryParseError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail=f"Enquiry {enquiry_id} not found")
    except Exception as e:
        logger.exception("process_email_matcher failed")
        raise HTTPException(status_code=500, detail=str(e))


async def handle_revert_request_email_draft(
    enquiry_id: str,
    db: AsyncSession,
    user: CurrentUser,
) -> dict:
    try:
        enquiry = await enquiry_service.get_enquiry(enquiry_id, db)
        _ensure_enquiry_access(enquiry, user)
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


async def handle_create_manual_enquiry(
    body: ManualEnquiryCreateRequest,
    db: AsyncSession,
    user: CurrentUser,
) -> EnquiryResponse:
    """Create a manual enquiry with client details only (no quotation yet)."""
    try:
        creator_id, creator_name = _quotation_creator_from_user(user)
        result = await enquiry_service.create_manual_enquiry(
            body.model_dump(by_alias=True),
            db,
            created_by_user_id=creator_id,
            created_by_name=creator_name,
        )
        return EnquiryResponse(**result)
    except EnquiryParseError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Manual enquiry creation failed")
        raise HTTPException(status_code=500, detail=str(e))


async def handle_process_manual_dropdown(
    body: ManualDropdownProcessRequest,
    db: AsyncSession,
    user: CurrentUser,
) -> EnquiryResponse:
    """Add products to an existing manual enquiry and generate a quotation."""
    try:
        target_id = str(body.target_enquiry_id or "").strip()
        if target_id:
            existing = await enquiry_service.get_enquiry(target_id, db)
            _ensure_enquiry_access(existing, user)
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
        "enquiry_number": (enquiry.enquiry_number or "").strip() or None,
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
