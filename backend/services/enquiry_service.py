"""Enquiry business logic — processes email enquiries, manages enquiry lifecycle.

Pure service — no FastAPI imports, no HTTPException.
Raises only from core.exceptions.
"""

import logging
import uuid
import json
from datetime import date

from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import get_settings
from core.database import async_session_factory
from core.exceptions import EnquiryParseError, ProductNotFoundError
from db.models import AuditLog, ClientBranch, Enquiry, Quotation, QuotationProductHistory

logger = logging.getLogger(__name__)

STATUS_MAP = {
    "quoted": "Quotation generated successfully",
    "awaiting_info": "Missing information — clarification questions generated",
    "pending_human_review": "Awaiting human review",
    "email_composed": "Email draft composed — awaiting review",
    "approved_sent": "Approved — ready to send",
    "failed": "Processing failed",
    "parser_failed": "Failed to parse the enquiry",
    "matcher_failed": "Failed to match products",
    "quote_failed": "Failed to build quotation",
}


def _allocate_quote_number() -> str:
    return f"QT-{date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"


def _clean_float(x: object, default: float = 0.0) -> float:
    try:
        if x is None:
            return default
        return float(x)
    except (TypeError, ValueError):
        return default


def _normalize_int(x: object, default: int = 1) -> int:
    try:
        n = int(x)  # type: ignore[arg-type]
        return n if n > 0 else default
    except Exception:
        return default


def _calc_totals(
    line_items: list[dict],
    gst_rate: float,
    pf_rate: float,
) -> tuple[list[dict], float, float, float, float]:
    normalized: list[dict] = []
    subtotal = 0.0
    for raw in line_items:
        if not isinstance(raw, dict):
            continue
        qty = _normalize_int(raw.get("quantity"), 1)
        unit_price = round(_clean_float(raw.get("unit_price"), 0.0), 2)
        line_total = round(qty * unit_price, 2)
        row = {**raw, "quantity": qty, "unit_price": unit_price, "line_total": line_total}
        normalized.append(row)
        subtotal += line_total
    subtotal = round(subtotal, 2)
    gst_amount = round(subtotal * (gst_rate / 100.0), 2)
    pf_amount = round(subtotal * (pf_rate / 100.0), 2)
    total_amount = round(subtotal + gst_amount + pf_amount, 2)
    return normalized, subtotal, gst_amount, pf_amount, total_amount


async def create_enquiry(
    email_text: str,
    input_type: str = "email",
    db: AsyncSession | None = None,
) -> Enquiry:
    """Create and persist an Enquiry DB record with status='received'."""
    if not email_text or not email_text.strip():
        raise EnquiryParseError("Email text is empty")

    email_text, input_type = preprocess_raw_input(email_text, input_type)

    enquiry = Enquiry(
        id=uuid.uuid4(),
        client_config="parth_valves",
        raw_input=email_text.strip(),
        input_type=input_type,
        status="received",
    )

    if db:
        db.add(enquiry)
        await db.flush()
    else:
        async with async_session_factory() as session:
            session.add(enquiry)
            await session.commit()

    return enquiry


def preprocess_raw_input(raw_input: str, input_type: str) -> tuple[str, str]:
    """Detect manual-entry marker and normalize input_type.

    Manual entry uses the same email-style text but includes a marker tag.
    """
    if "[MANUAL_ENTRY_SOURCE]" in raw_input:
        cleaned = raw_input.replace("[MANUAL_ENTRY_SOURCE]", "").strip()
        return cleaned, "manual"
    return raw_input, input_type


