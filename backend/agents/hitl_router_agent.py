"""Interprets the human's HITL decision and prepares state for re-routing."""

import json
import logging
from datetime import datetime, timezone

from agents.state import EnquiryState, emit
from core.litellm_client import llm_client, strip_llm_json_payload
from services.sse_service import evt_agent_start, evt_agent_complete, evt_agent_error

logger = logging.getLogger(__name__)


async def hitl_router_agent(state: EnquiryState) -> EnquiryState:
    decision = state.get("human_decision")
    prompt = state.get("human_prompt", "")
    cycle = state.get("hitl_cycle", 1)

    await emit(state, evt_agent_start(
        agent="hitl_router",
        message=f"Processing your instruction (cycle {cycle})",
        detail=f"Decision: {decision}",
    ))

    history_entry: dict = {
        "cycle": cycle,
        "decision": decision,
        "prompt": prompt,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if decision == "approve_send":
        await emit(state, evt_agent_complete(
            agent="hitl_router",
            message="Approval confirmed — preparing to send",
        ))
        return {
            **state,
            "awaiting_human": False,
            "hitl_history": [*state.get("hitl_history", []), history_entry],
        }

    if decision == "edit_email":
        await emit(state, evt_agent_complete(
            agent="hitl_router",
            message="Using your edited email draft",
        ))
        return {
            **state,
            "awaiting_human": False,
            "clarification_questions": state.get("human_edited_email"),
            "hitl_history": [*state.get("hitl_history", []), history_entry],
        }

    if decision == "custom_prompt":
        await emit(state, evt_agent_start(
            agent="hitl_router",
            message="AI is interpreting your instruction",
            detail=f'"{prompt[:80]}..."' if len(prompt) > 80 else f'"{prompt}"',
        ))

        try:
            from core.config import get_settings
            settings = get_settings()
            prompts_mod = settings.get_client_module("prompts")

            interpretation_raw = await llm_client.complete(
                system_prompt=prompts_mod.HITL_ROUTER_SYSTEM_PROMPT,
                user_prompt=(
                    f"Current flow state:\n"
                    f"- flow_type: {state.get('flow_type')}\n"
                    f"- missing_fields: {state.get('missing_fields')}\n"
                    f"- matched_products: {len(state.get('matched_products') or [])} products matched\n"
                    f"- has_quotation: {state.get('quotation_data') is not None}\n"
                    f"- cycle: {cycle}\n\n"
                    f'Human instruction:\n"{prompt}"\n\n'
                    "Determine: new_flow_type, action, updated_instructions, reasoning.\n"
                    "Return ONLY valid JSON."
                ),
                response_format="json",
            )

            parsed = json.loads(strip_llm_json_payload(interpretation_raw))
            new_flow_type = parsed.get("new_flow_type", state.get("flow_type"))
            action = parsed.get("action", "regenerate_email")

            await emit(state, evt_agent_complete(
                agent="hitl_router",
                message=f"Understood — {parsed.get('reasoning', '')}",
                data={"new_flow_type": new_flow_type, "action": action},
            ))

            history_entry["ai_interpretation"] = parsed

            updates: dict = {
                **state,
                "awaiting_human": False,
                "flow_type": new_flow_type,
                "hitl_action": action,
                "hitl_instructions": parsed.get("updated_instructions", ""),
                "hitl_history": [*state.get("hitl_history", []), history_entry],
            }

            if action == "regenerate_quote":
                updates["quotation_data"] = None
                updates["quote_id"] = None
                updates["pdf_path"] = None
            elif action == "run_matcher_with_suggestions":
                updates["matched_products"] = []
                updates["quotation_data"] = None
                updates["quote_id"] = None
                updates["pdf_path"] = None

            return updates

        except Exception as e:
            logger.exception("HITL router AI interpretation failed")
            await emit(state, evt_agent_error(agent="hitl_router", message=f"Interpretation failed: {e}"))
            return {
                **state,
                "awaiting_human": False,
                "hitl_history": [*state.get("hitl_history", []), history_entry],
            }

    return state
