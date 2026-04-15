"""HITL pause node: client verification before quoting."""

from agents.state import EnquiryState, emit
from services.client_service import get_dummy_clients


async def client_hitl_node(state: EnquiryState) -> EnquiryState:
    client_is_new = state.get("client_is_new", True)
    extracted = state.get("extracted_client") or {}

    if client_is_new:
        summary = (
            "We identified this as a NEW client: "
            f"{extracted.get('company_name', 'Unknown')}. Confirm to add them to the system."
        )
        recommended = "confirm_new"
    else:
        matched = state.get("matched_client_data") or {}
        summary = (
            "We matched this to existing client: "
            f"{matched.get('company_name')}. Is this correct?"
        )
        recommended = "confirm_existing"

    context = {
        "type": "client_verification",
        "summary": summary,
        "recommended_action": recommended,
        "extracted_client": extracted,
        "matched_client": state.get("matched_client_data"),
        "client_is_new": client_is_new,
        "available_clients": get_dummy_clients(),
        # TODO: Replace get_dummy_clients() with real ERP client search results.
    }

    await emit(
        state,
        {
            "type": "client_hitl_required",
            "agent": "system",
            "message": "Client verification needed",
            "status": "waiting",
            "client_context": context,
        },
    )

    return {
        **state,
        "hitl_context": context,
        "awaiting_human": True,
        "client_hitl_decision": None,
        "current_step": "client_verification",
    }

