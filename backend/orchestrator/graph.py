"""LangGraph orchestration graph with HITL (Human-in-the-Loop) approval loop.

Every agent flow terminates at human_review, which runs fully (context + SSE),
then the graph checkpoints and pauses via interrupt_before hitl_router_agent.
The human submits a decision via the /review API; state is updated and the graph
resumes at hitl_router_agent with human_decision present, then re-routes.
The loop continues until the human chooses "approve_send" → send_node → END.
"""

import json
import logging
from uuid import UUID

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from sqlalchemy import select

from agents.email_composer_agent import email_composer_agent
from agents.client_hitl_node import client_hitl_node
from agents.client_hitl_router import client_hitl_router
from agents.client_identification_agent import client_identification_agent
from agents.hitl_router_agent import hitl_router_agent
from agents.human_review_node import human_review_node
from agents.matcher_agent import matcher_agent
from agents.product_hitl_node import product_hitl_node
from agents.product_hitl_router import product_hitl_router
from agents.parser_agent import parser_agent
from agents.quote_agent import quote_agent
from agents.send_node import send_node
from agents.state import EnquiryState
from core.config import get_settings
from core.database import async_session_factory
from core.litellm_client import llm_client
from db.models import Enquiry
from orchestrator.router import (
    route_after_client_hitl_router,
    route_after_client_id,
    route_after_email_composer,
    route_after_hitl_router,
    route_after_matcher,
    route_after_product_hitl_router,
    route_after_parser,
    route_after_quote,
    route_after_send_node,
)
from services.sse_service import register_emitter, remove_emitter

logger = logging.getLogger(__name__)


async def missing_fields_handler(state: EnquiryState) -> EnquiryState:
    """Generate a clarification email for incomplete enquiries."""
    enquiry_id = state.get("enquiry_id", "unknown")
    logger.info("Missing fields handler for enquiry %s", enquiry_id)

    try:
        settings = get_settings()
        prompts = settings.get_client_module("prompts")

        missing = state.get("missing_fields", [])
        raw_input = state.get("raw_input", "")

        user_prompt = (
            f"Original enquiry:\n{raw_input}\n\n"
            f"Missing information needed:\n{json.dumps(missing)}\n\n"
            "Write the follow-up email."
        )

        response = await llm_client.complete(
            system_prompt=prompts.MISSING_FIELDS_PROMPT,
            user_prompt=user_prompt,
        )

        async with async_session_factory() as session:
            result = await session.execute(
                select(Enquiry).where(Enquiry.id == enquiry_id)
            )
            enquiry = result.scalar_one_or_none()
            if enquiry:
                enquiry.status = "awaiting_info"
                await session.commit()

        reasoning = list(state.get("ai_reasoning", []))
        reasoning.append(f"MissingFields: generated clarification for {missing}")

        return {
            **state,
            "clarification_questions": response,
            "current_step": "awaiting_info",
            "ai_reasoning": reasoning,
        }
    except Exception as e:
        logger.error("Missing fields handler failed: %s", e)
        return {
            **state,
            "clarification_questions": f"Please provide: {', '.join(state.get('missing_fields', []))}",
            "current_step": "awaiting_info",
        }


def _error_handler(state: EnquiryState) -> EnquiryState:
    logger.error("Error handler reached: %s", state.get("error"))
    return {**state, "current_step": "failed"}


# ── Graph construction ──────────────────────────────────────


