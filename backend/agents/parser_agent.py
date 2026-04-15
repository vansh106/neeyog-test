"""Agent responsible for parsing raw enquiry text into structured data."""

import json
import logging

from sqlalchemy import select

from agents.state import EnquiryState, emit
from services.sse_service import evt_agent_start, evt_agent_complete, evt_agent_warning, evt_agent_error
from core.config import get_settings
from core.database import async_session_factory
from core.litellm_client import llm_client, strip_llm_json_payload
from db.models import Enquiry

logger = logging.getLogger(__name__)


async def parser_agent(state: EnquiryState) -> EnquiryState:
    enquiry_id = state.get("enquiry_id", "unknown")
    logger.info("Parser agent starting for enquiry %s", enquiry_id)

    try:
        client_config = state.get("client_config", "parth_valves")
        settings = get_settings()
        prompts = settings.get_client_module("prompts")
        flows = settings.get_client_module("flows")

        raw_input = state.get("raw_input", "")

        await emit(state, evt_agent_start(
            agent="parser",
            message="Reading your enquiry email",
            detail="Extracting client info, products, and specs",
        ))

        await emit(state, evt_agent_start(
            agent="parser",
            message="AI is analysing the email content",
            detail="Identifying product requests and missing fields",
        ))

        response_text = await llm_client.complete(
            system_prompt=prompts.PARSER_SYSTEM_PROMPT,
            user_prompt=f"Parse this customer enquiry:\n\n{raw_input}",
            response_format="json",
        )

        parsed = json.loads(strip_llm_json_payload(response_text))

        enquiry_type = parsed.get("enquiry_type", "incomplete")
        confidence = float(parsed.get("confidence", 0.0))
        missing = parsed.get("missing_fields") or []
        products_requested = parsed.get("products_requested") or []

        if not products_requested:
            flow_type = "not_found"
        elif enquiry_type == "complete" and confidence >= flows.CONFIDENCE_THRESHOLD:
            flow_type = "complete"
        elif enquiry_type == "incomplete":
            flow_type = "incomplete"
        elif enquiry_type == "ambiguous":
            flow_type = "ambiguous"
        else:
            flow_type = "incomplete"

        await emit(state, evt_agent_complete(
            agent="parser",
            message=f"Email parsed — {flow_type} enquiry detected",
            data={
                "flow_type": flow_type,
                "confidence": round(confidence, 2),
                "products_found": len(products_requested),
                "missing_fields": missing,
                "client_name": parsed.get("client_name"),
            },
        ))

        if flow_type == "incomplete":
            await emit(state, evt_agent_warning(
                agent="parser",
                message="Some information is missing",
                detail=f"Missing: {', '.join(missing) if missing else 'unspecified'}",
            ))

        reasoning = list(state.get("ai_reasoning", []))
        reasoning.append(
            f"Parser: flow_type={flow_type}, confidence={confidence:.2f}, "
            f"products={len(products_requested)}, missing={missing}"
        )

        async with async_session_factory() as session:
            result = await session.execute(
                select(Enquiry).where(Enquiry.id == enquiry_id)
            )
            enquiry = result.scalar_one_or_none()
            if enquiry:
                enquiry.parsed_data = parsed
                enquiry.flow_type = flow_type
                enquiry.confidence_score = confidence
                enquiry.missing_fields = missing
                enquiry.status = "matching" if flow_type in ("complete", "ambiguous") else "parsing"
                await session.commit()

        return {
            **state,
            "parsed_data": parsed,
            "flow_type": flow_type,
            "missing_fields": missing,
            "parse_confidence": confidence,
            "current_step": "parsed",
            "ai_reasoning": reasoning,
        }

    except json.JSONDecodeError as e:
        logger.error("Parser: failed to parse LLM JSON: %s", e)
        await emit(state, evt_agent_error(agent="parser", message=f"Failed to parse email: {e}"))
        return {
            **state,
            "error": f"Parser JSON decode error: {e}",
            "current_step": "parser_failed",
        }
    except Exception as e:
        logger.error("Parser agent failed: %s", e)
        await emit(state, evt_agent_error(agent="parser", message=f"Failed to parse email: {e}"))
        return {
            **state,
            "error": f"Parser error: {e}",
            "current_step": "parser_failed",
        }
