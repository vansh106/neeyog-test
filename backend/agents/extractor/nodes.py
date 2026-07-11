"""LangGraph nodes for the centralized product extractor."""

from __future__ import annotations

import json
import logging
from typing import Any

from core.litellm_client import llm_client, strip_llm_json_payload
from services.sse_service import (
    evt_agent_complete,
    evt_agent_error,
    evt_agent_start,
    evt_agent_warning,
    get_emitter,
)

from agents.extractor.catalog_match import (
    VARIANT_NAV_SLUG,
    cascade_from_row,
    find_best_row,
    infer_catalog_key,
    infer_variant_type,
)
from agents.extractor.prompts import EXTRACTOR_SYSTEM_PROMPT, build_extractor_user_prompt
from agents.extractor.state import CatalogMatchLine, ExtractedDemandItem, ExtractorState

logger = logging.getLogger(__name__)


async def _emit(enquiry_id: str, event: dict) -> None:
    emitter = get_emitter(enquiry_id)
    if emitter is not None:
        await emitter.emit(event)


async def load_context(state: ExtractorState) -> dict[str, Any]:
    eid = state["enquiry_id"]
    await _emit(
        eid,
        evt_agent_start(
            "extractor",
            "Loading enquiry context",
            detail="Reading source message for product demand",
        ),
    )
    raw = (state.get("raw_input") or "").strip()
    if not raw:
        await _emit(eid, evt_agent_warning("extractor", "Enquiry has no source message text"))
    else:
        await _emit(
            eid,
            evt_agent_complete(
                "extractor",
                "Context loaded",
                data={"chars": len(raw), "client": state.get("client_company")},
            ),
        )
    # LangGraph requires every node to return at least one state key update.
    return {
        "enquiry_id": eid,
        "raw_input": raw,
        "client_company": state.get("client_company"),
        "client_name": state.get("client_name"),
        "error": None,
    }


async def parse_demand(state: ExtractorState) -> dict[str, Any]:
    eid = state["enquiry_id"]
    await _emit(
        eid,
        evt_agent_start(
            "parser",
            "Extracting demanded products with AI",
            detail="LangGraph → LiteLLM demand parser",
        ),
    )
    try:
        user_prompt = build_extractor_user_prompt(
            raw_input=state.get("raw_input") or "",
            client_company=state.get("client_company"),
            client_name=state.get("client_name"),
        )
        raw = await llm_client.complete(
            EXTRACTOR_SYSTEM_PROMPT,
            user_prompt,
            response_format="json",
            max_tokens=4096,
        )
        payload = json.loads(strip_llm_json_payload(raw))
    except Exception as exc:  # noqa: BLE001
        logger.exception("parse_demand failed")
        await _emit(eid, evt_agent_error("parser", f"AI parse failed: {exc}"))
        return {
            "demand_items": [],
            "parse_notes": str(exc),
            "parse_confidence": 0.0,
            "error": f"parse_failed: {exc}",
        }

    products = payload.get("products") if isinstance(payload, dict) else None
    items: list[ExtractedDemandItem] = []
    if isinstance(products, list):
        for p in products:
            if not isinstance(p, dict):
                continue
            desc = str(p.get("product_description") or "").strip()
            if not desc:
                continue
            qty = p.get("quantity")
            qty_i: int | None = None
            if isinstance(qty, (int, float)) and qty > 0:
                qty_i = int(qty)
            kws = p.get("keywords") if isinstance(p.get("keywords"), list) else []
            items.append(
                ExtractedDemandItem(
                    product_description=desc,
                    catalog_key=str(p.get("catalog_key") or "").strip() or None,
                    variant_type=str(p.get("variant_type") or "").strip() or None,
                    size_hint=str(p.get("size_hint") or "").strip() or None,
                    quantity=qty_i,
                    keywords=[str(k).strip() for k in kws if str(k).strip()],
                    confidence=float(p.get("confidence") or 0.5),
                )
            )

    conf = float(payload.get("confidence") or 0.0) if isinstance(payload, dict) else 0.0
    notes = str(payload.get("notes") or "").strip() if isinstance(payload, dict) else ""
    await _emit(
        eid,
        evt_agent_complete(
            "parser",
            f"Identified {len(items)} product ask(s)",
            data={
                "count": len(items),
                "products": [i.get("product_description") for i in items],
                "notes": notes,
            },
        ),
    )
    return {
        "demand_items": items,
        "parse_notes": notes or None,
        "parse_confidence": conf,
        "error": None if items else "no_products_extracted",
    }