async def process_enquiry(
    enquiry_id: str,
    raw_input: str,
    input_type: str,
    db: AsyncSession,
    emitter=None
) -> dict:
    """
    AI processing pipeline entry point.

    TODO: Implement new agent pipeline here.
    Current status: stub — returns immediately.

    Will be replaced with new LangGraph graph
    when agents are rebuilt.
    """
    from sqlalchemy import update
    from datetime import datetime, timezone

    # Update status to show processing started
    await db.execute(
        update(Enquiry)
        .where(Enquiry.id == uuid.UUID(enquiry_id))
        .values(
            status="received",
            processing_started_at=datetime.now(
                timezone.utc
            )
        )
    )
    await db.commit()

    # Emit a stub event so SSE stream
    # doesn't hang silently
    if emitter:
        await emitter.emit({
            "type":      "agent_start",
            "agent":     "system",
            "message":   "Processing pipeline ready",
            "detail":    "Agents will be rebuilt. "
                         "Enquiry saved successfully.",
            "status":    "running",
            "timestamp": datetime.now(
                timezone.utc
            ).isoformat()
        })
        await emitter.emit({
            "type":   "result",
            "status": "received",
            "data": {
                "enquiry_id":   enquiry_id,
                "status":       "received",
                "flow_type":    None,
                "message":      "Enquiry saved. "
                                "AI processing "
                                "coming soon.",
                "quotation_id": None,
                "pdf_available": False,
                "pdf_path":      None,
                "clarification_questions": None,
                "ai_reasoning":  [
                    "Pipeline stub — "
                    "agents being rebuilt"
                ],
                "requires_human_review": False,
            }
        })
        await emitter.done()

    return {
        "enquiry_id":   enquiry_id,
        "status":       "received",
        "flow_type":    None,
        "message":      "Enquiry saved successfully.",
        "quotation_id": None,
        "pdf_available": False,
        "pdf_path":      None,
        "clarification_questions": None,
        "ai_reasoning":  [],
        "requires_human_review": False,
    }


