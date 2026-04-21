"""
Parth Valves — Flow Configuration
Controls agent routing thresholds and timeouts.
"""

# Confidence below this → human review required
CONFIDENCE_THRESHOLD = 0.85

# Minutes before HITL times out and escalates
HITL_TIMEOUT_MINUTES = 240  # 4 hours

# Days before a quote expires
QUOTE_VALIDITY_DAYS = 15

# How many HITL cycles before auto-escalate
MAX_HITL_CYCLES = 5

FLOW_RULES = {
    "complete": {
        "description": "All info present",
        "auto_quote":  True,
        "requires_approval": False,
    },
    "incomplete": {
        "description": "Missing fields",
        "auto_quote":  False,
        "requires_approval": False,
    },
    "ambiguous": {
        "description": "Product unclear",
        "auto_quote":  True,
        "requires_approval": True,
    },
    "not_found": {
        "description": "Product not in catalog",
        "auto_quote":  False,
        "requires_approval": True,
    },
}

def get_flow_rule(flow_type: str) -> dict:
    return FLOW_RULES.get(
        flow_type, FLOW_RULES["not_found"]
    )
