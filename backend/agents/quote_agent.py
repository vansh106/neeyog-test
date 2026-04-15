"""Agent responsible for assembling matched products into a quotation."""

import json
import logging
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from agents.state import EnquiryState, emit
from services.sse_service import evt_agent_start, evt_agent_complete, evt_agent_warning, evt_agent_error
from core.config import get_settings
from core.database import async_session_factory
from core.litellm_client import llm_client, strip_llm_json_payload
from db.models import Enquiry, Quotation
from services.pdf_service import generate_quotation_pdf

logger = logging.getLogger(__name__)


def _coerce_notes_field(raw: object) -> str | None:
    """DB column is Text (str). LLMs sometimes return a list of bullet strings."""
    if raw is None:
        return None
    if isinstance(raw, list):
        parts = [str(x).strip() for x in raw if x is not None and str(x).strip()]
        return "\n".join(parts) if parts else None
    if isinstance(raw, dict):
        return json.dumps(raw, ensure_ascii=False)
    s = str(raw).strip()
    return s if s else None


def _allocate_quote_number() -> str:
    """Server-side unique id; LLM-suggested QT-*-NNNN collides when prompts repeat."""
    return f"QT-{date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"


def _safe_float(value: object, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_line_items_and_totals(
    line_items: list,
    gst_rate: float,
    pf_rate: float,
) -> tuple[list, float, float, float, float]:
    """Derive subtotal / GST / P&F / total from line items (do not trust LLM rollups)."""
    normalized: list = []
    subtotal = 0.0

    for raw in line_items:
        if not isinstance(raw, dict):
            continue
        qty = _safe_float(raw.get("quantity"), 1.0)
        if qty <= 0:
            qty = 1.0
        unit_price = _safe_float(raw.get("unit_price"), 0.0)
        computed = round(qty * unit_price, 2)
        if raw.get("line_total") is not None:
            line_total = _safe_float(raw.get("line_total"), 0.0)
            if line_total == 0 and computed > 0:
                line_total = computed
        else:
            line_total = _safe_float(raw.get("total"), computed)

        row = {**raw, "quantity": int(qty) if qty == int(qty) else qty, "unit_price": unit_price}
        line_total = round(line_total, 2)
        row["line_total"] = line_total
        if "total" in row and row["total"] != line_total:
            row["total"] = line_total
        normalized.append(row)
        subtotal += line_total

    subtotal = round(subtotal, 2)
    gst_amount = round(subtotal * (gst_rate / 100.0), 2)
    pf_amount = round(subtotal * (pf_rate / 100.0), 2)
    total_amount = round(subtotal + gst_amount + pf_amount, 2)
    return normalized, subtotal, gst_amount, pf_amount, total_amount


async def quote_agent(state: EnquiryState) -> EnquiryState:
    enquiry_id = state.get("enquiry_id", "unknown")
    logger.info("Quote agent starting for enquiry %s", enquiry_id)

    matched_products = state.get("matched_products") or []
    flow_type = state.get("flow_type")

    if not matched_products or flow_type in ("incomplete", "not_found"):
        logger.info("Quote agent skipped — no matched products or flow_type=%s", flow_type)
        return state

    try:
        settings = get_settings()
        prompts = settings.get_client_module("prompts")
        client_json = settings.get_client_json()

        parsed_data = state.get("parsed_data") or {}
        client_name = parsed_data.get("client_name") or "Customer"
        client_company = parsed_data.get("client_company") or ""
        client_email = parsed_data.get("client_email") or ""
        client_phone = parsed_data.get("client_phone") or ""

        await emit(state, evt_agent_start(
            agent="quote_builder",
            message="Building your quotation",
            detail=f"Preparing quote for {client_name}",
        ))

        products_with_qty = []
        products_requested = parsed_data.get("products_requested") or []
        for i, match in enumerate(matched_products):
            if not match.get("matched"):
                continue
            qty = 1
            if i < len(products_requested):
                qty = int(products_requested[i].get("quantity") or 1)
            products_with_qty.append({**match, "quantity": qty})

        today = date.today().isoformat()
        gst_rate = client_json.get("default_gst_rate", 18.0)
        pf_rate = client_json.get("default_pf_rate", 3.0)

        user_prompt = (
            f"Build a quotation for:\n\n"
            f"Customer: {client_name} from {client_company}\n\n"
            f"Products to quote:\n{json.dumps(products_with_qty, indent=2)}\n\n"
            f"GST Rate: {gst_rate}%\n"
            f"P&F Rate: {pf_rate}%\n"
            f"Today's Date: {today}\n\n"
            "Calculate all totals and return structured JSON."
        )

        await emit(state, evt_agent_start(
            agent="quote_builder",
            message="Calculating totals — GST 18% + P&F 3%",
            detail="Applying current pricelist rates",
        ))

        response_text = await llm_client.complete(
            system_prompt=prompts.QUOTE_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_format="json",
        )

        quotation_data = json.loads(strip_llm_json_payload(response_text))

        raw_items = quotation_data.get("line_items") or []
        if not isinstance(raw_items, list):
            raw_items = []

        line_items, subtotal, gst_amount, pf_amount, total_amount = (
            normalize_line_items_and_totals(raw_items, gst_rate, pf_rate)
        )
        quotation_data["line_items"] = line_items
        quotation_data["subtotal"] = subtotal
        quotation_data["gst_amount"] = gst_amount
        quotation_data["pf_amount"] = pf_amount
        quotation_data["total_amount"] = total_amount
        quotation_data["gst_rate"] = gst_rate
        quotation_data["pf_rate"] = pf_rate
        if not quotation_data.get("freight_note"):
            quotation_data["freight_note"] = "Extra at actual"

        notes = _coerce_notes_field(
            quotation_data.get("professional_notes")
            if quotation_data.get("professional_notes") is not None
            else quotation_data.get("notes")
        )

        quote_number = _allocate_quote_number()
        quotation_data["quote_number"] = quote_number
        quotation_data["professional_notes"] = notes or ""

        requires_review = state.get("requires_human_review", False)
        q_status = "draft" if requires_review else "approved"

        quotation_id = uuid.uuid4()
        async with async_session_factory() as session:
            last_err: Exception | None = None
            for attempt in range(5):
                if attempt > 0:
                    quote_number = _allocate_quote_number()
                    quotation_data["quote_number"] = quote_number
                quotation = Quotation(
                    id=quotation_id,
                    enquiry_id=enquiry_id,
                    quote_number=quote_number,
                    client_name=client_name,
                    client_company=client_company,
                    client_email=client_email,
                    client_phone=client_phone,
                    line_items=line_items,
                    subtotal=subtotal,
                    gst_rate=gst_rate,
                    gst_amount=gst_amount,
                    pf_rate=pf_rate,
                    pf_amount=pf_amount,
                    total_amount=total_amount,
                    validity_days=client_json.get("quote_validity_days", 15),
                    status=q_status,
                    notes=notes,
                )
                session.add(quotation)

                result = await session.execute(
                    select(Enquiry).where(Enquiry.id == enquiry_id)
                )
                enquiry = result.scalar_one_or_none()
                if enquiry:
                    enquiry.status = "pending_approval" if requires_review else "approved"
                try:
                    await session.commit()
                    last_err = None
                    break
                except IntegrityError as e:
                    last_err = e
                    await session.rollback()
                    session.expunge(quotation)
                    logger.warning(
                        "Quote insert collision (attempt %s): %s", attempt + 1, e
                    )
            if last_err is not None:
                raise last_err

        await emit(state, evt_agent_complete(
            agent="quote_builder",
            message="Quotation calculated",
            data={
                "quote_number": quote_number,
                "line_items": len(line_items),
                "subtotal": subtotal,
                "total_amount": total_amount,
            },
        ))

        await emit(state, evt_agent_start(
            agent="quote_builder",
            message="Generating PDF quotation",
            detail="Creating branded PDF document",
        ))

        pdf_path = await generate_quotation_pdf(quotation_data, client_json)

        if pdf_path:
            async with async_session_factory() as session:
                result = await session.execute(
                    select(Quotation).where(Quotation.id == quotation_id)
                )
                q = result.scalar_one_or_none()
                if q:
                    q.pdf_path = pdf_path
                    await session.commit()

        if pdf_path:
            await emit(state, evt_agent_complete(
                agent="quote_builder",
                message="PDF ready",
                data={"pdf_path": pdf_path, "quote_number": quote_number},
            ))

        if state.get("requires_human_review"):
            await emit(state, evt_agent_warning(
                agent="quote_builder",
                message="Quotation flagged for human review",
                detail="AI confidence was below threshold — please verify before sending",
            ))

        reasoning = list(state.get("ai_reasoning", []))
        reasoning.append(
            f"Quote built: {quote_number}, total=₹{total_amount:.2f}, "
            f"items={len(line_items)}, status={q_status}"
        )

        return {
            **state,
            "quotation_data": quotation_data,
            "quote_id": str(quotation_id),
            "pdf_path": pdf_path,
            "current_step": "quoted",
            "ai_reasoning": reasoning,
        }

    except json.JSONDecodeError as e:
        logger.error("Quote agent: failed to parse LLM JSON: %s", e)
        await emit(state, evt_agent_error(agent="quote_builder", message=f"Quotation build failed: {e}"))
        return {
            **state,
            "error": f"Quote JSON decode error: {e}",
            "current_step": "quote_failed",
        }
    except Exception as e:
        logger.error("Quote agent failed: %s", e)
        await emit(state, evt_agent_error(agent="quote_builder", message=f"Quotation build failed: {e}"))
        return {
            **state,
            "error": f"Quote error: {e}",
            "current_step": "quote_failed",
        }
