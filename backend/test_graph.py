"""End-to-end test for the LangGraph enquiry pipeline."""

import asyncio
import logging
import sys
import uuid

logging.basicConfig(level=logging.INFO, format="%(name)s %(levelname)s %(message)s")

from core.database import init_db  # noqa: E402
from orchestrator.graph import run_enquiry_flow  # noqa: E402

test_email = """
From: Rajesh Kumar <rajesh@example.com>
Subject: Quote for Butterfly Valves

Dear Sir,
We need 10 units of 2 inch Aluminium Butterfly Valve.
Please send quotation.

Regards,
Rajesh Kumar
ABC Industries
Phone: 9876543210
"""


async def test():
    await init_db()

    enquiry_id = str(uuid.uuid4())
    print(f"\n{'='*60}")
    print(f"Running enquiry flow: {enquiry_id}")
    print(f"{'='*60}\n")

    result = await run_enquiry_flow(
        enquiry_id=enquiry_id,
        raw_input=test_email,
        input_type="email",
        client_config="parth_valves",
    )

    print(f"\n{'='*60}")
    print("RESULTS")
    print(f"{'='*60}")
    print(f"Flow type:       {result.get('flow_type')}")
    print(f"Current step:    {result.get('current_step')}")
    print(f"Parse confidence:{result.get('parse_confidence')}")
    print(f"Match confidence:{result.get('match_confidence')}")
    print(f"Has quotation:   {result.get('quotation_data') is not None}")
    print(f"Quote ID:        {result.get('quote_id')}")
    print(f"PDF path:        {result.get('pdf_path')}")
    print(f"Error:           {result.get('error')}")
    print(f"Human review:    {result.get('requires_human_review')}")
    print(f"\nAI Reasoning:")
    for line in result.get("ai_reasoning", []):
        print(f"  → {line}")

    if result.get("quotation_data"):
        qd = result["quotation_data"]
        print(f"\nQuotation: {qd.get('quote_number')}")
        print(f"  Subtotal:  ₹{qd.get('subtotal', 0):,.2f}")
        print(f"  GST:       ₹{qd.get('gst_amount', 0):,.2f}")
        print(f"  P&F:       ₹{qd.get('pf_amount', 0):,.2f}")
        print(f"  Total:     ₹{qd.get('total_amount', 0):,.2f}")
        for item in qd.get("line_items", []):
            print(f"  - {item.get('product_name', 'N/A')}: "
                  f"qty={item.get('quantity')}, "
                  f"₹{item.get('unit_price', 0):,.2f} each")

    if result.get("clarification_questions"):
        print(f"\nClarification email:\n{result['clarification_questions']}")

    print(f"\n{'='*60}")
    ok = True
    if result.get("error"):
        print(f"FAIL: Error occurred — {result['error']}")
        ok = False
    if result.get("current_step") not in ("quoted", "awaiting_info", "pending_human_review"):
        print(f"WARN: Unexpected current_step: {result.get('current_step')}")
    print(f"{'='*60}\n")
    return ok


if __name__ == "__main__":
    success = asyncio.run(test())
    sys.exit(0 if success else 1)
