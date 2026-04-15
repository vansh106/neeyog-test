"""Router for client verification decisions (runs after interrupt resume)."""

import logging

from agents.state import EnquiryState, emit
from core.database import async_session_factory
from services.client_service import create_client_record, get_client_by_id, increment_enquiry_count
from services.erp_export_service import generate_enquiry_list_excel
from services.sse_service import evt_agent_complete, evt_agent_start

logger = logging.getLogger(__name__)


async def client_hitl_router(state: EnquiryState) -> EnquiryState:
    decision = state.get("client_hitl_decision")
    await emit(
        state,
        evt_agent_start(
            agent="client_id",
            message=f"Processing client decision: {decision}",
        ),
    )

    resolved_client = None
    erp_export_path = None

    parsed = state.get("parsed_data") or {}
    subject = parsed.get("subject") or parsed.get("email_subject") or None

    async with async_session_factory() as db:
        if decision == "confirmed_new":
            extracted = state.get("extracted_client") or {}
            client = await create_client_record(
                extracted=extracted,
                source=state.get("input_type") or "email",
                db=db,
            )
            resolved_client = client

            await emit(
                state,
                evt_agent_start(
                    agent="client_id",
                    message="Generating ERP Enquiry List",
                    detail="Creating Excel export template",
                ),
            )

            erp_export_path = await generate_enquiry_list_excel(
                enquiry_id=state.get("enquiry_id", ""),
                client=client,
                parsed_data=parsed,
                matched_products=state.get("matched_products") or [],
                quotation_data=state.get("quotation_data"),
                input_type=state.get("input_type") or "email",
                subject=subject,
            )

            await emit(
                state,
                evt_agent_complete(
                    agent="client_id",
                    message="New client created & ERP export ready",
                    data={
                        "client_id": str(client.id),
                        "company_name": client.company_name,
                        "erp_export": erp_export_path,
                    },
                ),
            )

        elif decision == "matched_existing":
            selected_id = state.get("human_selected_client_id")
            if selected_id:
                client = await get_client_by_id(selected_id, db)
                resolved_client = client
                if client is not None:
                    await increment_enquiry_count(selected_id, db)
                await emit(
                    state,
                    evt_agent_complete(
                        agent="client_id",
                        message=f"Matched to: {getattr(client, 'company_name', selected_id)}",
                        data={
                            "client_id": getattr(client, "id", selected_id),
                            "erp_code": getattr(client, "erp_code", None),
                        },
                    ),
                )

        elif decision == "skip":
            await emit(state, evt_agent_complete(agent="client_id", message="Client verification skipped"))

    resolved_id = None
    if resolved_client is not None:
        resolved_id = str(getattr(resolved_client, "id", None) or "")
        if not resolved_id:
            resolved_id = None

    verification_status = (
        "confirmed_new"
        if decision == "confirmed_new"
        else "matched_existing"
        if decision == "matched_existing"
        else "skipped"
    )

    return {
        **state,
        "resolved_client_id": resolved_id,
        "erp_export_path": erp_export_path,
        "awaiting_human": False,
        "client_verification_status": verification_status,
        "current_step": "client_verified",
    }