async def process_manual_dropdown(body: dict, db: AsyncSession) -> dict:
    """Manual dropdown flow: no parser/matcher/HITL; create enquiry + quote directly."""
    from services.client_service import (
        client_for_export,
        create_company_with_branch,
        get_branch_with_company,
        increment_branch_enquiry_count,
    )
    from services.erp_export_service import generate_enquiry_list_excel
    from services.pdf_service import generate_quotation_pdf

    settings = get_settings()
    client_json = settings.get_client_json()
    gst_rate = float(client_json.get("default_gst_rate", 18.0))
    pf_rate = float(client_json.get("default_pf_rate", 3.0))

    mode = str(body.get("clientMode") or "").strip().lower()
    selected_client_id = body.get("selectedClientId")
    new_client = body.get("newClient") or {}
    line_items_in = body.get("lineItems") or []
    notes = str(body.get("notes") or "").strip()
    priority = str(body.get("priority") or "Normal").strip()

    # Resolve client identity
    client_name = "Customer"
    client_company = ""
    client_email = ""
    client_phone = ""
    company_id_uuid: uuid.UUID | None = None
    branch_id_uuid: uuid.UUID | None = None
    client_obj = None

    if mode == "existing" and isinstance(selected_client_id, str):
        client_obj = await client_for_export(selected_client_id, db)
        if client_obj is not None:
            client_company = str(getattr(client_obj, "company_name", "") or "")
            client_name = str(getattr(client_obj, "contact_name", "") or "") or client_name
            client_email = str(getattr(client_obj, "email", "") or "")
            client_phone = str(getattr(client_obj, "phone", "") or "")
            if not selected_client_id.startswith("dummy-"):
                branch_id_uuid = uuid.UUID(selected_client_id)
                br = await get_branch_with_company(selected_client_id, db)
                if br is not None:
                    company_id_uuid = br.company_id
    elif mode == "new":
        addr = (new_client.get("address_line1") or new_client.get("address") or "").strip() or None
        city = (new_client.get("city") or "").strip() or "Unknown"
        company, branch = await create_company_with_branch(
            client_config="parth_valves",
            company_name=str(new_client.get("company_name") or "Unknown").strip(),
            gst_number=(new_client.get("gst_number") or None),
            industry=(new_client.get("industry") or None),
            notes=None,
            source="manual_dropdown",
            branch_name=str(new_client.get("branch_name") or "Head Office").strip() or "Head Office",
            contact_name=(new_client.get("contact_name") or None),
            designation=(new_client.get("designation") or None),
            phone=new_client.get("phone"),
            email=new_client.get("email"),
            city=city,
            state=(new_client.get("state") or None),
            pincode=(new_client.get("pincode") or None),
            address_line1=addr,
            country=str(new_client.get("country") or "India"),
            db=db,
        )
        company_id_uuid = company.id
        branch_id_uuid = branch.id
        client_obj = await client_for_export(str(branch.id), db)
        client_company = company.company_name
        client_name = (branch.contact_name or client_name) if branch else client_name
        client_email = (branch.email or "") if branch else ""
        client_phone = (branch.phone or "") if branch else ""

    enquiry_id = uuid.uuid4()

    parsed_products: list[dict] = []
    matched_products: list[dict] = []
    quote_line_items: list[dict] = []
    history_rows: list[dict] = []

    for li in line_items_in:
        if not isinstance(li, dict):
            continue
        qty = _normalize_int(li.get("quantity"), 1)
        sp = li.get("selectedProduct") or {}
        if not isinstance(sp, dict):
            continue
        name = str(sp.get("name") or "Product").strip()
        unit = str(sp.get("unit") or "Nos").strip() or "Nos"
        unit_price = _clean_float(sp.get("base_price"), 0.0)
        size_inch = sp.get("size_inch")
        size_mm = sp.get("size_mm")
        material = sp.get("material")

        desc_parts = [name]
        if size_inch is not None or size_mm is not None:
            inch_part = f'{size_inch}"' if size_inch is not None else ""
            mm_part = f"({size_mm}mm)" if size_mm is not None else ""
            sz = " ".join([p for p in [inch_part, mm_part] if p]).strip()
            if sz:
                desc_parts.append(sz)
        if material:
            desc_parts.append(str(material))
        description = " — ".join([p for p in desc_parts if p])

        parsed_products.append(
            {
                "product_description": description,
                "quantity": qty,
                "unit": unit,
            }
        )
        matched_products.append(
            {
                "matched": True,
                "product_id": sp.get("id"),
                "product_name": name,
                "material": material,
                "size_inch": size_inch,
                "size_mm": size_mm,
                "base_price": unit_price,
                "unit": unit,
            }
        )
        cascade = li.get("cascadeSelections") or {}
        if not isinstance(cascade, dict):
            cascade = {}
        cat = str(li.get("category") or "unknown").strip().lower()
        catalog_table = None
        catalog_row_id = None
        raw_sp_id = sp.get("id")
        if isinstance(raw_sp_id, str) and ":" in raw_sp_id:
            parts = raw_sp_id.split(":", 1)
            if len(parts) == 2 and parts[0] and parts[1]:
                catalog_table = parts[0].strip().lower()
                try:
                    catalog_row_id = uuid.UUID(parts[1].strip())
                except ValueError:
                    catalog_row_id = None
        quote_line_items.append(
            {
                "description": description,
                "quantity": qty,
                "unit_price": unit_price,
                "unit": unit,
                # Preserve product identity for downstream features (history lookup, etc).
                "category": cat,
                "catalog_table": catalog_table,
                "catalog_row_id": str(catalog_row_id) if catalog_row_id else None,
            }
        )
        history_rows.append(
            {
                "category": cat,
                "catalog_table": catalog_table,
                "catalog_row_id": catalog_row_id,
                "variant_type": str(cascade.get("variant_type") or "") or None,
                "construction": str(cascade.get("construction") or "") or None,
                "valve_size": str(cascade.get("valve_size") or "") or None,
                "end_connection": str(cascade.get("end_connection") or "") or None,
                "pressure": str(cascade.get("pressure") or "") or None,
                "body": str(cascade.get("body") or "") or None,
                "ball_disc": str(cascade.get("ball_disc") or cascade.get("ball") or "") or None,
                "stem": str(cascade.get("stem") or "") or None,
                "seat": str(cascade.get("seat") or "") or None,
            }
        )

    quote_line_items, subtotal, gst_amount, pf_amount, total_amount = _calc_totals(
        quote_line_items, gst_rate=gst_rate, pf_rate=pf_rate
    )

    raw_payload: dict = {
        "source": "manual_dropdown",
        "priority": priority,
        "notes": notes,
        "client": {
            "name": client_name,
            "company": client_company,
            "email": client_email,
            "phone": client_phone,
        },
        "line_items": quote_line_items,
    }
    sp = body.get("supplierPricing")
    if isinstance(sp, dict):
        raw_payload["supplierPricing"] = sp

    raw_input = json.dumps(raw_payload, ensure_ascii=False)

    enquiry = Enquiry(
        id=enquiry_id,
        client_config="parth_valves",
        raw_input=raw_input,
        input_type="manual_dropdown",
        status="approved",
        flow_type="complete",
        parsed_data={
            "client_name": client_name,
            "client_company": client_company,
            "client_email": client_email,
            "client_phone": client_phone,
            "priority": priority,
            "notes": notes,
            "products_requested": parsed_products,
        },
        matched_products=matched_products,
    )
    if company_id_uuid is not None:
        enquiry.company_id = company_id_uuid
    if branch_id_uuid is not None:
        enquiry.branch_id = branch_id_uuid

    db.add(enquiry)
    await db.commit()

    quote_number = _allocate_quote_number()
    quotation_id = uuid.uuid4()
    quotation_data = {
        "quote_number": quote_number,
        "client_name": client_name,
        "client_company": client_company,
        "client_email": client_email,
        "client_phone": client_phone,
        "line_items": quote_line_items,
        "subtotal": subtotal,
        "gst_rate": gst_rate,
        "gst_amount": gst_amount,
        "pf_rate": pf_rate,
        "pf_amount": pf_amount,
        "freight_note": "Extra at actual",
        "total_amount": total_amount,
        "professional_notes": notes or "",
    }

    quotation = Quotation(
        id=quotation_id,
        enquiry_id=enquiry_id,
        quote_number=quote_number,
        client_name=client_name,
        client_company=client_company,
        client_email=client_email,
        client_phone=client_phone,
        line_items=quote_line_items,
        subtotal=subtotal,
        gst_rate=gst_rate,
        gst_amount=gst_amount,
        pf_rate=pf_rate,
        pf_amount=pf_amount,
        total_amount=total_amount,
        validity_days=int(client_json.get("quote_validity_days", 15)),
        status="approved",
        notes=notes or None,
    )
    db.add(quotation)
    await db.commit()

    for idx, qli in enumerate(quote_line_items):
        h = history_rows[idx] if idx < len(history_rows) else {}
        unit_price = _clean_float(qli.get("unit_price"), 0.0)
        quantity = _normalize_int(qli.get("quantity"), 1)
        line_total = round(unit_price * quantity, 2)
        db.add(
            QuotationProductHistory(
                id=uuid.uuid4(),
                quotation_id=quotation_id,
                enquiry_id=enquiry_id,
                client_config=settings.ACTIVE_CLIENT,
                quote_number=quote_number,
                client_name=client_name or None,
                client_company=client_company or None,
                line_index=idx,
                unit_price=unit_price,
                quantity=quantity,
                line_total=line_total,
                currency="INR",
                category=str(h.get("category") or "unknown"),
                catalog_table=h.get("catalog_table"),
                catalog_row_id=h.get("catalog_row_id"),
                variant_type=h.get("variant_type"),
                construction=h.get("construction"),
                valve_size=h.get("valve_size"),
                end_connection=h.get("end_connection"),
                pressure=h.get("pressure"),
                body=h.get("body"),
                ball_disc=h.get("ball_disc"),
                stem=h.get("stem"),
                seat=h.get("seat"),
            )
        )
    await db.commit()

    pdf_path = await generate_quotation_pdf(quotation_data, client_json)
    if pdf_path:
        quotation.pdf_path = pdf_path
        await db.commit()

    # Generate ERP Enquiry List (non-negotiable requirement)
    try:
        if client_obj is None and isinstance(selected_client_id, str):
            client_obj = await client_for_export(selected_client_id, db)
        if client_obj is not None:
            erp_path = await generate_enquiry_list_excel(
                enquiry_id=str(enquiry_id),
                client=client_obj,
                parsed_data=enquiry.parsed_data or {},
                matched_products=matched_products,
                quotation_data=quotation_data,
                input_type=enquiry.input_type,
                subject="Manual dropdown enquiry",
            )
            enquiry.erp_export_path = erp_path
            await db.commit()
    except Exception:
        # Don't fail the whole request if export generation fails,
        # but log the issue for follow-up.
        logger.exception("Failed to generate ERP enquiry list for manual dropdown")

    audit = AuditLog(
        id=uuid.uuid4(),
        entity_type="enquiry",
        entity_id=enquiry_id,
        action="manual_dropdown_processed",
        performed_by="user",
        details={
            "quotation_id": str(quotation_id),
            "quote_number": quote_number,
            "subtotal": subtotal,
            "total_amount": total_amount,
        },
    )
    db.add(audit)
    await db.commit()

    if branch_id_uuid is not None:
        await increment_branch_enquiry_count(str(branch_id_uuid), db)

    return {
        "enquiry_id": str(enquiry_id),
        "status": "quoted",
        "flow_type": "complete",
        "message": "Manual dropdown processed — quotation generated",
        "quotation_id": str(quotation_id),
        "pdf_available": bool(pdf_path),
        "pdf_path": pdf_path,
        "quote_number": quote_number,
        "subtotal": subtotal,
        "total_amount": total_amount,
        "line_items": quote_line_items,
        "ai_reasoning": [],
        "requires_human_review": False,
    }


