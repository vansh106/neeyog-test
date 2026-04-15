"""Agent responsible for matching parsed items to products in the catalog."""

import json
import logging

from sqlalchemy import select

from agents.state import EnquiryState, emit
from services.sse_service import evt_agent_start, evt_agent_complete, evt_agent_warning, evt_agent_error
from core.config import get_settings
from core.database import async_session_factory
from core.litellm_client import llm_client, strip_llm_json_payload
from db.models import Enquiry
from masters.product_master import (
    format_products_for_agent,
    get_all_products,
    search_products_by_size,
    search_products_keyword,
)

logger = logging.getLogger(__name__)


async def matcher_agent(state: EnquiryState) -> EnquiryState:
    enquiry_id = state.get("enquiry_id", "unknown")
    logger.info("Matcher agent starting for enquiry %s", enquiry_id)

    flow_type = state.get("flow_type")
    if flow_type not in ("complete", "ambiguous"):
        logger.info("Matcher skipped — flow_type=%s", flow_type)
        return state

    try:
        settings = get_settings()
        prompts = settings.get_client_module("prompts")
        flows = settings.get_client_module("flows")

        parsed_data = state.get("parsed_data") or {}
        products_requested = parsed_data.get("products_requested") or []
        client_config = state.get("client_config", "parth_valves")

        await emit(state, evt_agent_start(
            agent="matcher",
            message="Searching product catalog",
            detail=f"Looking up {len(products_requested)} requested item(s)",
        ))

        all_candidate_products = []
        for req in products_requested:
            await emit(state, evt_agent_start(
                agent="matcher",
                message=f"Matching: {req.get('product_description', 'item')}",
                detail=f"Size: {req.get('size_inch') or req.get('size_mm') or 'not specified'}",
            ))

            size_mm = req.get("size_mm")
            size_inch = req.get("size_inch")

            if size_mm or size_inch:
                size_inch_f = float(size_inch) if size_inch else None
                size_mm_f = float(size_mm) if size_mm else None
                results = await search_products_by_size(
                    client_id=client_config,
                    category=None,
                    size_mm=size_mm_f,
                    size_inch=size_inch_f,
                )
                all_candidate_products.extend(results)

            if not all_candidate_products:
                desc = req.get("product_description", "butterfly valve")
                results = await search_products_keyword(
                    client_id=client_config,
                    search_text=desc,
                )
                all_candidate_products.extend(results)

        if not all_candidate_products:
            all_candidate_products = await get_all_products(
                client_id=client_config,
                category=None,
            )

        seen_ids = set()
        unique_products = []
        for p in all_candidate_products:
            pid = p.get("id")
            if pid and pid not in seen_ids:
                seen_ids.add(pid)
                unique_products.append(p)

        formatted = format_products_for_agent(unique_products)

        user_prompt = (
            f"Customer requested:\n{json.dumps(products_requested, indent=2)}\n\n"
            f"Available products in our database:\n{formatted}\n\n"
            "Match each requested product to the best available database product. "
            "Return JSON with a 'matches' array."
        )

        response_text = await llm_client.complete(
            system_prompt=prompts.MATCHER_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_format="json",
        )

        match_result = json.loads(strip_llm_json_payload(response_text))

        matches = match_result if isinstance(match_result, list) else match_result.get("matches", [])

        matched = [m for m in matches if m.get("matched")]
        not_found = [m for m in matches if not m.get("matched")]

        confidences = [float(m.get("match_confidence", 0)) for m in matched]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        not_found_names = [
            m.get("product_name") or m.get("product_description", "unknown")
            for m in not_found
        ]

        await emit(state, evt_agent_complete(
            agent="matcher",
            message=f"Catalog search complete — {len(matched)}/{len(matches)} products matched",
            data={
                "matched": len(matched),
                "not_found": len(not_found),
                "avg_confidence": round(avg_confidence, 2),
                "products_not_found": not_found_names,
            },
        ))

        if not_found_names:
            await emit(state, evt_agent_warning(
                agent="matcher",
                message=f"{len(not_found)} product(s) not in catalog",
                detail=f"Not found: {', '.join(not_found_names)}",
            ))

        updated_flow_type = flow_type
        requires_review = state.get("requires_human_review", False)

        if not_found and not matched:
            updated_flow_type = "not_found"
        if avg_confidence < flows.CONFIDENCE_THRESHOLD:
            requires_review = True
            await emit(state, evt_agent_warning(
                agent="matcher",
                message="Low confidence match — human review required",
                detail=f"Confidence {round(avg_confidence * 100)}% is below {int(flows.CONFIDENCE_THRESHOLD * 100)}% threshold",
            ))

        reasoning = list(state.get("ai_reasoning", []))
        reasoning.append(
            f"Matcher: {len(matched)} matched, {len(not_found)} not found, "
            f"avg_confidence={avg_confidence:.2f}"
        )

        async with async_session_factory() as session:
            result = await session.execute(
                select(Enquiry).where(Enquiry.id == enquiry_id)
            )
            enquiry = result.scalar_one_or_none()
            if enquiry:
                enquiry.matched_products = matches
                enquiry.confidence_score = avg_confidence
                enquiry.status = "quoting"
                await session.commit()

        return {
            **state,
            "matched_products": matches,
            "match_confidence": avg_confidence,
            "products_not_found": not_found_names,
            "flow_type": updated_flow_type,
            "requires_human_review": requires_review,
            "current_step": "matched",
            "ai_reasoning": reasoning,
        }

    except json.JSONDecodeError as e:
        logger.error("Matcher: failed to parse LLM JSON: %s", e)
        await emit(state, evt_agent_error(agent="matcher", message=f"Product matching failed: {e}"))
        return {
            **state,
            "error": f"Matcher JSON decode error: {e}",
            "current_step": "matcher_failed",
        }
    except Exception as e:
        logger.error("Matcher agent failed: %s", e)
        await emit(state, evt_agent_error(agent="matcher", message=f"Product matching failed: {e}"))
        return {
            **state,
            "error": f"Matcher error: {e}",
            "current_step": "matcher_failed",
        }
