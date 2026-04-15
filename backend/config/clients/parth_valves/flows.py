"""Client-specific agent flow configurations for Parth Valves."""

CONFIDENCE_THRESHOLD = 0.85

FLOW_RULES: dict[str, dict] = {
    "complete": {
        "description": "All info present, direct to quotation",
        "auto_quote": True,
        "requires_approval": False,
    },
    "incomplete": {
        "description": "Missing fields — return questions to ask",
        "auto_quote": False,
        "requires_approval": False,
    },
    "ambiguous": {
        "description": "Product unclear — AI recommends, flags for review",
        "auto_quote": True,
        "requires_approval": True,
    },
    "not_found": {
        "description": "Product not in catalog",
        "auto_quote": False,
        "requires_approval": True,
    },
}


def get_flow_rule(flow_type: str) -> dict:
    return FLOW_RULES.get(flow_type, FLOW_RULES["not_found"])