async def get_erp_export_path(enquiry_id: str, db: AsyncSession) -> str:
    """Return ERP export file path for an enquiry."""
    enquiry = await get_enquiry(enquiry_id, db)
    if not enquiry.erp_export_path:
        raise ProductNotFoundError("ERP export not found for this enquiry")
    return enquiry.erp_export_path


async def list_clients(search: str | None = None) -> list[dict]:
    """Client list for HITL dropdown.

    TODO: Replace with real ERP client search.
    """
    from services.client_service import get_dummy_clients

    clients = get_dummy_clients()
    if search:
        s = search.lower().strip()
        clients = [c for c in clients if s in c["company_name"].lower()]
    return clients


async def get_enquiry(enquiry_id: str, db: AsyncSession) -> Enquiry:
    """Fetch an enquiry by ID. Raises ProductNotFoundError if missing."""
    result = await db.execute(
        select(Enquiry).where(Enquiry.id == enquiry_id)
    )
    enquiry = result.scalar_one_or_none()
    if not enquiry:
        raise ProductNotFoundError(f"Enquiry {enquiry_id} not found")
    return enquiry


async def list_enquiries(
    db: AsyncSession,
    status: str | None = None,
    flow_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
    company_id: str | None = None,
) -> list[Enquiry]:
    """Return filtered list of enquiries."""
    stmt = (
        select(Enquiry)
        .options(
            selectinload(Enquiry.branch).selectinload(ClientBranch.company),
        )
        .order_by(Enquiry.created_at.desc())
    )
    if status:
        stmt = stmt.where(Enquiry.status == status)
    if flow_type:
        stmt = stmt.where(Enquiry.flow_type == flow_type)
    if company_id:
        try:
            cid = uuid.UUID(company_id)
        except ValueError:
            cid = None
        if cid is not None:
            stmt = stmt.where(Enquiry.company_id == cid)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


