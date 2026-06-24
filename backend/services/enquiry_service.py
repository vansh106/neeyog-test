"""Enquiry business logic — processes email enquiries, manages enquiry lifecycle.

Pure service — no FastAPI imports, no HTTPException.
Raises only from core.exceptions.
"""

import logging
import uuid
import json
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, desc, false, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import get_settings
from core.database import async_session_factory
from core.exceptions import EnquiryParseError, ProductNotFoundError
from db.models import (
    AuditLog,
    ClientBranch,
    EmailSyncState,
    Enquiry,
    Mailbox,
    MailboxSyncState,
    Quotation,
    QuotationProductHistory,
    User,
)
from services.email_display_infer import infer_company_from_email_raw
from services.email_inbox_filters import raw_input_is_quotation_work_related
from services.fiscal_numbering import allocate_enquiry_number, allocate_quote_number

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


def _normalize_discount_pct(x: object) -> float | None:
    try:
        if x is None:
            return None
        n = float(x)
    except (TypeError, ValueError):
        return None
    if n < 0:
        return 0.0
    if n > 100:
        return 100.0
    return n


_DESC_FIELDS: list[tuple[str, str]] = [
    ("variant_type", "Variant Type"),
    ("product_sheet", "Product Sheet"),
    ("construction", "Construction"),
    ("valve_size", "Valve Size"),
    ("bore_type", "Bore Type"),
    ("end_connection", "End Connection"),
    ("pressure", "Pressure"),
    ("body", "Body"),
    ("ball_disc", "Ball/Disc"),
    ("ball", "Ball"),
    ("stem", "Stem"),
    ("seat", "Seat"),
    ("fasteners", "Fasteners"),
    ("hose_length", "Length"),
    ("size_id_mm", "Size Id Mm"),
    ("temperature_range", "Temperature Range"),
    ("wall_thickness", "Wall Thickness"),
    ("fitting_end_1", "Fitting End 1"),
    ("fitting_end_1_qty", "Fitting End 1 Qty"),
    ("fitting_end_1_variant_type", "Fitting End 1 Variant Type"),
    ("fitting_end_1_end_connection_1", "Fitting End 1 End Connection 1"),
    ("fitting_end_1_end_connection_2", "Fitting End 1 End Connection 2"),
    ("fitting_end_1_size_mm", "Fitting End 1 Size Mm"),
    ("fitting_end_1_hose_nipple_moc", "Fitting End 1 Hose Nipple Moc"),
    ("fitting_end_1_hose_cap_moc", "Fitting End 1 Hose Cap Moc"),
    ("fitting_end_1_sms_nut_moc", "Fitting End 1 Sms Nut Moc"),
    ("fitting_end_1_tc_od", "Fitting End 1 Tc Od"),
    ("fitting_end_1_din_nut_moc", "Fitting End 1 Din Nut Moc"),
    ("fitting_end_1_swivel_nut_moc", "Fitting End 1 Swivel Nut Moc"),
    ("fitting_end_1_flange_nut_moc", "Fitting End 1 Flange Nut Moc"),
    ("fitting_end_2", "Fitting End 2"),
    ("fitting_end_2_variant_type", "Fitting End 2 Variant Type"),
    ("fitting_end_2_end_connection_1", "Fitting End 2 End Connection 1"),
    ("fitting_end_2_end_connection_2", "Fitting End 2 End Connection 2"),
    ("fitting_end_2_size_mm", "Fitting End 2 Size Mm"),
    ("fitting_end_2_hose_nipple_moc", "Fitting End 2 Hose Nipple Moc"),
    ("fitting_end_2_hose_cap_moc", "Fitting End 2 Hose Cap Moc"),
    ("fitting_end_2_sms_nut_moc", "Fitting End 2 Sms Nut Moc"),
    ("fitting_end_2_tc_od", "Fitting End 2 Tc Od"),
    ("fitting_end_2_din_nut_moc", "Fitting End 2 Din Nut Moc"),
    ("fitting_end_2_swivel_nut_moc", "Fitting End 2 Swivel Nut Moc"),
    ("fitting_end_2_flange_nut_moc", "Fitting End 2 Flange Nut Moc"),
    ("operator", "Operator"),
    ("operator_model", "Operator Model"),
    ("operator_size", "Operator Size"),
    ("sov", "Sov"),
    ("limit_switch_box", "Lsb"),
    ("positioner", "Positioner"),
    ("bracket_coupler", "Bracket/Coupler"),
]

# Internal pricing fields — never show on customer-facing quotation PDFs.
_DESC_EXCLUDED_KEYS = frozenset({"supplier", "supplier_id"})


def _cascade_field_label(key: str) -> str:
    for k, label in _DESC_FIELDS:
        if k == key:
            return label
    return key.replace("_", " ").title()


def _build_structured_description(name: str, cascade: dict) -> str:
    lines = [f"Product : {name or 'Product'}"]
    seen: set[str] = set()
    if not isinstance(cascade, dict):
        cascade = {}
    for key, label in _DESC_FIELDS:
        v = str(cascade.get(key) or "").strip()
        if not v:
            continue
        seen.add(key)
        lines.append(f"{label} : {v}")
    for key in cascade:
        if key in seen or key in _DESC_EXCLUDED_KEYS:
            continue
        v = str(cascade.get(key) or "").strip()
        if not v:
            continue
        lines.append(f"{_cascade_field_label(key)} : {v}")
    return "\n".join(lines)


def expand_manual_line_items_to_quote_parts(
    line_items_in: list,
) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    """Convert frontend ``ManualLineItem`` payloads into quote + enquiry structures.

    Returns ``(parsed_products, matched_products, quote_line_items, history_rows)``.
    """
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
        price_tbd = bool(li.get("price_tbd"))
        raw_base = sp.get("base_price")
        base_unit_price: float | None = None
        if raw_base is not None and str(raw_base).strip() != "":
            bp = _clean_float(raw_base, 0.0)
            if bp > 0:
                base_unit_price = round(bp, 2)
        if not price_tbd and base_unit_price is None:
            price_tbd = True
        customer_discount_pct = _normalize_discount_pct(li.get("customer_discount_pct")) or 0.0
        if price_tbd or base_unit_price is None:
            customer_discount_amount = 0.0
            unit_price = 0.0
        else:
            customer_discount_amount = round(base_unit_price * (customer_discount_pct / 100.0), 2)
            unit_price = round(base_unit_price - customer_discount_amount, 2)
        size_inch = sp.get("size_inch")
        size_mm = sp.get("size_mm")
        material = sp.get("material")

        cascade = li.get("cascadeSelections") or {}
        if not isinstance(cascade, dict):
            cascade = {}
        description = _build_structured_description(name, cascade)

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
                "base_price": unit_price if not price_tbd else None,
                "base_unit_price": base_unit_price,
                "price_tbd": price_tbd,
                "customer_discount_pct": customer_discount_pct,
                "unit": unit,
            }
        )
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
                "base_unit_price": base_unit_price,
                "customer_discount_pct": customer_discount_pct,
                "customer_discount_amount": customer_discount_amount,
                "price_tbd": price_tbd,
                "unit": unit,
                "category": cat,
                "catalog_table": catalog_table,
                "catalog_row_id": str(catalog_row_id) if catalog_row_id else None,
                "component_pricing": li.get("component_pricing")
                if isinstance(li.get("component_pricing"), dict)
                else None,
                "crm_status": "ongoing",
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

    return parsed_products, matched_products, quote_line_items, history_rows