def build_graph():
    graph = StateGraph(EnquiryState)

    graph.add_node("parser_agent", parser_agent)
    graph.add_node("client_identification_agent", client_identification_agent)
    graph.add_node("client_hitl_node", client_hitl_node)
    graph.add_node("client_hitl_router", client_hitl_router)
    graph.add_node("product_hitl_node", product_hitl_node)
    graph.add_node("product_hitl_router", product_hitl_router)
    graph.add_node("matcher_agent", matcher_agent)
    graph.add_node("quote_agent", quote_agent)
    graph.add_node("missing_fields_handler", missing_fields_handler)
    graph.add_node("email_composer_agent", email_composer_agent)
    graph.add_node("human_review", human_review_node)
    graph.add_node("hitl_router_agent", hitl_router_agent)
    graph.add_node("send_node", send_node)
    graph.add_node("error_handler", _error_handler)

    graph.set_entry_point("parser_agent")

    graph.add_conditional_edges(
        "parser_agent",
        route_after_parser,
        {
            "client_identification_agent": "client_identification_agent",
            "error_handler": "error_handler",
        },
    )

    graph.add_conditional_edges(
        "client_identification_agent",
        route_after_client_id,
        {
            "client_hitl_node": "client_hitl_node",
            "error_handler": "error_handler",
        },
    )

    graph.add_edge("client_hitl_node", "client_hitl_router")

    graph.add_conditional_edges(
        "client_hitl_router",
        route_after_client_hitl_router,
        {
            "matcher_agent": "matcher_agent",
            "product_hitl_node": "product_hitl_node",
            "missing_fields_handler": "missing_fields_handler",
            "error_handler": "error_handler",
        },
    )

    graph.add_edge("missing_fields_handler", "email_composer_agent")

    graph.add_conditional_edges(
        "email_composer_agent",
        route_after_email_composer,
        {"human_review": "human_review"},
    )

    graph.add_conditional_edges(
        "matcher_agent",
        route_after_matcher,
        {
            "quote_agent": "quote_agent",
            "product_hitl_node": "product_hitl_node",
            "missing_fields_handler": "missing_fields_handler",
            "error_handler": "error_handler",
        },
    )

    # Product completion HITL: node emits event, then graph pauses before router
    graph.add_conditional_edges(
        "product_hitl_node",
        lambda state: "product_hitl_router",
        {"product_hitl_router": "product_hitl_router"},
    )

    graph.add_conditional_edges(
        "product_hitl_router",
        route_after_product_hitl_router,
        {
            "quote_agent": "quote_agent",
            "human_review": "human_review",
            "product_hitl_node": "product_hitl_node",
            "error_handler": "error_handler",
        },
    )

    graph.add_conditional_edges(
        "quote_agent",
        route_after_quote,
        {
            "human_review": "human_review",
            "error_handler": "error_handler",
        },
    )

    # human_review runs fully; checkpoint pauses before hitl_router_agent
    # so human_decision is injected before that node runs on resume.
    graph.add_conditional_edges(
        "human_review",
        lambda state: "hitl_router_agent",
        {"hitl_router_agent": "hitl_router_agent"},
    )

    graph.add_conditional_edges(
        "hitl_router_agent",
        route_after_hitl_router,
        {
            "send_node": "send_node",
            "email_composer_agent": "email_composer_agent",
            "quote_agent": "quote_agent",
            "matcher_agent": "matcher_agent",
            "human_review": "human_review",
        },
    )

    graph.add_conditional_edges(
        "send_node",
        route_after_send_node,
        {END: END},
    )

    graph.add_edge("error_handler", END)

    # MemorySaver keeps state in-process. For production, swap to PostgresSaver.
    memory = MemorySaver()

    return graph.compile(
        checkpointer=memory,
        interrupt_before=[
            "hitl_router_agent",   # main HITL router
            "client_hitl_router",  # client verification router
            "product_hitl_router",  # product completion router
        ],
    )


enquiry_graph = build_graph()


# ── Flow execution ──────────────────────────────────────────


