"""Shared state definition for the LangGraph enquiry pipeline."""

from typing import TypedDict


class EnquiryState(TypedDict, total=False):
    enquiry_id: str
    raw_input: str
    input_type: str
    client_config: str

    # Set by Parser Agent
    parsed_data: dict | None
    flow_type: str | None
    missing_fields: list[str]
    parse_confidence: float

    # Set by Matcher Agent
    matched_products: list[dict]
    match_confidence: float
    products_not_found: list[str]

    # Set by Quote Agent
    quotation_data: dict | None
    quote_id: str | None
    pdf_path: str | None

    # Set by Missing Fields Handler
    clarification_questions: str | None

    # System fields
    requires_human_review: bool
    human_approved: bool
    error: str | None
    current_step: str
    ai_reasoning: list[str]

    # Human-in-the-loop fields
    hitl_cycle: int
    human_decision: str | None
    human_edited_email: str | None
    human_prompt: str | None
    hitl_history: list[dict]
    hitl_context: dict | None
    awaiting_human: bool
    hitl_action: str | None
    hitl_instructions: str | None

    # ── Client identification fields ──────────────
    extracted_client: dict | None
    client_is_new: bool | None
    matched_client_id: str | None
    matched_client_data: dict | None
    client_hitl_decision: str | None
    human_selected_client_id: str | None
    resolved_client_id: str | None
    erp_export_path: str | None

    # ── Product completion HITL (DB cascade) ───────
    product_hitl_context: dict | None
    product_hitl_decision: str | None  # "fill_self" | "ask_client"
    product_hitl_payload: dict | None  # selections/questions chosen by human


async def emit(state: EnquiryState, event: dict) -> None:
    """
    Safe emit via registry lookup.
    Never fails — if no emitter found, silently skips.
    """
    from services.sse_service import get_emitter

    enquiry_id = state.get("enquiry_id")
    if not enquiry_id:
        return
    emitter = get_emitter(str(enquiry_id))
    if emitter is not None:
        await emitter.emit(event)

    # Also broadcast to the global bus (emails tab / global inbox).
    try:
        from services.global_event_bus import broadcast_agent_event

        await broadcast_agent_event(str(enquiry_id), event)
    except Exception:
        # Never break the pipeline if the bus fails.
        pass
