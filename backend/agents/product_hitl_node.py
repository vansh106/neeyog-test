"""HITL pause node: product completion using DB cascade dropdowns.

This is triggered for AI-driven enquiries when the parsed specs are incomplete
or produce multiple DB matches. The UI will render cascade dropdowns (same as
manual entry) so the user can either:
- Fill missing fields themselves, then continue to quoting, OR
- Choose which fields/questions to ask the client in a follow-up email.
"""

from agents.state import EnquiryState, emit
from services import masters_service


def _missing_keys_for_schema(schema_keys: list[str], selections: dict[str, str]) -> list[str]:
    if not schema_keys:
        return []
    missing: list[str] = []
    for k in schema_keys:
        if not selections.get(k):
            missing.append(k)
    return missing


async def product_hitl_node(state: EnquiryState) -> EnquiryState:
    parsed = state.get("parsed_data") or {}
    products = parsed.get("products_requested") or []

    items: list[dict] = []
    for idx, req in enumerate(products):
        if not isinstance(req, dict):
            continue
        category = (req.get("category") or req.get("category_key") or "").strip()
        if not category:
            # Can't offer DB cascade without a category key
            continue

        schema = masters_service.get_cascade_schema(category)
        schema_keys = [s["key"] for s in schema]

        # Parser may either provide explicit cascade_filters or embed keys directly.
        selections = req.get("cascade_filters") if isinstance(req.get("cascade_filters"), dict) else {}
        if not selections:
            selections = {k: str(req.get(k)).strip() for k in schema_keys if req.get(k) is not None and str(req.get(k)).strip()}

        missing = _missing_keys_for_schema(schema_keys, selections)

        items.append(
            {
                "index": idx,
                "category": category,
                "schema": schema,
                "selections": selections,
                "missing_keys": missing,
                "product_description": req.get("product_description") or req.get("product_name") or f"Item {idx + 1}",
                "quantity": req.get("quantity") or 1,
            }
        )

    context = {
        "type": "product_completion",
        "summary": "Additional product details needed to match the catalog exactly.",
        "items": items,
        "options_available": ["fill_self", "ask_client"],
    }

    await emit(
        state,
        {
            "type": "product_hitl_required",
            "agent": "system",
            "message": "Product details required",
            "status": "waiting",
            "product_context": context,
        },
    )

    return {
        **state,
        "product_hitl_context": context,
        "awaiting_human": True,
        "product_hitl_decision": None,
        "product_hitl_payload": None,
        "current_step": "product_completion",
        # Keep flow_type as incomplete so downstream nodes know this is not quoted yet.
    }