async def match_catalog(state: ExtractorState) -> dict[str, Any]:
    from core.config import get_settings
    from core.database import async_session_factory

    eid = state["enquiry_id"]
    items = state.get("demand_items") or []
    await _emit(
        eid,
        evt_agent_start(
            "matcher",
            "Matching against Packaging masters",
            detail="Aluminium Foil + Paper Products catalogs",
        ),
    )

    if not items:
        await _emit(eid, evt_agent_warning("matcher", "Nothing to match — parser found no products"))
        return {
            "match_lines": [],
            "primary_catalog_key": None,
            "overall_confidence": 0.0,
            "product_completeness": "incomplete",
        }

    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT
    lines: list[CatalogMatchLine] = []

    async with async_session_factory() as db:
        for i, item in enumerate(items, start=1):
            desc = item.get("product_description") or ""
            keywords = list(item.get("keywords") or [])
            catalog_key = item.get("catalog_key") or infer_catalog_key(
                item.get("variant_type"), desc, keywords
            )
            variant = item.get("variant_type") or infer_variant_type(catalog_key, desc, keywords)
            if not catalog_key:
                catalog_key = infer_catalog_key(variant, desc, keywords)

            qty = item.get("quantity") if isinstance(item.get("quantity"), int) else 1
            if not qty or qty < 1:
                qty = 1

            if not catalog_key:
                lines.append(
                    CatalogMatchLine(
                        index=i,
                        quantity=qty,
                        catalog_key="",
                        variant_type=variant,
                        nav_slug=VARIANT_NAV_SLUG.get(variant or ""),
                        product_label=desc,
                        filled_cascade={"variant_type": variant} if variant else {},
                        match_confidence=0.0,
                        match_reason="Could not map to a Packaging catalog family",
                        matched=False,
                    )
                )
                continue

            row, score = await find_best_row(
                db,
                client_id=client_id,
                catalog_key=catalog_key,
                variant_type=variant,
                size_hint=item.get("size_hint"),
                keywords=keywords,
                description=desc,
            )
            if row is None:
                filled = {"variant_type": variant} if variant else {}
                if item.get("size_hint"):
                    filled["size_value"] = str(item["size_hint"])
                lines.append(
                    CatalogMatchLine(
                        index=i,
                        quantity=qty,
                        catalog_key=catalog_key,
                        variant_type=variant,
                        nav_slug=VARIANT_NAV_SLUG.get(variant or ""),
                        product_label=variant or desc,
                        filled_cascade=filled,
                        match_confidence=float(item.get("confidence") or 0.3) * 0.5,
                        match_reason="Category inferred; no exact catalog row — complete cascade manually",
                        matched=False,
                    )
                )
                continue

            row_vt = (getattr(row, "variant_type", None) or variant or "").strip() or None
            filled = cascade_from_row(catalog_key, row, row_vt)
            conf = min(0.95, 0.4 + score + 0.2 * float(item.get("confidence") or 0.5))
            lines.append(
                CatalogMatchLine(
                    index=i,
                    quantity=qty,
                    catalog_key=catalog_key,
                    variant_type=row_vt,
                    nav_slug=VARIANT_NAV_SLUG.get(row_vt or ""),
                    product_label=str(getattr(row, "product_name", None) or row_vt or desc),
                    filled_cascade=filled,
                    match_confidence=round(conf, 3),
                    match_reason=f"Matched catalog row (score={score:.2f})",
                    matched=True,
                )
            )

    # Prefer a single primary catalog for ManualEntryForm seed
    matched_keys = [ln["catalog_key"] for ln in lines if ln.get("catalog_key")]
    primary = matched_keys[0] if matched_keys else None
    # If mixed catalogs, keep lines for the most common key
    if matched_keys:
        primary = max(set(matched_keys), key=matched_keys.count)

    overall = (
        sum(float(ln.get("match_confidence") or 0) for ln in lines) / len(lines) if lines else 0.0
    )
    any_matched = any(ln.get("matched") for ln in lines)
    completeness = "complete" if any_matched and all(
        ln.get("matched") and len(ln.get("filled_cascade") or {}) >= 2 for ln in lines
    ) else "incomplete"

    await _emit(
        eid,
        evt_agent_complete(
            "matcher",
            f"Matched {sum(1 for ln in lines if ln.get('matched'))}/{len(lines)} line(s)",
            data={
                "primary_catalog_key": primary,
                "lines": [
                    {
                        "product": ln.get("product_label"),
                        "catalog_key": ln.get("catalog_key"),
                        "matched": ln.get("matched"),
                        "confidence": ln.get("match_confidence"),
                    }
                    for ln in lines
                ],
            },
        ),
    )
    return {
        "match_lines": lines,
        "primary_catalog_key": primary,
        "overall_confidence": round(overall, 3),
        "product_completeness": completeness,
    }


