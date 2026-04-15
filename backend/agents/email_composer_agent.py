"""Composes the outbound email to the client (clarification or confirmation)."""

import logging

from agents.state import EnquiryState, emit
from core.litellm_client import llm_client
from services.sse_service import evt_agent_start, evt_agent_complete

logger = logging.getLogger(__name__)


async def email_composer_agent(state: EnquiryState) -> EnquiryState:
    await emit(state, evt_agent_start(
        agent="email_composer",
        message="Composing email to client",
        detail="Preparing follow-up questions or response",
    ))

    instructions = state.get("hitl_instructions", "")
    existing_draft = state.get("clarification_questions", "")
    human_edit = state.get("human_edited_email")
    parsed_data = state.get("parsed_data") or {}

    if human_edit:
        final_email = human_edit
    else:
        from core.config import get_settings
        settings = get_settings()
        prompts_mod = settings.get_client_module("prompts")

        final_email = await llm_client.complete(
            system_prompt=prompts_mod.EMAIL_COMPOSER_SYSTEM_PROMPT,
            user_prompt=(
                f"Draft email to client:\n{existing_draft}\n\n"
                f"Additional instructions from team:\n{instructions}\n\n"
                f"Client name: {parsed_data.get('client_name', 'Sir/Madam')}\n"
                f"Missing fields: {state.get('missing_fields', [])}\n\n"
                "Rewrite or refine the email based on the instructions. "
                "Keep it professional and under 150 words. "
                "Sign off as: Marketing Team, Parth Valves and Hoses LLP"
            ),
        )

    await emit(state, evt_agent_complete(
        agent="email_composer",
        message="Email draft ready for review",
        data={"preview": final_email[:100] + "..." if len(final_email) > 100 else final_email},
    ))

    reasoning = list(state.get("ai_reasoning", []))
    reasoning.append(f"EmailComposer: email {'edited by human' if human_edit else 'composed by AI'}")

    return {
        **state,
        "clarification_questions": final_email,
        "current_step": "email_composed",
        "ai_reasoning": reasoning,
    }