def _format_for_inbox(e: Enquiry) -> dict:
    parsed = e.parsed_data or {}
    products = parsed.get("products_requested", []) if isinstance(parsed, dict) else []

    category = None
    if products and isinstance(products, list):
        first_product = products[0] if products else {}
        if isinstance(first_product, dict):
            desc_txt = str(first_product.get("product_description", "")).lower()
            if "hose" in desc_txt:
                category = "Hose"
            elif "valve" in desc_txt or "butterfly" in desc_txt:
                category = "Valve"
            elif "fitting" in desc_txt:
                category = "Fitting"
            else:
                category = str(first_product.get("product_description", ""))[:30] or None

    sender_name = str(parsed.get("client_name", "") or "")
    sender_email = str(parsed.get("client_email", "") or "")
    company = str(parsed.get("client_company", "Unknown") or "Unknown")

    if (not sender_name or not sender_email) and e.raw_input:
        lines = e.raw_input.split("\n")
        for line in lines[:8]:
            if line.lower().startswith("from:"):
                from_val = line[5:].strip()
                if "<" in from_val and ">" in from_val:
                    sender_name = from_val.split("<")[0].strip() or sender_name
                    sender_email = from_val.split("<")[1].split(">")[0].strip() or sender_email
                else:
                    sender_email = from_val.strip() or sender_email
                break

    subject = ""
    if e.raw_input:
        for line in e.raw_input.split("\n")[:12]:
            if line.lower().startswith("subject:"):
                subject = line[8:].strip()
                break

    preview = ""
    if e.raw_input:
        lines = e.raw_input.split("\n")
        in_body = False
        for line in lines:
            stripped = line.strip()
            if not stripped:
                in_body = True
                continue
            if in_body and len(stripped) > 10:
                preview = stripped[:100]
                break

    awaiting_human = bool(
        getattr(e, "client_verification_status", None) == "pending" or e.status == "pending_approval"
    )

    return {
        "enquiry_id": str(e.id),
        "sender_name": sender_name or company,
        "sender_email": sender_email,
        "company": company,
        "subject": subject,
        "preview": preview,
        "category": category,
        "status": e.status,
        "flow_type": e.flow_type,
        "confidence": e.confidence_score,
        "input_type": e.input_type,
        "created_at": e.created_at.isoformat() if e.created_at else "",
        "has_quotation": bool(getattr(e, "branch_id", None)) or bool((e.parsed_data or {}).get("quotation_id") if isinstance(e.parsed_data, dict) else False),
        "awaiting_human": awaiting_human,
        "hitl_cycle": int(getattr(e, "hitl_cycle", 0) or 0),
    }


async def list_email_enquiries(
    db: AsyncSession,
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
) -> list[dict]:
    q = select(Enquiry).where(
        or_(Enquiry.input_type == "email_sync", Enquiry.input_type == "email")
    )
    if status:
        q = q.where(Enquiry.status == status)

    q = q.order_by(desc(Enquiry.created_at)).limit(limit).offset(offset)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [_format_for_inbox(e) for e in rows]