async def run_enquiry_flow(
    enquiry_id: str,
    raw_input: str,
    input_type: str = "email",
    client_config: str = "parth_valves",
    emitter=None,
) -> EnquiryState:
    """Run the full enquiry pipeline. Returns when graph completes OR pauses at HITL.

    If the graph pauses (interrupt_before hitl_router_agent), the returned state has
    awaiting_human=True. The caller should NOT treat this as a final result.
    """
    eid = UUID(enquiry_id) if isinstance(enquiry_id, str) else enquiry_id

    async with async_session_factory() as session:
        existing = await session.execute(select(Enquiry).where(Enquiry.id == eid))
        enquiry_row = existing.scalar_one_or_none()
        if enquiry_row is None:
            session.add(
                Enquiry(
                    id=eid,
                    client_config=client_config,
                    raw_input=raw_input,
                    input_type=input_type,
                    status="received",
                )
            )
            await session.commit()
        else:
            # Keep the latest raw_input; important when user reprocesses.
            enquiry_row.raw_input = raw_input
            await session.commit()

    initial_state: EnquiryState = {
        "enquiry_id": enquiry_id,
        "raw_input": raw_input,
        "input_type": input_type,
        "client_config": client_config,
        "parsed_data": None,
        "flow_type": None,
        "missing_fields": [],
        "parse_confidence": 0.0,
        "matched_products": [],
        "match_confidence": 0.0,
        "products_not_found": [],
        "quotation_data": None,
        "quote_id": None,
        "pdf_path": None,
        "clarification_questions": None,
        "requires_human_review": False,
        "human_approved": False,
        "error": None,
        "current_step": "started",
        "ai_reasoning": [],
        "hitl_cycle": 0,
        "human_decision": None,
        "human_edited_email": None,
        "human_prompt": None,
        "hitl_history": [],
        "hitl_context": None,
        "awaiting_human": False,
        "hitl_action": None,
        "hitl_instructions": None,
    }

    # Seed state from persisted enquiry fields so we can continue after process restarts.
    if enquiry_row is not None:
        if enquiry_row.client_verification_status:
            initial_state["client_verification_status"] = enquiry_row.client_verification_status
        if enquiry_row.client_is_new is not None:
            initial_state["client_is_new"] = enquiry_row.client_is_new
        if enquiry_row.erp_export_path:
            initial_state["erp_export_path"] = enquiry_row.erp_export_path
        if enquiry_row.client_id is not None:
            initial_state["resolved_client_id"] = str(enquiry_row.client_id)

    if emitter is not None:
        register_emitter(str(enquiry_id), emitter)
    try:
        config = {"configurable": {"thread_id": enquiry_id}}
        final_state = await enquiry_graph.ainvoke(initial_state, config=config)
    finally:
        if emitter is not None:
            remove_emitter(str(enquiry_id))

    await _save_state_to_db(eid, final_state)
    return final_state


async def resume_enquiry_flow(
    enquiry_id: str,
    human_decision: str,
    human_edited_email: str | None = None,
    human_prompt: str | None = None,
    emitter=None,
) -> EnquiryState:
    """Resume a graph paused at human_review. Injects the human's decision
    and continues until the graph completes or pauses again."""
    config = {"configurable": {"thread_id": enquiry_id}}

    if emitter is not None:
        register_emitter(str(enquiry_id), emitter)

    current = await enquiry_graph.aget_state(config)
    if current is None or not current.next:
        if emitter is not None:
            remove_emitter(str(enquiry_id))
        raise ValueError(
            f"No paused graph found for enquiry {enquiry_id}. "
            "Was the enquiry processed?"
        )

    await enquiry_graph.aupdate_state(
        config,
        {
            "human_decision": human_decision,
            "human_edited_email": human_edited_email,
            "human_prompt": human_prompt,
            "awaiting_human": False,
        },
    )

    try:
        final_state = await enquiry_graph.ainvoke(None, config)
    finally:
        if emitter is not None:
            remove_emitter(str(enquiry_id))

    eid = UUID(enquiry_id) if isinstance(enquiry_id, str) else enquiry_id
    await _save_state_to_db(eid, final_state)
    return final_state