def compute_quotation_amounts(
    item_total: float,
    gst_rate: float,
    pf_rate: float,
    *,
    pf_applicable: bool = True,
    pf_amount: float | None = None,
    freight_amount: float = 0.0,
) -> tuple[float, float, float]:
    """Return ``(gst_amount, pf_amount, total_amount)``.

    ``item_total`` is the sum of line items. P&F defaults to ``pf_rate`` % of item total.
    Taxable subtotal = item total + P&F + freight; GST is applied on that subtotal.
    """
    item_total = round(float(item_total or 0), 2)
    if not pf_applicable:
        pf = 0.0
    elif pf_amount is not None:
        pf = round(float(pf_amount), 2)
    else:
        pf = round(item_total * (float(pf_rate) / 100.0), 2)
    freight = round(max(0.0, float(freight_amount or 0)), 2)
    taxable = round(item_total + pf + freight, 2)
    gst = round(taxable * (float(gst_rate) / 100.0), 2)
    total = round(taxable + gst, 2)
    return gst, pf, total


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
        price_tbd = bool(raw.get("price_tbd")) or unit_price <= 0
        if price_tbd:
            line_total = 0.0
            row = {
                **raw,
                "quantity": qty,
                "unit_price": 0.0,
                "line_total": line_total,
                "price_tbd": True,
            }
            normalized.append(row)
            continue
        line_total = round(qty * unit_price, 2)
        row = {**raw, "quantity": qty, "unit_price": unit_price, "line_total": line_total, "price_tbd": False}
        normalized.append(row)
        subtotal += line_total
    item_total = round(subtotal, 2)
    gst_amount, pf_amount, total_amount = compute_quotation_amounts(
        item_total, gst_rate, pf_rate
    )
    return normalized, item_total, gst_amount, pf_amount, total_amount


EMAIL_AGENT_INPUT_TYPES = frozenset({"email", "email_sync", "indiamart"})


def is_email_agent_enquiry(e: Enquiry) -> bool:
    return (e.input_type or "").strip().lower() in EMAIL_AGENT_INPUT_TYPES


def email_approval_record(e: Enquiry) -> dict:
    """Return ``email_approval`` block from parsed_data with sensible defaults."""
    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    raw = pd.get("email_approval")
    if isinstance(raw, dict):
        return dict(raw)
    st = (e.status or "").strip().lower()
    if st == "pending_email_approval":
        return {"status": "pending"}
    if st == "email_rejected":
        return {"status": "rejected"}
    if st == "email_approved" or pd.get("matcher") or e.processing_started_at:
        return {"status": "approved"}
    if is_email_agent_enquiry(e):
        return {"status": "pending"}
    return {"status": "not_applicable"}


def requires_email_approval(e: Enquiry) -> bool:
    if not is_email_agent_enquiry(e):
        return False
    return (email_approval_record(e).get("status") or "").strip().lower() == "pending"


def is_email_approved_for_matcher(e: Enquiry) -> bool:
    if not is_email_agent_enquiry(e):
        return True
    st = (email_approval_record(e).get("status") or "").strip().lower()
    if st == "approved":
        return True
    if st == "rejected":
        return False
    # Legacy rows that already ran matcher before approval gate existed.
    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    if pd.get("matcher") or e.processing_started_at:
        return True
    return False


def _initial_email_enquiry_fields(input_type: str) -> tuple[str, dict | None]:
    it = (input_type or "").strip().lower()
    if it in EMAIL_AGENT_INPUT_TYPES:
        return (
            "pending_email_approval",
            {"email_approval": {"status": "pending"}},
        )
    return "received", None


async def create_enquiry(
    email_text: str,
    input_type: str = "email",
    db: AsyncSession | None = None,
    mailbox_id: uuid.UUID | None = None,
    *,
    created_by_user_id: uuid.UUID | None = None,
    created_by_name: str | None = None,
) -> Enquiry:
    """Create and persist an Enquiry DB record with status='received'."""
    if not email_text or not email_text.strip():
        raise EnquiryParseError("Email text is empty")

    email_text, input_type = preprocess_raw_input(email_text, input_type)

    cb_uid = created_by_user_id
    cb_raw = (created_by_name or "").strip()
    cb_name = cb_raw[:255] if cb_raw else None
    initial_status, initial_parsed = _initial_email_enquiry_fields(input_type)

    if db:
        eno = await allocate_enquiry_number(db)
        enquiry = Enquiry(
            id=uuid.uuid4(),
            client_config="parth_valves",
            raw_input=email_text.strip(),
            input_type=input_type,
            status=initial_status,
            parsed_data=initial_parsed,
            mailbox_id=mailbox_id,
            created_by_user_id=cb_uid,
            created_by_name=cb_name,
            enquiry_number=eno,
        )
        db.add(enquiry)
        await db.flush()
    else:
        async with async_session_factory() as session:
            eno = await allocate_enquiry_number(session)
            enquiry = Enquiry(
                id=uuid.uuid4(),
                client_config="parth_valves",
                raw_input=email_text.strip(),
                input_type=input_type,
                status=initial_status,
                parsed_data=initial_parsed,
                mailbox_id=mailbox_id,
                created_by_user_id=cb_uid,
                created_by_name=cb_name,
                enquiry_number=eno,
            )
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

    en_row = await get_enquiry(enquiry_id, db)
    eno = (en_row.enquiry_number or "").strip() or None

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
                "enquiry_number": eno,
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
        "enquiry_number": eno,
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


def _email_subject_from_raw(raw: str) -> str:
    for line in (raw or "").split("\n")[:18]:
        if line.lower().startswith("subject:"):
            return line[8:].strip() or "Enquiry"
    return "Enquiry"


def _matcher_to_cascade_filters(matcher: dict, category: str) -> dict[str, str]:
    from services.masters_service import CASCADE_STEPS

    steps = CASCADE_STEPS.get(category, [])
    filled = matcher.get("filled_cascade") or {}
    if not isinstance(filled, dict):
        filled = {}
    consts: dict[str, str] = {}
    for c in matcher.get("constant_columns") or []:
        if isinstance(c, dict) and c.get("key"):
            consts[str(c["key"])] = str(c.get("value") or "").strip()
    derived_keys = {
        str(d["key"])
        for d in (matcher.get("derived_columns") or [])
        if isinstance(d, dict) and d.get("key")
    }
    out: dict[str, str] = {}
    for step in steps:
        if step in derived_keys:
            continue
        v = filled.get(step) or consts.get(step)
        if v and str(v).strip():
            out[str(step)] = str(v).strip()
    return out