async def persist_result(state: ExtractorState) -> dict[str, Any]:
    import uuid as _uuid

    from core.database import async_session_factory
    from db.models import Enquiry
    from services.sse_service import evt_result

    eid = state["enquiry_id"]
    await _emit(
        eid,
        evt_agent_start("system", "Saving extracted products on enquiry"),
    )

    lines = state.get("match_lines") or []
    primary = state.get("primary_catalog_key")
    seed_lines = [ln for ln in lines if ln.get("catalog_key") == primary] if primary else lines
    if not seed_lines:
        seed_lines = lines

    first = seed_lines[0] if seed_lines else None
    filled = dict(first.get("filled_cascade") or {}) if first else {}
    product_label = (
        first.get("product_label")
        if first
        else (state.get("parse_notes") or "Extracted products")
    )

    matcher_payload: dict[str, Any] = {
        "version": 1,
        "source": "langgraph_extractor",
        "email_intent": "rfq",
        "product_completeness": state.get("product_completeness") or "incomplete",
        "confidence": state.get("overall_confidence") or 0.0,
        "catalog_key": primary,
        "product_label": product_label,
        "recommend_revert": False,
        "revert_reason": None,
        "rfq_line_count": len(seed_lines),
        "filled_cascade": filled,
        "line_items": [
            {
                "index": ln.get("index", i + 1),
                "quantity": ln.get("quantity") or 1,
                "filled_cascade": ln.get("filled_cascade") or {},
                "nav_slug": ln.get("nav_slug"),
                "variant_type": ln.get("variant_type"),
                "matched": bool(ln.get("matched")),
                "match_confidence": ln.get("match_confidence"),
                "match_reason": ln.get("match_reason"),
                "product_label": ln.get("product_label"),
            }
            for i, ln in enumerate(seed_lines)
        ],
        "missing_cascade_keys": [],
        "notes": state.get("parse_notes")
        or "Extracted via LangGraph packaging demand extractor.",
        "all_extracted_lines": [
            {
                "catalog_key": ln.get("catalog_key"),
                "product_label": ln.get("product_label"),
                "matched": ln.get("matched"),
            }
            for ln in lines
        ],
    }

    missing: list[str] = []
    if first and not (first.get("filled_cascade") or {}).get("product_name"):
        missing.append("product_name")
    if first and not (first.get("filled_cascade") or {}).get("size_value"):
        missing.append("size_value")
    matcher_payload["missing_cascade_keys"] = missing

    products_requested = [
        {
            "product_description": ln.get("product_label")
            or (ln.get("filled_cascade") or {}).get("product_name")
            or f"Item {ln.get('index', i + 1)}",
            "quantity": ln.get("quantity") or 1,
            "catalog_key": ln.get("catalog_key"),
            "variant_type": ln.get("variant_type"),
        }
        for i, ln in enumerate(seed_lines)
    ]

    reasoning = [
        f"LangGraph extractor — parse confidence {state.get('parse_confidence') or 0:.2f}",
        f"Products asked: {len(state.get('demand_items') or [])}",
        f"Catalog matches: {sum(1 for ln in lines if ln.get('matched'))}/{len(lines)}",
        f"Primary catalog: {primary or '—'}",
    ]
    if state.get("parse_notes"):
        reasoning.append(f"Notes: {state['parse_notes']}")
    if state.get("error"):
        reasoning.append(f"Warning: {state['error']}")

    try:
        eid_uuid = _uuid.UUID(str(eid))
    except ValueError:
        await _emit(eid, evt_agent_error("system", "Invalid enquiry id while persisting"))
        return {"error": "invalid_enquiry_id"}

    async with async_session_factory() as db:
        enquiry = await db.get(Enquiry, eid_uuid)
        if enquiry is None:
            await _emit(eid, evt_agent_error("system", "Enquiry not found while persisting"))
            return {"error": "enquiry_not_found"}

        pd = enquiry.parsed_data if isinstance(enquiry.parsed_data, dict) else {}
        pd = {
            **pd,
            "matcher": matcher_payload,
            "products_requested": products_requested,
            "extractor_source": "langgraph",
        }
        enquiry.parsed_data = pd
        enquiry.confidence_score = float(state.get("overall_confidence") or 0)
        enquiry.ai_reasoning = json.dumps(reasoning, ensure_ascii=False)
        if primary:
            enquiry.status = "matcher_ready"
        await db.commit()
        await db.refresh(enquiry)

    await _emit(
        eid,
        evt_agent_complete(
            "system",
            "Extraction saved — ready to configure products",
            data={"catalog_key": primary, "line_count": len(seed_lines)},
        ),
    )
    await _emit(
        eid,
        evt_result(
            {
                "enquiry_id": eid,
                "matcher": matcher_payload,
                "products_requested": products_requested,
                "ai_reasoning": reasoning,
            }
        ),
    )
    return {
        "matcher_payload": matcher_payload,
        "products_requested": products_requested,
        "ai_reasoning": reasoning,
    }