async def resume_client_verification_flow(
    enquiry_id: str,
    decision: str,
    selected_client_id: str | None,
    emitter=None,
) -> EnquiryState:
    """Resume a graph paused at client verification (before client_hitl_router)."""
    config = {"configurable": {"thread_id": enquiry_id}}

    if emitter is not None:
        register_emitter(str(enquiry_id), emitter)

    current = await enquiry_graph.aget_state(config)
    if current is None or not current.next:
        if emitter is not None:
            remove_emitter(str(enquiry_id))
        raise ValueError(
            f"No paused graph found for enquiry {enquiry_id}. Was the enquiry processed?"
        )

    await enquiry_graph.aupdate_state(
        config,
        {
            "client_hitl_decision": decision,
            "human_selected_client_id": selected_client_id,
            "awaiting_human": False,
        },
    )

    try:
        final_state = await enquiry_graph.ainvoke(None, config)
    finally:
        if emitter is not None:
            remove_emitter(str(enquiry_id))

    eid = UUID(enquiry_id) if isinstance(enquiry_id, str) else enquiry_id
    await _save_state_to_db(eid, final_state)
    return final_state


async def resume_product_completion_flow(
    enquiry_id: str,
    decision: str,
    payload: dict,
    state_patch: dict | None = None,
    emitter=None,
) -> EnquiryState:
    """Resume a graph paused at product completion (before product_hitl_router)."""
    config = {"configurable": {"thread_id": enquiry_id}}

    if emitter is not None:
        register_emitter(str(enquiry_id), emitter)

    current = await enquiry_graph.aget_state(config)
    if current is None or not current.next:
        if emitter is not None:
            remove_emitter(str(enquiry_id))
        raise ValueError(
            f"No paused graph found for enquiry {enquiry_id}. Was the enquiry processed?"
        )

    patch = {
        "product_hitl_decision": decision,
        "product_hitl_payload": payload,
        "awaiting_human": False,
    }
    if state_patch and isinstance(state_patch, dict):
        patch.update(state_patch)

    await enquiry_graph.aupdate_state(config, patch)

    try:
        final_state = await enquiry_graph.ainvoke(None, config)
    finally:
        if emitter is not None:
            remove_emitter(str(enquiry_id))

    eid = UUID(enquiry_id) if isinstance(enquiry_id, str) else enquiry_id
    await _save_state_to_db(eid, final_state)
    return final_state


async def _save_state_to_db(eid: UUID, state: EnquiryState) -> None:
    """Persist the current graph state snapshot to the Enquiry row."""
    async with async_session_factory() as session:
        result = await session.execute(select(Enquiry).where(Enquiry.id == eid))
        enquiry = result.scalar_one_or_none()
        if enquiry:
            enquiry.agent_state = dict(state)
            enquiry.ai_reasoning = "\n".join(state.get("ai_reasoning", []))

            # Client fields (may be resolved before quoting)
            resolved_client_id = state.get("resolved_client_id")
            if resolved_client_id and not str(resolved_client_id).startswith("dummy-"):
                try:
                    enquiry.client_id = UUID(str(resolved_client_id))
                except Exception:
                    pass
            enquiry.client_is_new = state.get("client_is_new")
            if state.get("client_verification_status"):
                enquiry.client_verification_status = state.get("client_verification_status")
            if state.get("erp_export_path"):
                enquiry.erp_export_path = state.get("erp_export_path")

            if state.get("awaiting_human"):
                # Distinguish client verification pause vs main HITL review for UI/debuggability
                ctx = state.get("hitl_context") or {}
                if ctx.get("type") == "client_verification":
                    enquiry.status = "pending_client_verification"
                else:
                    enquiry.status = "pending_human_review"
            elif state.get("error"):
                enquiry.error_message = state["error"]
                enquiry.status = "failed"
            elif state.get("current_step") == "approved_sent":
                enquiry.status = "approved"
            await session.commit()