def _downgrade_matcher_to_incomplete(enquiry: Enquiry, reason: str) -> None:
    pd = dict(enquiry.parsed_data or {})
    m = dict(pd.get("matcher") or {}) if isinstance(pd.get("matcher"), dict) else {}
    m["auto_quote_note"] = reason
    m["product_completeness"] = "incomplete"
    pd["matcher"] = m
    enquiry.parsed_data = pd
    enquiry.flow_type = "product_incomplete"
    enquiry.status = "matcher_ready"


async def try_automatic_quotation_from_matcher(enquiry: Enquiry, db: AsyncSession) -> dict | None:
    """When matcher is complete, resolve catalog row(s) and run manual quote on this enquiry."""
    from services.masters_service import (
        CASCADE_STEPS,
        SHEET_MODEL_BY_KEY,
        catalog_row_to_size_option,
        get_cascade_matching_rows,
    )

    pd = enquiry.parsed_data if isinstance(enquiry.parsed_data, dict) else {}
    m = pd.get("matcher")
    if not isinstance(m, dict):
        return None
    cat = str(m.get("catalog_key") or "").strip()
    if not cat:
        _downgrade_matcher_to_incomplete(enquiry, "No catalog sheet detected")
        await db.commit()
        return None

    raw_line_items = m.get("line_items")
    if isinstance(raw_line_items, list) and raw_line_items:
        line_entries = raw_line_items
    else:
        line_entries = [{"filled_cascade": m.get("filled_cascade") or {}, "quantity": 1, "index": 1}]

    model_cls = SHEET_MODEL_BY_KEY.get(cat)
    if model_cls is None:
        _downgrade_matcher_to_incomplete(enquiry, "Unknown catalog model")
        await db.commit()
        return None

    line_items_out: list[dict] = []
    steps = CASCADE_STEPS.get(cat, [])

    for entry in line_entries:
        lix = entry.get("index")
        fc = entry.get("filled_cascade") if isinstance(entry.get("filled_cascade"), dict) else {}
        mm = {**m, "filled_cascade": fc}
        filters = _matcher_to_cascade_filters(mm, cat)
        data = await get_cascade_matching_rows(cat, filters, db, limit=120)
        items = data.get("items") or []
        if len(items) == 0:
            _downgrade_matcher_to_incomplete(
                enquiry, f"No catalog row matched for RFQ line {lix or '?'}"
            )
            await db.commit()
            return None

        if len(items) > 1:
            od_cols = [c for c in ("pipe_od", "tc_od") if c in steps]
            for od_col in od_cols:
                distinct_od = {str(r.get(od_col) or "").strip() for r in items}
                distinct_od.discard("")
                if len(distinct_od) != 1:
                    continue
                only = next(iter(distinct_od))
                filters2 = {**filters, od_col: only}
                data2 = await get_cascade_matching_rows(cat, filters2, db, limit=120)
                narrowed = data2.get("items") or []
                if len(narrowed) == 1:
                    items = narrowed
                    break
            if len(items) != 1:
                _downgrade_matcher_to_incomplete(
                    enquiry,
                    f"RFQ line {lix or '?'}: {len(items)} catalog rows still match — complete manually",
                )
                await db.commit()
                return None

        row = items[0]
        cascade_selections = {
            k: str(row.get(k) or "").strip() for k in steps if str(row.get(k) or "").strip()
        }
        rid = row.get("row_id")
        try:
            rid_uuid = rid if isinstance(rid, uuid.UUID) else uuid.UUID(str(rid))
        except (ValueError, TypeError):
            _downgrade_matcher_to_incomplete(enquiry, "Invalid catalog row id")
            await db.commit()
            return None
        orm_row = await db.get(model_cls, rid_uuid)
        if orm_row is None:
            _downgrade_matcher_to_incomplete(enquiry, "Catalog row not found")
            await db.commit()
            return None
        selected = catalog_row_to_size_option(cat, orm_row)
        qty = entry.get("quantity", 1)
        try:
            qn = max(1, int(qty))
        except (TypeError, ValueError):
            qn = 1
        line_items_out.append(
            {
                "category": cat,
                "cascadeSelections": cascade_selections,
                "selectedProduct": selected,
                "quantity": qn,
            }
        )

    client_block = m.get("client") if isinstance(m.get("client"), dict) else {}
    mode = str(client_block.get("mode") or "").strip().lower()
    body: dict = {
        "lineItems": line_items_out,
        "notes": str(pd.get("notes") or "").strip(),
        "priority": str(pd.get("priority") or "Normal").strip() or "Normal",
        "targetEnquiryId": str(enquiry.id),
    }
    if mode == "existing" and client_block.get("selected_client_id"):
        body["clientMode"] = "existing"
        body["selectedClientId"] = str(client_block["selected_client_id"])
    else:
        nc = client_block.get("suggested_new_client") if isinstance(client_block.get("suggested_new_client"), dict) else {}
        body["clientMode"] = "new"
        body["newClient"] = {
            "company_name": str(nc.get("company_name") or "New client").strip(),
            "gst_number": nc.get("gst_number"),
            "industry": nc.get("industry"),
            "branch_name": str(nc.get("branch_name") or "Head Office").strip(),
            "contact_name": str(nc.get("contact_name") or "").strip(),
            "designation": nc.get("designation"),
            "phone": str(nc.get("phone") or ""),
            "email": str(nc.get("email") or ""),
            "city": str(nc.get("city") or "Unknown").strip(),
            "state": nc.get("state"),
            "pincode": nc.get("pincode"),
            "address_line1": nc.get("address_line1"),
            "country": str(nc.get("country") or "India"),
            "address": str(nc.get("address_line1") or ""),
        }

    return await process_manual_dropdown(body, db)


