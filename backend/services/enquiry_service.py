"""Enquiry business logic — processes email enquiries, manages enquiry lifecycle.

Pure service — no FastAPI imports, no HTTPException.
Raises only from core.exceptions.
"""

import asyncio
import logging
import uuid

from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import get_settings
from core.database import async_session_factory
from core.exceptions import EnquiryParseError, ProductNotFoundError
from db.models import AuditLog, Enquiry
from orchestrator.graph import enquiry_graph, resume_enquiry_flow, run_enquiry_flow
from orchestrator.graph import resume_client_verification_flow

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
    input_type: str = "email",
    db: AsyncSession | None = None,
) -> dict:
    """Run the AI agent pipeline on an enquiry and return a clean result dict."""
    settings = get_settings()
    raw_input, input_type = preprocess_raw_input(raw_input, input_type)
    try:
        final_state = await asyncio.wait_for(
            run_enquiry_flow(
                enquiry_id=enquiry_id,
                raw_input=raw_input,
                input_type=input_type,
                client_config="parth_valves",
            ),
            timeout=settings.ENQUIRY_FLOW_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        raise EnquiryParseError(
            f"Enquiry processing exceeded {settings.ENQUIRY_FLOW_TIMEOUT_SECONDS:.0f}s timeout "
            "(LLM or PDF step too slow). Increase ENQUIRY_FLOW_TIMEOUT_SECONDS or use a faster model."
        ) from None

    current_step = final_state.get("current_step", "unknown")

    if final_state.get("error"):
        raise EnquiryParseError(final_state["error"])

    async with async_session_factory() as session:
        audit = AuditLog(
            id=uuid.uuid4(),
            entity_type="enquiry",
            entity_id=enquiry_id,
            action="ai_processed",
            performed_by="system",
            details={
                "flow_type": final_state.get("flow_type"),
                "current_step": current_step,
                "has_quotation": final_state.get("quotation_data") is not None,
            },
        )
        session.add(audit)
        await session.commit()

    return {
        "enquiry_id": str(enquiry_id),
        "status": current_step,
        "flow_type": final_state.get("flow_type"),
        "message": STATUS_MAP.get(current_step, f"Step: {current_step}"),
        "quotation_id": final_state.get("quote_id"),
        "pdf_available": final_state.get("pdf_path") is not None,
        "pdf_path": final_state.get("pdf_path"),
        "clarification_questions": final_state.get("clarification_questions"),
        "ai_reasoning": final_state.get("ai_reasoning", []),
        "requires_human_review": final_state.get("requires_human_review", False),
    }


async def process_enquiry_streaming(
    enquiry_id: str,
    raw_input: str,
    input_type: str,
    emitter,
) -> None:
    """Run the agent pipeline with live SSE event emission.

    When the graph pauses at HITL, the hitl_required event has already
    been emitted by human_review_node. We just close the stream.
    When the graph completes, we emit the final result event.
    """
    from services.sse_service import evt_agent_error, evt_result

    settings = get_settings()
    raw_input, input_type = preprocess_raw_input(raw_input, input_type)
    try:
        final_state = await asyncio.wait_for(
            run_enquiry_flow(
                enquiry_id=enquiry_id,
                raw_input=raw_input,
                input_type=input_type,
                client_config="parth_valves",
                emitter=emitter,
            ),
            timeout=settings.ENQUIRY_FLOW_TIMEOUT_SECONDS,
        )

        current_step = final_state.get("current_step", "unknown")

        async with async_session_factory() as session:
            audit = AuditLog(
                id=uuid.uuid4(),
                entity_type="enquiry",
                entity_id=enquiry_id,
                action="ai_processed",
                performed_by="system",
                details={
                    "flow_type": final_state.get("flow_type"),
                    "current_step": current_step,
                    "has_quotation": final_state.get("quotation_data") is not None,
                    "awaiting_human": final_state.get("awaiting_human", False),
                },
            )
            session.add(audit)
            await session.commit()

        if not final_state.get("awaiting_human"):
            result_dict = _build_result_dict(final_state)
            await emitter.emit(evt_result(result_dict))

    except TimeoutError:
        await emitter.emit(evt_agent_error(
            agent="system",
            message=f"Processing exceeded {settings.ENQUIRY_FLOW_TIMEOUT_SECONDS:.0f}s timeout",
        ))
    except Exception as e:
        logger.exception("Streaming processing failed for enquiry %s", enquiry_id)
        await emitter.emit(evt_agent_error(
            agent="system",
            message=f"Processing failed: {e}",
        ))
    finally:
        await emitter.done()


def _build_result_dict(state: dict) -> dict:
    """Build a clean response dict from final graph state."""
    current_step = state.get("current_step", "unknown")
    result = {
        "enquiry_id": str(state.get("enquiry_id", "")),
        "status": current_step,
        "flow_type": state.get("flow_type"),
        "message": STATUS_MAP.get(current_step, f"Step: {current_step}"),
        "quotation_id": state.get("quote_id"),
        "pdf_available": state.get("pdf_path") is not None,
        "pdf_path": state.get("pdf_path"),
        "clarification_questions": state.get("clarification_questions"),
        "ai_reasoning": state.get("ai_reasoning", []),
        "requires_human_review": state.get("requires_human_review", False),
    }
    if state.get("error"):
        result["status"] = "failed"
        result["message"] = state["error"]
    return result


# ── HITL service functions ──────────────────────────────────


async def get_enquiry_hitl_state(enquiry_id: str) -> dict:
    """Return the current HITL state for an enquiry from the checkpointer."""
    config = {"configurable": {"thread_id": enquiry_id}}
    try:
        snapshot = await enquiry_graph.aget_state(config)
        if snapshot and snapshot.values:
            v = snapshot.values
            return {
                "awaiting_human": v.get("awaiting_human", False),
                "hitl_cycle": v.get("hitl_cycle", 0),
                "hitl_context": v.get("hitl_context"),
                "hitl_history": v.get("hitl_history", []),
                "flow_type": v.get("flow_type"),
                "current_step": v.get("current_step"),
                "next_nodes": list(snapshot.next or []),
            }
    except Exception:
        logger.exception("Failed to get HITL state for %s", enquiry_id)
    return {"awaiting_human": False, "hitl_cycle": 0, "hitl_context": None,
            "hitl_history": [], "flow_type": None, "current_step": None, "next_nodes": []}


async def submit_human_review(
    enquiry_id: str,
    decision: str,
    edited_email: str | None,
    human_prompt: str | None,
    emitter=None,
) -> dict:
    """Resume the paused graph with the human decision. Returns new state."""
    settings = get_settings()

    final_state = await asyncio.wait_for(
        resume_enquiry_flow(
            enquiry_id=enquiry_id,
            human_decision=decision,
            human_edited_email=edited_email,
            human_prompt=human_prompt,
            emitter=emitter,
        ),
        timeout=settings.ENQUIRY_FLOW_TIMEOUT_SECONDS,
    )

    async with async_session_factory() as session:
        audit = AuditLog(
            id=uuid.uuid4(),
            entity_type="enquiry",
            entity_id=enquiry_id,
            action=f"hitl_decision_{decision}",
            performed_by="marketing_user",
            details={
                "decision": decision,
                "human_prompt": human_prompt,
                "cycle": final_state.get("hitl_cycle"),
            },
        )
        session.add(audit)
        await session.commit()

    return _build_result_dict(final_state)


async def submit_client_verification(
    enquiry_id: str,
    decision: str,
    selected_client_id: str | None,
    emitter=None,
) -> dict:
    """Resume the graph at client_hitl_router with the human client decision."""
    settings = get_settings()

    try:
        final_state = await asyncio.wait_for(
            resume_client_verification_flow(
                enquiry_id=enquiry_id,
                decision=decision,
                selected_client_id=selected_client_id,
                emitter=emitter,
            ),
            timeout=settings.ENQUIRY_FLOW_TIMEOUT_SECONDS,
        )
    except ValueError:
        # In-memory checkpointer may be empty after process restart / multi-worker.
        # Fall back to applying the decision directly (including ERP export generation),
        # then continue the flow from the start with persisted fields.
        from services.client_service import create_client_record, get_client_by_id
        from services.erp_export_service import generate_enquiry_list_excel

        async with async_session_factory() as s:
            r = await s.execute(select(Enquiry).where(Enquiry.id == enquiry_id))
            row = r.scalar_one_or_none()
            if not row:
                raise

            parsed = row.parsed_data or {}
            extracted = {
                "company_name": parsed.get("client_company"),
                "contact_name": parsed.get("client_name"),
                "email": parsed.get("client_email"),
                "phone": parsed.get("client_phone"),
                "city": parsed.get("city") or parsed.get("location"),
                "country": parsed.get("country") or "India",
            }

            if decision == "confirmed_new":
                client = await create_client_record(extracted=extracted, source=row.input_type, db=s)
                row.client_id = client.id
                row.client_is_new = True
                row.client_verification_status = "confirmed_new"
                row.erp_export_path = await generate_enquiry_list_excel(
                    enquiry_id=str(row.id),
                    client=client,
                    parsed_data=parsed,
                    matched_products=[],
                    quotation_data=None,
                    input_type=row.input_type,
                    subject=None,
                )
            elif decision == "matched_existing":
                row.client_is_new = False
                row.client_verification_status = "matched_existing"
                if selected_client_id and not selected_client_id.startswith("dummy-"):
                    client = await get_client_by_id(selected_client_id, s)
                    if client and hasattr(client, "id"):
                        row.client_id = client.id
            else:
                row.client_verification_status = "skipped"

            await s.commit()

            final_state = await run_enquiry_flow(
                enquiry_id=enquiry_id,
                raw_input=row.raw_input,
                input_type=row.input_type,
                client_config=row.client_config,
                emitter=emitter,
            )

    erp_path = final_state.get("erp_export_path")
    extracted = final_state.get("extracted_client") or {}

    async with async_session_factory() as session:
        audit = AuditLog(
            id=uuid.uuid4(),
            entity_type="enquiry",
            entity_id=enquiry_id,
            action=f"client_verification_{decision}",
            performed_by="marketing_user",
            details={
                "decision": decision,
                "selected_client_id": selected_client_id,
                "erp_export_path": erp_path,
            },
        )
        session.add(audit)
        await session.commit()

    return {
        "enquiry_id": str(enquiry_id),
        "decision": decision,
        "client_id": final_state.get("resolved_client_id"),
        "company_name": extracted.get("company_name"),
        "erp_export_available": erp_path is not None,
        "erp_export_path": erp_path,
        "message": (
            "Client confirmed & ERP export created"
            if erp_path
            else "Client verified, proceeding to quotation"
        ),
    }


async def submit_client_verification_streaming(
    enquiry_id: str,
    decision: str,
    selected_client_id: str | None,
    emitter,
) -> None:
    """Streaming version of client verification — resumes graph and emits events."""
    from services.sse_service import evt_agent_error, evt_result

    settings = get_settings()
    try:
        try:
            final_state = await asyncio.wait_for(
                resume_client_verification_flow(
                    enquiry_id=enquiry_id,
                    decision=decision,
                    selected_client_id=selected_client_id,
                    emitter=emitter,
                ),
                timeout=settings.ENQUIRY_FLOW_TIMEOUT_SECONDS,
            )
        except ValueError:
            from services.client_service import create_client_record, get_client_by_id
            from services.erp_export_service import generate_enquiry_list_excel

            async with async_session_factory() as s:
                r = await s.execute(select(Enquiry).where(Enquiry.id == enquiry_id))
                row = r.scalar_one_or_none()
                if not row:
                    raise

                parsed = row.parsed_data or {}
                extracted = {
                    "company_name": parsed.get("client_company"),
                    "contact_name": parsed.get("client_name"),
                    "email": parsed.get("client_email"),
                    "phone": parsed.get("client_phone"),
                    "city": parsed.get("city") or parsed.get("location"),
                    "country": parsed.get("country") or "India",
                }

                if decision == "confirmed_new":
                    client = await create_client_record(extracted=extracted, source=row.input_type, db=s)
                    row.client_id = client.id
                    row.client_is_new = True
                    row.client_verification_status = "confirmed_new"
                    row.erp_export_path = await generate_enquiry_list_excel(
                        enquiry_id=str(row.id),
                        client=client,
                        parsed_data=parsed,
                        matched_products=[],
                        quotation_data=None,
                        input_type=row.input_type,
                        subject=None,
                    )
                elif decision == "matched_existing":
                    row.client_is_new = False
                    row.client_verification_status = "matched_existing"
                    if selected_client_id and not selected_client_id.startswith("dummy-"):
                        client = await get_client_by_id(selected_client_id, s)
                        if client and hasattr(client, "id"):
                            row.client_id = client.id
                else:
                    row.client_verification_status = "skipped"

                await s.commit()

                final_state = await run_enquiry_flow(
                    enquiry_id=enquiry_id,
                    raw_input=row.raw_input,
                    input_type=row.input_type,
                    client_config=row.client_config,
                    emitter=emitter,
                )

        erp_path = final_state.get("erp_export_path")
        extracted = final_state.get("extracted_client") or {}
        await emitter.emit({
            "type": "client_verification_result",
            "status": "done",
            "data": {
                "enquiry_id": str(enquiry_id),
                "decision": decision,
                "client_id": final_state.get("resolved_client_id"),
                "company_name": extracted.get("company_name"),
                "erp_export_available": erp_path is not None,
                "erp_export_path": erp_path,
                "message": (
                    "Client confirmed & ERP export created"
                    if erp_path
                    else "Client verified, proceeding to quotation"
                ),
            },
        })

        if not final_state.get("awaiting_human"):
            await emitter.emit(evt_result(_build_result_dict(final_state)))

    except TimeoutError:
        await emitter.emit(evt_agent_error(
            agent="system",
            message=f"Processing exceeded {settings.ENQUIRY_FLOW_TIMEOUT_SECONDS:.0f}s timeout",
        ))
    except Exception as e:
        logger.exception("Client verification streaming failed for %s", enquiry_id)
        await emitter.emit(evt_agent_error(agent="system", message=f"Processing failed: {e}"))
    finally:
        await emitter.done()


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


async def submit_human_review_streaming(
    enquiry_id: str,
    decision: str,
    edited_email: str | None,
    human_prompt: str | None,
    emitter,
) -> None:
    """Streaming version of submit_human_review — emits events, then done()."""
    from services.sse_service import evt_agent_error, evt_result

    settings = get_settings()
    try:
        final_state = await asyncio.wait_for(
            resume_enquiry_flow(
                enquiry_id=enquiry_id,
                human_decision=decision,
                human_edited_email=edited_email,
                human_prompt=human_prompt,
                emitter=emitter,
            ),
            timeout=settings.ENQUIRY_FLOW_TIMEOUT_SECONDS,
        )

        async with async_session_factory() as session:
            audit = AuditLog(
                id=uuid.uuid4(),
                entity_type="enquiry",
                entity_id=enquiry_id,
                action=f"hitl_decision_{decision}",
                performed_by="marketing_user",
                details={
                    "decision": decision,
                    "human_prompt": human_prompt,
                    "cycle": final_state.get("hitl_cycle"),
                },
            )
            session.add(audit)
            await session.commit()

        if not final_state.get("awaiting_human"):
            await emitter.emit(evt_result(_build_result_dict(final_state)))

    except TimeoutError:
        await emitter.emit(evt_agent_error(
            agent="system",
            message=f"Processing exceeded {settings.ENQUIRY_FLOW_TIMEOUT_SECONDS:.0f}s timeout",
        ))
    except Exception as e:
        logger.exception("HITL streaming failed for %s", enquiry_id)
        await emitter.emit(evt_agent_error(agent="system", message=f"Processing failed: {e}"))
    finally:
        await emitter.done()


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
) -> list[Enquiry]:
    """Return filtered list of enquiries."""
    stmt = (
        select(Enquiry)
        .options(selectinload(Enquiry.client))
        .order_by(Enquiry.created_at.desc())
    )
    if status:
        stmt = stmt.where(Enquiry.status == status)
    if flow_type:
        stmt = stmt.where(Enquiry.flow_type == flow_type)
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
        "has_quotation": bool(getattr(e, "client_id", None)) or bool((e.parsed_data or {}).get("quotation_id") if isinstance(e.parsed_data, dict) else False),
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
