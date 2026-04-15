"""Prepares HITL context before graph pauses at interrupt_after."""

import logging

from agents.state import EnquiryState, emit
from services.sse_service import evt_agent_start

logger = logging.getLogger(__name__)


async def human_review_node(state: EnquiryState) -> EnquiryState:
    """Runs BEFORE the graph pauses (interrupt_after). Prepares context for the UI."""
    cycle = state.get("hitl_cycle", 0) + 1
    flow_type = state.get("flow_type")
    enquiry_id = state.get("enquiry_id", "unknown")
    logger.info("Human review node — cycle %d for enquiry %s", cycle, enquiry_id)

    parsed_data = state.get("parsed_data") or {}
    quotation_data = state.get("quotation_data")

    if flow_type == "complete" and quotation_data:
        total = quotation_data.get("total_amount", 0)
        context = {
            "recommended_action": "approve_send",
            "summary": (
                f"Quotation {quotation_data.get('quote_number')} generated "
                f"for {parsed_data.get('client_name', 'client')}. "
                f"Total: ₹{total:,.2f}"
            ),
            "options_available": ["approve_send", "edit_email", "custom_prompt"],
            "draft_quotation": quotation_data,
            "draft_email": None,
        }
    elif flow_type == "incomplete":
        context = {
            "recommended_action": "edit_email",
            "summary": (
                f"Missing information: {', '.join(state.get('missing_fields', []))}. "
                "A follow-up email has been drafted."
            ),
            "options_available": ["approve_send", "edit_email", "custom_prompt"],
            "draft_email": state.get("clarification_questions"),
            "draft_quotation": None,
        }
    elif flow_type == "ambiguous":
        context = {
            "recommended_action": "custom_prompt",
            "summary": (
                "Product recommendation requires confirmation. "
                "AI selected a product based on application context."
            ),
            "options_available": ["approve_send", "edit_email", "custom_prompt"],
            "draft_quotation": quotation_data,
            "draft_email": None,
        }
    elif flow_type == "not_found":
        context = {
            "recommended_action": "custom_prompt",
            "summary": (
                "Product not found in catalog. You can instruct "
                "the AI to suggest alternatives or draft a custom response."
            ),
            "options_available": ["edit_email", "custom_prompt"],
            "draft_email": state.get("clarification_questions"),
            "draft_quotation": None,
        }
    else:
        context = {
            "recommended_action": "custom_prompt",
            "summary": "Review required before proceeding.",
            "options_available": ["approve_send", "edit_email", "custom_prompt"],
            "draft_email": None,
            "draft_quotation": None,
        }

    await emit(state, {
        "type": "hitl_required",
        "agent": "system",
        "message": f"Human review required — cycle {cycle}",
        "status": "waiting",
        "hitl_context": context,
        "cycle": cycle,
    })

    return {
        **state,
        "hitl_cycle": cycle,
        "hitl_context": context,
        "awaiting_human": True,
        "human_decision": None,
        "human_edited_email": None,
        "human_prompt": None,
        "current_step": "pending_human_review",
    }