async def _latest_quotation_for_enquiry(
    enquiry_id: uuid.UUID,
    db: AsyncSession,
) -> Quotation | None:
    result = await db.execute(
        select(Quotation)
        .where(Quotation.enquiry_id == enquiry_id)
        .order_by(Quotation.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def decide_email_approval(
    enquiry_id: str,
    decision: str,
    db: AsyncSession,
    *,
    decided_by_user_id: uuid.UUID | None = None,
    decided_by_name: str | None = None,
    notes: str = "",
) -> dict:
    """Approve or reject an inbound email enquiry before product matching."""
    dec = (decision or "").strip().lower()
    if dec not in ("approve", "reject"):
        raise EnquiryParseError("decision must be 'approve' or 'reject'")

    e = await get_enquiry(enquiry_id, db)
    if not is_email_agent_enquiry(e):
        raise EnquiryParseError("Email approval applies only to email / IndiaMart enquiries")

    approval = email_approval_record(e)
    cur = (approval.get("status") or "").strip().lower()
    if cur == "rejected":
        raise EnquiryParseError("This email enquiry was already rejected")
    if cur == "approved" and is_email_approved_for_matcher(e):
        if dec == "reject":
            raise EnquiryParseError("Cannot reject an enquiry that is already approved and processed")
        if e.processing_started_at or (isinstance(e.parsed_data, dict) and e.parsed_data.get("matcher")):
            existing_q = await _latest_quotation_for_enquiry(e.id, db)
            pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
            return {
                "enquiry_id": str(e.id),
                "enquiry_number": (e.enquiry_number or "").strip() or None,
                "status": e.status,
                "flow_type": e.flow_type,
                "message": "Email already approved — matcher has run.",
                "email_approval": email_approval_record(e),
                "quotation_id": str(existing_q.id) if existing_q else pd.get("quotation_id"),
                "already_processed": True,
            }

    now = datetime.now(timezone.utc)
    actor = (decided_by_name or "").strip() or None
    pd = dict(e.parsed_data or {})
    pd["email_approval"] = {
        "status": "approved" if dec == "approve" else "rejected",
        "decided_at": now.isoformat(),
        "decided_by_name": actor,
        "decided_by_user_id": str(decided_by_user_id) if decided_by_user_id else None,
        "notes": (notes or "").strip() or None,
    }
    e.parsed_data = pd

    if dec == "reject":
        e.status = "email_rejected"
        e.flow_type = "rejected"
        e.error_message = (notes or "").strip() or "Email enquiry rejected — product matching skipped."
        await db.commit()
        await db.refresh(e)
        audit = AuditLog(
            id=uuid.uuid4(),
            entity_type="enquiry",
            entity_id=e.id,
            action="email_enquiry_rejected",
            performed_by=actor or "user",
            details={"notes": notes or None},
        )
        db.add(audit)
        await db.commit()
        return {
            "enquiry_id": str(e.id),
            "enquiry_number": (e.enquiry_number or "").strip() or None,
            "status": e.status,
            "flow_type": e.flow_type,
            "message": "Email enquiry rejected — no product matching will run.",
            "email_approval": email_approval_record(e),
            "quotation_id": None,
            "already_processed": False,
        }

    e.status = "email_approved"
    await db.commit()
    await db.refresh(e)

    audit = AuditLog(
        id=uuid.uuid4(),
        entity_type="enquiry",
        entity_id=e.id,
        action="email_enquiry_approved",
        performed_by=actor or "user",
        details={"notes": notes or None},
    )
    db.add(audit)
    await db.commit()

    matcher_result = await process_email_matcher(enquiry_id, db)
    matcher_result["email_approval"] = email_approval_record(await get_enquiry(enquiry_id, db))
    matcher_result["already_processed"] = False
    return matcher_result


async def process_email_matcher(enquiry_id: str, db: AsyncSession) -> dict:
    """Run deterministic matcher; auto-quote when product is complete and uniquely resolved."""
    from services.email_matcher_service import persist_matcher_on_enquiry

    e = await get_enquiry(enquiry_id, db)
    if is_email_agent_enquiry(e) and not is_email_approved_for_matcher(e):
        raise EnquiryParseError(
            "This email must be approved on the enquiry detail page before product matching can run."
        )
    existing_q = await _latest_quotation_for_enquiry(e.id, db)
    if existing_q is not None:
        pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
        pd = {**pd, "quotation_id": str(existing_q.id)}
        e.parsed_data = pd
        if not e.processing_completed_at:
            e.processing_completed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(e)
        return {
            "enquiry_id": str(e.id),
            "enquiry_number": (e.enquiry_number or "").strip() or None,
            "status": e.status,
            "flow_type": e.flow_type,
            "message": "This email already has a quotation — open it to review or edit.",
            "quotation_id": str(existing_q.id),
            "quote_number": existing_q.quote_number,
            "already_quoted": True,
            "requires_human_review": False,
            "matcher": pd.get("matcher") if isinstance(pd.get("matcher"), dict) else {},
        }

    now = datetime.now(timezone.utc)
    e.processing_started_at = now
    await db.commit()

    e = await persist_matcher_on_enquiry(enquiry_id, db)

    quote_block: dict | None = None
    if (e.flow_type or "") == "product_complete":
        quote_block = await try_automatic_quotation_from_matcher(e, db)
        await db.refresh(e)

    e.processing_completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(e)

    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    m = pd.get("matcher") if isinstance(pd.get("matcher"), dict) else {}
    conf = float(m.get("confidence") or e.confidence_score or 0)

    if (e.flow_type or "") == "not_quotation":
        msg = "Not a quotation enquiry — no product match attempted."
    elif quote_block and quote_block.get("quotation_id"):
        msg = "Quotation generated from matcher"
    elif m.get("recommend_revert"):
        msg = str(m.get("revert_reason") or "More details needed — use Revert to client on the enquiry page.")
    elif (e.flow_type or "") == "product_incomplete":
        msg = "Product specification is incomplete — complete on the enquiry page"
    else:
        msg = "Matcher finished"

    out: dict = {
        "enquiry_id": str(e.id),
        "enquiry_number": (e.enquiry_number or "").strip() or None,
        "status": e.status,
        "flow_type": e.flow_type,
        "message": msg,
        "matcher": m,
        "product_completeness": m.get("product_completeness"),
        "matcher_confidence": conf,
        "quotation_id": None,
        "pdf_available": False,
        "pdf_path": None,
        "clarification_questions": None,
        "quote_number": None,
        "subtotal": None,
        "total_amount": None,
        "line_items": [],
        "ai_reasoning": [],
        "requires_human_review": (e.flow_type or "") == "product_incomplete",
    }
    if quote_block:
        out.update(quote_block)
    return out


async def _resolve_manual_client_identity(body: dict, db: AsyncSession) -> dict:
    """Resolve client/branch/employee from manual dropdown request body."""
    from services.client_service import (
        client_for_export,
        create_branch_employee,
        create_company_with_branch,
        get_branch_with_company,
        get_employee_for_branch,
    )

    mode = str(body.get("clientMode") or "").strip().lower()
    selected_client_id = body.get("selectedClientId")
    new_client = body.get("newClient") or {}

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

    employee_for_quote = None
    sel_cid = selected_client_id if isinstance(selected_client_id, str) else ""
    is_dummy_branch = sel_cid.startswith("dummy-")
    if branch_id_uuid is not None and not is_dummy_branch:
        new_emp_body = body.get("newClientEmployee")
        if isinstance(new_emp_body, dict):
            fn = str(new_emp_body.get("fullName") or new_emp_body.get("full_name") or "").strip()
            em_raw = new_emp_body.get("email")
            em_val = str(em_raw).strip() if em_raw is not None and str(em_raw).strip() else None
            if fn:
                ph_raw = new_emp_body.get("phone")
                dept_raw = new_emp_body.get("department")
                des_raw = new_emp_body.get("designation")
                ac_raw = new_emp_body.get("addressCode") or new_emp_body.get("address_code")
                employee_for_quote = await create_branch_employee(
                    branch_id_uuid,
                    full_name=fn,
                    address_code=str(ac_raw).strip() if ac_raw is not None and str(ac_raw).strip() else None,
                    phone=str(ph_raw).strip() if ph_raw is not None and str(ph_raw).strip() else None,
                    email=em_val,
                    department=str(dept_raw).strip() if dept_raw is not None and str(dept_raw).strip() else None,
                    designation=str(des_raw).strip() if des_raw is not None and str(des_raw).strip() else None,
                    db=db,
                )
        if employee_for_quote is None:
            emp_raw = body.get("clientEmployeeId")
            if emp_raw:
                try:
                    eid = uuid.UUID(str(emp_raw))
                except ValueError as exc:
                    raise EnquiryParseError("Invalid clientEmployeeId") from exc
                employee_for_quote = await get_employee_for_branch(eid, branch_id_uuid, db)
                if employee_for_quote is None:
                    raise EnquiryParseError("Client employee not found for this branch")

    if employee_for_quote is not None:
        client_name = employee_for_quote.full_name or client_name
        if employee_for_quote.email:
            client_email = employee_for_quote.email or ""
        if employee_for_quote.phone:
            client_phone = employee_for_quote.phone or ""

    return {
        "mode": mode,
        "selected_client_id": selected_client_id if isinstance(selected_client_id, str) else None,
        "client_name": client_name,
        "client_company": client_company,
        "client_email": client_email,
        "client_phone": client_phone,
        "company_id_uuid": company_id_uuid,
        "branch_id_uuid": branch_id_uuid,
        "client_obj": client_obj,
        "employee_for_quote": employee_for_quote,
    }


async def create_manual_enquiry(
    body: dict,
    db: AsyncSession,
    *,
    created_by_user_id: uuid.UUID | None = None,
    created_by_name: str | None = None,
) -> dict:
    """Step 1 — create enquiry with client details only; products added later on detail page."""
    from services.client_service import increment_branch_enquiry_count

    cb_uid = created_by_user_id
    cb_raw = (created_by_name or "").strip()
    cb_name = cb_raw[:255] if cb_raw else None

    notes = str(body.get("notes") or "").strip()
    priority = str(body.get("priority") or "Normal").strip()
    enquiry_source = str(body.get("source") or "manual").strip().lower() or "manual"
    if enquiry_source not in ("email", "indiamart", "manual", "referral"):
        raise EnquiryParseError("source must be one of: email, indiamart, manual, referral")

    resolved = await _resolve_manual_client_identity(body, db)
    client_name = resolved["client_name"]
    client_company = resolved["client_company"]
    client_email = resolved["client_email"]
    client_phone = resolved["client_phone"]
    company_id_uuid = resolved["company_id_uuid"]
    branch_id_uuid = resolved["branch_id_uuid"]
    employee_for_quote = resolved["employee_for_quote"]
    mode = resolved["mode"]
    selected_client_id = resolved["selected_client_id"]

    enquiry_id = uuid.uuid4()
    manual_client: dict = {"mode": mode}
    if mode == "existing" and selected_client_id:
        manual_client["selected_client_id"] = selected_client_id
    elif mode == "new":
        nc = body.get("newClient") or {}
        manual_client["new_client"] = {
            "company_name": str(nc.get("company_name") or "").strip(),
            "branch_name": str(nc.get("branch_name") or "Head Office").strip(),
            "contact_name": str(nc.get("contact_name") or "").strip(),
            "phone": str(nc.get("phone") or ""),
            "email": str(nc.get("email") or ""),
            "city": str(nc.get("city") or "").strip(),
            "address_line1": str(nc.get("address_line1") or nc.get("address") or "").strip(),
        }

    parsed_data: dict = {
        "client_name": client_name,
        "client_company": client_company,
        "client_email": client_email,
        "client_phone": client_phone,
        "priority": priority,
        "notes": notes,
        "manual_client": manual_client,
        "branch_id": str(branch_id_uuid) if branch_id_uuid else None,
        "client_employee_id": str(employee_for_quote.id) if employee_for_quote else None,
        "enquiry_source": enquiry_source,
    }

    raw_payload = {
        "source": "manual_dropdown",
        "enquiry_source": enquiry_source,
        "stage": "client_only",
        "priority": priority,
        "notes": notes,
        "client": {
            "name": client_name,
            "company": client_company,
            "email": client_email,
            "phone": client_phone,
            "client_employee_id": str(employee_for_quote.id) if employee_for_quote else None,
        },
    }

    enquiry_no = await allocate_enquiry_number(db)
    enquiry = Enquiry(
        id=enquiry_id,
        client_config="parth_valves",
        raw_input=json.dumps(raw_payload, ensure_ascii=False),
        input_type="manual_dropdown",
        status="received",
        flow_type="manual",
        parsed_data=parsed_data,
        matched_products=[],
        created_by_user_id=cb_uid,
        created_by_name=cb_name,
        enquiry_number=enquiry_no,
    )
    if company_id_uuid is not None:
        enquiry.company_id = company_id_uuid
    if branch_id_uuid is not None:
        enquiry.branch_id = branch_id_uuid

    db.add(enquiry)
    await db.commit()
    await db.refresh(enquiry)

    if branch_id_uuid is not None:
        await increment_branch_enquiry_count(str(branch_id_uuid), db)

    audit = AuditLog(
        id=uuid.uuid4(),
        entity_type="enquiry",
        entity_id=enquiry_id,
        action="manual_enquiry_created",
        performed_by="user",
        details={"client_company": client_company, "client_name": client_name},
    )
    db.add(audit)
    await db.commit()

    return {
        "enquiry_id": str(enquiry_id),
        "enquiry_number": (enquiry.enquiry_number or "").strip() or None,
        "status": "received",
        "flow_type": "manual",
        "message": "Enquiry created — add products on the enquiry page to generate a quotation",
        "quotation_id": None,
        "pdf_available": False,
        "pdf_path": None,
        "quote_number": None,
        "subtotal": None,
        "total_amount": None,
        "line_items": [],
        "ai_reasoning": [],
        "requires_human_review": False,
    }


async def process_manual_dropdown(
    body: dict,
    db: AsyncSession,
    *,
    created_by_user_id: uuid.UUID | None = None,
    created_by_name: str | None = None,
) -> dict:
    """Step 2 — add products to an existing enquiry and generate a quotation."""
    from services.client_service import (
        client_for_export,
        increment_branch_enquiry_count,
        set_company_default_discount,
    )
    from services.erp_export_service import generate_enquiry_list_excel
    from services.pdf_service import generate_quotation_pdf

    settings = get_settings()
    client_json = settings.get_client_json()
    gst_rate = float(client_json.get("default_gst_rate", 18.0))
    pf_rate = float(client_json.get("default_pf_rate", 3.0))

    cb_uid = created_by_user_id
    cb_raw = (created_by_name or "").strip()
    cb_name = cb_raw[:255] if cb_raw else None
    prepared_by_email: str | None = None
    prepared_by_phone: str | None = None
    if cb_uid is not None:
        creator_user = await db.get(User, cb_uid)
        if creator_user is not None:
            if getattr(creator_user, "email", None):
                prepared_by_email = str(creator_user.email).strip() or None
            if getattr(creator_user, "phone", None):
                prepared_by_phone = str(creator_user.phone).strip() or None

    line_items_in = body.get("lineItems") or []
    notes = str(body.get("notes") or "").strip()
    priority = str(body.get("priority") or "Normal").strip()
    target_raw = str(body.get("targetEnquiryId") or body.get("target_enquiry_id") or "").strip()

    if not target_raw:
        raise EnquiryParseError(
            "targetEnquiryId is required — create an enquiry first, then add products on its detail page."
        )

    try:
        enquiry_uuid = uuid.UUID(target_raw)
    except ValueError as exc:
        raise EnquiryParseError("Invalid target enquiry id") from exc

    existing_enquiry = await get_enquiry(target_raw, db)
    qcnt = (
        await db.execute(
            select(func.count()).select_from(Quotation).where(Quotation.enquiry_id == enquiry_uuid)
        )
    ).scalar_one()
    if int(qcnt or 0) > 0:
        raise EnquiryParseError("This enquiry already has a quotation — open the quotation to edit it.")

    resolved = await _resolve_manual_client_identity(body, db)
    client_name = resolved["client_name"]
    client_company = resolved["client_company"]
    client_email = resolved["client_email"]
    client_phone = resolved["client_phone"]
    company_id_uuid = resolved["company_id_uuid"]
    branch_id_uuid = resolved["branch_id_uuid"]
    client_obj = resolved["client_obj"]
    employee_for_quote = resolved["employee_for_quote"]
    selected_client_id = resolved["selected_client_id"]

    enquiry_id = enquiry_uuid

    parsed_products, matched_products, quote_line_items, history_rows = expand_manual_line_items_to_quote_parts(
        line_items_in
    )

    chosen_discount_pct: float | None = None
    for li in line_items_in:
        if not isinstance(li, dict):
            continue
        d = _normalize_discount_pct(li.get("customer_discount_pct"))
        if d is None:
            continue
        chosen_discount_pct = d
        break

    quote_line_items, subtotal, gst_amount, pf_amount, total_amount = _calc_totals(
        quote_line_items, gst_rate=gst_rate, pf_rate=pf_rate
    )

    order_totals_in = body.get("orderTotals") or body.get("order_totals") or {}
    pf_applicable = True
    pf_amount_override: float | None = None
    raw_pf_rate = None
    if isinstance(order_totals_in, dict):
        pf_applicable = bool(
            order_totals_in.get("pf_applicable", order_totals_in.get("pfApplicable", True))
        )
        raw_pf = order_totals_in.get("pf_amount", order_totals_in.get("pfAmount"))
        raw_pf_rate = order_totals_in.get("pf_rate", order_totals_in.get("pfRate"))
        if raw_pf is not None and str(raw_pf).strip() != "":
            pf_amount_override = round(_clean_float(raw_pf, 0.0), 2)

    if not pf_applicable:
        pf_amount = 0.0
        pf_rate = 0.0
    elif pf_amount_override is not None:
        pf_amount = pf_amount_override
        if raw_pf_rate is not None and str(raw_pf_rate).strip() != "":
            pf_rate = round(_clean_float(raw_pf_rate, 0.0), 2)
        elif subtotal > 0:
            pf_rate = round((pf_amount / subtotal) * 100.0, 2)
    else:
        pf_amount = round(subtotal * (pf_rate / 100.0), 2)

    freight_applicable = False
    freight_amount = 0.0
    freight_rate: float | None = None
    if isinstance(order_totals_in, dict):
        freight_applicable = bool(
            order_totals_in.get("freight_applicable", order_totals_in.get("freightApplicable", False))
        )
        raw_freight = order_totals_in.get("freight_amount", order_totals_in.get("freightAmount"))
        raw_freight_rate = order_totals_in.get("freight_rate", order_totals_in.get("freightRate"))
        if freight_applicable:
            if raw_freight is not None and str(raw_freight).strip() != "":
                freight_amount = round(_clean_float(raw_freight, 0.0), 2)
            mode = str(
                order_totals_in.get("freight_mode", order_totals_in.get("freightMode", "amount")) or "amount"
            ).strip().lower()
            if raw_freight_rate is not None and str(raw_freight_rate).strip() != "":
                freight_rate = round(_clean_float(raw_freight_rate, 0.0), 2)
            elif mode == "percent" and subtotal > 0 and freight_amount > 0:
                freight_rate = round((freight_amount / subtotal) * 100.0, 2)

    taxable_subtotal = round(subtotal + pf_amount + freight_amount, 2)
    gst_amount = round(taxable_subtotal * (gst_rate / 100.0), 2)
    total_amount = round(taxable_subtotal + gst_amount, 2)
    freight_note = "Extra at actual" if not freight_applicable or freight_amount <= 0 else ""

    raw_payload: dict = {
        "source": "manual_dropdown",
        "priority": priority,
        "notes": notes,
        "client": {
            "name": client_name,
            "company": client_company,
            "email": client_email,
            "phone": client_phone,
            "client_employee_id": str(employee_for_quote.id) if employee_for_quote else None,
        },
        "line_items": quote_line_items,
        # Full configurator payload for quotation edit / rehydrate UI.
        "manual_line_items": line_items_in,
        "order_totals": {
            "pf_applicable": pf_applicable,
            "pf_amount": pf_amount,
            "pf_rate": pf_rate,
            "freight_applicable": freight_applicable,
            "freight_amount": freight_amount,
            "freight_rate": freight_rate,
            "freight_mode": (
                order_totals_in.get("freight_mode", order_totals_in.get("freightMode"))
                if isinstance(order_totals_in, dict)
                else None
            ),
        },
    }
    sp = body.get("supplierPricing")
    if isinstance(sp, dict):
        raw_payload["supplierPricing"] = sp

    parsed_data_new: dict = {
        "client_name": client_name,
        "client_company": client_company,
        "client_email": client_email,
        "client_phone": client_phone,
        "priority": priority,
        "notes": notes,
        "products_requested": parsed_products,
        "manual_line_items": line_items_in,
        "client_employee_id": str(employee_for_quote.id) if employee_for_quote else None,
    }

    enquiry = existing_enquiry
    prev_pd = dict(enquiry.parsed_data or {})
    matcher_keep = prev_pd.get("matcher") if isinstance(prev_pd.get("matcher"), dict) else None
    merged_pd = {**prev_pd, **parsed_data_new}
    if matcher_keep is not None:
        merged_pd["matcher"] = matcher_keep
    enquiry.parsed_data = merged_pd
    enquiry.matched_products = matched_products
    enquiry.status = "approved"
    enquiry.flow_type = "complete"
    enquiry.company_id = company_id_uuid
    enquiry.branch_id = branch_id_uuid
    enquiry.raw_input = json.dumps(raw_payload, ensure_ascii=False)
    await db.commit()

    quote_number = await allocate_quote_number(db)
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
        "freight_note": freight_note,
        "freight_amount": freight_amount,
        "freight_rate": freight_rate,
        "total_amount": total_amount,
        "professional_notes": notes or "",
        "validity_days": int(client_json.get("quote_validity_days", 15)),
        "enquiry_id": str(enquiry_id),
        "enquiry_number": (enquiry.enquiry_number or "").strip() or None,
        "enquiry_date": enquiry.created_at.strftime("%d/%m/%Y") if enquiry.created_at else "",
        "quotation_date": datetime.now(timezone.utc).strftime("%d/%m/%Y"),
    }
    if cb_name:
        quotation_data["prepared_by_name"] = cb_name
    if prepared_by_email:
        quotation_data["prepared_by_email"] = prepared_by_email
    if prepared_by_phone:
        quotation_data["prepared_by_phone"] = prepared_by_phone
    if employee_for_quote is not None:
        quotation_data["quotation_client_employee"] = {
            "full_name": str(employee_for_quote.full_name or "").strip(),
            "address_code": str(getattr(employee_for_quote, "address_code", None) or "").strip(),
            "phone": str(getattr(employee_for_quote, "phone", None) or "").strip(),
            "email": str(getattr(employee_for_quote, "email", None) or "").strip(),
            "department": str(getattr(employee_for_quote, "department", None) or "").strip(),
            "designation": str(getattr(employee_for_quote, "designation", None) or "").strip(),
        }

    quotation = Quotation(
        id=quotation_id,
        enquiry_id=enquiry_id,
        quote_number=quote_number,
        client_name=client_name,
        client_company=client_company,
        client_email=client_email,
        client_phone=client_phone,
        client_employee_id=(employee_for_quote.id if employee_for_quote else None),
        line_items=quote_line_items,
        subtotal=subtotal,
        gst_rate=gst_rate,
        gst_amount=gst_amount,
        pf_rate=pf_rate,
        pf_amount=pf_amount,
        freight_note=freight_note or "Extra at actual",
        freight_amount=freight_amount,
        freight_rate=freight_rate,
        total_amount=total_amount,
        validity_days=int(client_json.get("quote_validity_days", 15)),
        validity_date=datetime.now(timezone.utc).date()
        + timedelta(days=max(0, int(client_json.get("quote_validity_days", 15)))),
        status="ongoing",
        notes=notes or None,
        created_by_user_id=cb_uid,
        created_by_name=cb_name,
        created_by_phone=prepared_by_phone,
        is_archived=False,
    )
    db.add(quotation)
    await db.commit()

    pd_quote = dict(enquiry.parsed_data or {})
    pd_quote["quotation_id"] = str(quotation_id)
    enquiry.parsed_data = pd_quote
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
            erp_subject = (
                _email_subject_from_raw(enquiry.raw_input or "")
                if existing_enquiry is not None
                else "Manual dropdown enquiry"
            )
            erp_path = await generate_enquiry_list_excel(
                enquiry_id=str(enquiry_id),
                client=client_obj,
                parsed_data=enquiry.parsed_data or {},
                matched_products=matched_products,
                quotation_data=quotation_data,
                input_type=enquiry.input_type,
                subject=erp_subject,
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
    if company_id_uuid is not None and chosen_discount_pct is not None:
        await set_company_default_discount(company_id_uuid, chosen_discount_pct, db)

    return {
        "enquiry_id": str(enquiry_id),
        "enquiry_number": (enquiry.enquiry_number or "").strip() or None,
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


def enquiry_inbox_pipeline_processed(e: Enquiry) -> bool:
    """True once AI/manual pipeline has touched the enquiry or a quote exists."""
    st = (e.status or "").strip().lower()
    if st == "pending_email_approval":
        return False
    if st == "email_rejected":
        return True
    if requires_email_approval(e):
        return False
    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    has_quotation = bool(getattr(e, "branch_id", None)) or bool(pd.get("quotation_id"))
    return bool(
        e.processing_started_at is not None
        or e.processing_completed_at is not None
        or has_quotation
        or (st and st not in ("received", "email_approved"))
    )


async def list_enquiries(
    db: AsyncSession,
    status: str | None = None,
    flow_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
    company_id: str | None = None,
    created_by_user_id: uuid.UUID | None = None,
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
    if created_by_user_id is not None:
        stmt = stmt.where(Enquiry.created_by_user_id == created_by_user_id)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def latest_quotations_by_enquiry_ids(
    db: AsyncSession,
    enquiry_ids: list[uuid.UUID],
) -> dict[str, Quotation]:
    """Most recent quotation per enquiry (for listing quote ref + item desc)."""
    if not enquiry_ids:
        return {}
    stmt = (
        select(Quotation)
        .where(Quotation.enquiry_id.in_(enquiry_ids))
        .order_by(Quotation.created_at.desc())
    )
    result = await db.execute(stmt)
    out: dict[str, Quotation] = {}
    for q in result.scalars().all():
        key = str(q.enquiry_id)
        if key not in out:
            out[key] = q
    return out


def item_desc_short_from_enquiry(e: Enquiry, quotation: Quotation | None = None) -> str:
    from services.quotation_service import item_desc_short_from_lines

    if quotation is not None and isinstance(quotation.line_items, list) and quotation.line_items:
        return item_desc_short_from_lines(quotation.line_items)
    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    line_items = pd.get("line_items")
    if isinstance(line_items, list) and line_items:
        return item_desc_short_from_lines(line_items)
    products = pd.get("products_requested", []) if isinstance(pd, dict) else []
    if not isinstance(products, list):
        return "—"
    bits: list[str] = []
    for p in products[:3]:
        if not isinstance(p, dict):
            continue
        desc = str(p.get("product_description") or p.get("description") or "").strip()
        if not desc:
            continue
        if len(desc) > 36:
            desc = desc[:33] + "..."
        bits.append(desc)
    if not bits:
        return "—"
    out = " · ".join(bits)
    if len(products) > 3:
        out += " …"
    return out[:250]


def item_desc_lines_from_enquiry(e: Enquiry, quotation: Quotation | None = None) -> list[dict[str, str]]:
    from services.quotation_service import item_desc_lines_from_lines

    if quotation is not None and isinstance(quotation.line_items, list) and quotation.line_items:
        return item_desc_lines_from_lines(quotation.line_items)
    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    line_items = pd.get("line_items")
    if isinstance(line_items, list) and line_items:
        return item_desc_lines_from_lines(line_items)
    products = pd.get("products_requested", []) if isinstance(pd, dict) else []
    if not isinstance(products, list):
        return []
    out: list[dict[str, str]] = []
    for p in products:
        if not isinstance(p, dict):
            continue
        full = str(p.get("product_description") or p.get("description") or "").strip()
        if not full:
            continue
        short = full if len(full) <= 52 else full[:49] + "..."
        out.append({"short": short, "full": full})
    return out


async def archive_enquiry(
    enquiry_id: str,
    db: AsyncSession,
    *,
    performed_by: str = "user",
    performed_by_name: str | None = None,
) -> Enquiry:
    e = await get_enquiry(enquiry_id, db)
    if e.is_archived:
        return e
    e.is_archived = True
    await db.execute(
        update(Quotation)
        .where(Quotation.enquiry_id == e.id, Quotation.is_archived.is_(False))
        .values(is_archived=True)
    )
    db.add(
        AuditLog(
            id=uuid.uuid4(),
            entity_type="enquiry",
            entity_id=e.id,
            action="enquiry_archived",
            performed_by=performed_by or "user",
            details={
                "performed_by_name": performed_by_name,
                "enquiry_id": str(e.id),
                "enquiry_number": e.enquiry_number,
            },
        )
    )
    await db.commit()
    await db.refresh(e)
    return e


async def assign_enquiry_user(
    enquiry_id: str,
    assignee_user_id: uuid.UUID,
    db: AsyncSession,
    *,
    performed_by: str = "user",
    performed_by_name: str | None = None,
) -> Enquiry:
    e = await get_enquiry(enquiry_id, db)
    assignee = (
        await db.execute(
            select(User).where(
                User.id == assignee_user_id,
                User.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if assignee is None:
        raise ValueError("User not found or inactive")
    if str(getattr(assignee, "tier", "") or "") == "superadmin":
        raise ValueError("Cannot assign enquiries to super admin")

    old_user_id = str(e.created_by_user_id) if e.created_by_user_id else None
    old_user_name = (e.created_by_name or "").strip() or None
    new_name = (assignee.full_name or "").strip() or str(assignee.email).strip()

    e.created_by_user_id = assignee.id
    e.created_by_name = new_name or None

    assignee_phone = (assignee.phone or "").strip() or None
    await db.execute(
        update(Quotation)
        .where(Quotation.enquiry_id == e.id)
        .values(
            created_by_user_id=assignee.id,
            created_by_name=new_name or None,
            created_by_phone=assignee_phone,
        )
    )

    db.add(
        AuditLog(
            id=uuid.uuid4(),
            entity_type="enquiry",
            entity_id=e.id,
            action="enquiry_assigned",
            performed_by=performed_by or "user",
            details={
                "performed_by_name": performed_by_name,
                "enquiry_id": str(e.id),
                "enquiry_number": e.enquiry_number,
                "from_user_id": old_user_id,
                "from_user_name": old_user_name,
                "to_user_id": str(assignee.id),
                "to_user_name": new_name,
            },
        )
    )
    await db.commit()
    await db.refresh(e)
    return e


async def update_enquiry_listing_dates(
    enquiry_id: str,
    db: AsyncSession,
    *,
    next_follow_up_date: date | None,
    set_follow_up: bool,
    performed_by: str = "user",
    performed_by_name: str | None = None,
) -> Enquiry:
    e = await get_enquiry(enquiry_id, db)
    if not set_follow_up:
        return e
    e.next_follow_up_date = next_follow_up_date
    db.add(
        AuditLog(
            id=uuid.uuid4(),
            entity_type="enquiry",
            entity_id=e.id,
            action="enquiry_listing_dates",
            performed_by=performed_by or "user",
            details={
                "performed_by_name": performed_by_name,
                "enquiry_id": str(e.id),
                "enquiry_number": e.enquiry_number,
                "next_follow_up_date": (
                    next_follow_up_date.isoformat() if next_follow_up_date else None
                ),
            },
        )
    )
    await db.commit()
    await db.refresh(e)
    return e


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

    sender_name = str(parsed.get("client_name", "") or "").strip()
    sender_email = str(parsed.get("client_email", "") or "").strip()
    company = str(parsed.get("client_company", "") or "").strip()
    if not company or company.lower() == "unknown":
        company = infer_company_from_email_raw(e.raw_input) or "Unknown"

    if (not sender_name or sender_name.lower() == "unknown") and company and company != "Unknown":
        sender_name = company

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
        getattr(e, "client_verification_status", None) == "pending"
        or e.status == "pending_approval"
        or e.status == "pending_email_approval"
        or requires_email_approval(e)
    )

    has_quotation = bool(getattr(e, "branch_id", None)) or bool(
        (e.parsed_data or {}).get("quotation_id") if isinstance(e.parsed_data, dict) else False
    )
    inbox_processed = enquiry_inbox_pipeline_processed(e)

    display_name = company if company and company != "Unknown" else (sender_name or "Unknown")

    eno = (getattr(e, "enquiry_number", None) or "").strip() or None

    return {
        "enquiry_id": str(e.id),
        "enquiry_number": eno,
        "sender_name": sender_name or display_name,
        "sender_email": sender_email,
        "company": company,
        "display_name": display_name,
        "subject": subject,
        "preview": preview,
        "category": category,
        "status": e.status,
        "flow_type": e.flow_type,
        "confidence": e.confidence_score,
        "input_type": e.input_type,
        "created_at": e.created_at.isoformat() if e.created_at else "",
        "has_quotation": has_quotation,
        "inbox_processed": inbox_processed,
        "awaiting_human": awaiting_human,
        "hitl_cycle": int(getattr(e, "hitl_cycle", 0) or 0),
    }


async def list_email_enquiries(
    db: AsyncSession,
    *,
    viewable_mailbox_ids: list[uuid.UUID],
    is_superadmin: bool,
    mailbox_id_filter: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
) -> list[dict]:
    st_result = await db.execute(select(EmailSyncState).where(EmailSyncState.id == 1))
    legacy_sync_state = st_result.scalar_one_or_none()
    legacy_baseline = legacy_sync_state.baseline_at if legacy_sync_state else None

    mids = list(viewable_mailbox_ids)
    if is_superadmin:
        mr = await db.execute(select(Mailbox.id).where(Mailbox.is_active.is_(True)))
        mids = [row[0] for row in mr.all()]

    baselines: dict[uuid.UUID, datetime | None] = {}
    baseline_ids = set(mids)
    if mailbox_id_filter is not None:
        baseline_ids.add(mailbox_id_filter)
    if baseline_ids:
        br = await db.execute(select(MailboxSyncState).where(MailboxSyncState.mailbox_id.in_(baseline_ids)))
        for st in br.scalars().all():
            baselines[st.mailbox_id] = st.baseline_at

    parts: list = []

    if mailbox_id_filter is None:
        parts.append(Enquiry.input_type == "email")

    if (
        mailbox_id_filter is None
        and legacy_baseline is not None
        and (is_superadmin or len(viewable_mailbox_ids) > 0)
    ):
        parts.append(
            and_(
                Enquiry.input_type == "email_sync",
                Enquiry.mailbox_id.is_(None),
                Enquiry.created_at >= legacy_baseline,
            )
        )

    target_mids = [mailbox_id_filter] if mailbox_id_filter is not None else mids
    for mid in target_mids:
        bl = baselines.get(mid)
        if bl is None:
            continue
        parts.append(
            and_(Enquiry.input_type == "email_sync", Enquiry.mailbox_id == mid, Enquiry.created_at >= bl)
        )

    if not parts:
        q = select(Enquiry).where(false())
    else:
        q = select(Enquiry).where(or_(*parts))

    if status:
        q = q.where(Enquiry.status == status)

    fetch_cap = min(500, max(150, (offset + limit) * 5))
    q = q.order_by(desc(Enquiry.created_at)).limit(fetch_cap)
    result = await db.execute(q)
    rows = result.scalars().all()

    matches: list[dict] = []
    for e in rows:
        if not raw_input_is_quotation_work_related(e.raw_input):
            continue
        if not is_superadmin and e.input_type == "email_sync" and e.mailbox_id is not None:
            if e.mailbox_id not in viewable_mailbox_ids:
                continue
        if not is_superadmin and e.input_type == "email_sync" and e.mailbox_id is None:
            if not viewable_mailbox_ids:
                continue
        row_dict = _format_for_inbox(e)
        if e.mailbox_id:
            row_dict["mailbox_id"] = str(e.mailbox_id)
        matches.append(row_dict)

    return matches[offset : offset + limit]
