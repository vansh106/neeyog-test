"""Conditional routing logic within the agent graph."""

from langgraph.graph import END

from agents.state import EnquiryState


def route_after_parser(state: EnquiryState) -> str:
    if state.get("error"):
        return "error_handler"
    # If client verification already happened (e.g. enquiry resumed after restart),
    # skip client HITL and continue the main flow.
    if state.get("client_verification_status") in ("confirmed_new", "matched_existing", "skipped"):
        return route_after_client_hitl_router(state)
    return "client_identification_agent"


def route_after_client_id(state: EnquiryState) -> str:
    if state.get("error"):
        return "error_handler"
    return "client_hitl_node"


def route_after_client_hitl_router(state: EnquiryState) -> str:
    """After client verification, route based on flow_type."""
    if state.get("error"):
        return "error_handler"
    flow_type = state.get("flow_type")
    if flow_type in ("complete", "ambiguous"):
        return "matcher_agent"
    if flow_type in ("incomplete", "not_found"):
        return "missing_fields_handler"
    return "missing_fields_handler"


def route_after_matcher(state: EnquiryState) -> str:
    if state.get("error"):
        return "error_handler"
    if not state.get("matched_products"):
        return "missing_fields_handler"
    if state.get("flow_type") == "not_found":
        return "missing_fields_handler"
    return "quote_agent"


def route_after_quote(state: EnquiryState) -> str:
    """Always route to human_review — never END directly."""
    if state.get("error"):
        return "error_handler"
    return "human_review"


def route_after_email_composer(state: EnquiryState) -> str:
    return "human_review"


def route_after_hitl_router(state: EnquiryState) -> str:
    """Routes based on human decision + AI interpretation."""
    decision = state.get("human_decision")
    action = state.get("hitl_action")

    if decision == "approve_send":
        return "send_node"

    if decision == "edit_email":
        return "email_composer_agent"

    if decision == "custom_prompt":
        if action == "regenerate_quote":
            return "quote_agent"
        if action == "regenerate_email":
            return "email_composer_agent"
        if action == "run_matcher_with_suggestions":
            return "matcher_agent"
        if action == "approve_send":
            return "send_node"
        return "email_composer_agent"

    return "human_review"


def route_after_send_node(state: EnquiryState) -> str:
    return END
