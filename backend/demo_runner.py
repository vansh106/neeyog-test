#!/usr/bin/env python
"""Demo runner — calls the running API with 4 representative enquiry flows.

Usage:
    1. Start the API:  uvicorn api.main:app --reload --port 8000
    2. Run this script: python demo_runner.py

Flags:
    --diagnose   Run component checks only (DB, LLM, products) without flows
    --flow N     Run only flow number N (1-4)
    --timeout N  Per-request timeout in seconds (default: 60)
"""

import asyncio
import sys
import time
import argparse
import threading

import httpx

BASE_URL = "http://localhost:8000"

FLOWS = [
    {
        "name": "Complete and Clear",
        "email_text": (
            "From: Suresh Mehta <suresh@abc.com>\n"
            "Dear Sir,\n"
            "We require the following items:\n"
            "1. Aluminium Butterfly Valve - 2 inch - 10 Nos\n"
            "2. Aluminium Butterfly Valve - 3 inch - 5 Nos\n"
            "Please send us the best quotation at earliest.\n"
            "Regards, Suresh Mehta, ABC Engineering, 9823456789"
        ),
        "expected_flow": "complete",
        "expect_pdf": True,
    },
    {
        "name": "Incomplete Enquiry",
        "email_text": (
            "Hi, we need butterfly valves for our plant. "
            "Can you send pricing?\n"
            "Contact: Priya, 9988776655"
        ),
        "expected_flow": "incomplete",
        "expect_pdf": False,
    },
    {
        "name": "Ambiguous Product",
        "email_text": (
            "From: Vikram Singh\n"
            "We need 15 units of 4 inch valve for steam line,\n"
            "temperature 150 degrees, pressure 8 bar.\n"
            "Company: Singh Industries, vikram@singhind.com"
        ),
        "expected_flow": "ambiguous",
        "expect_pdf": True,
    },
    {
        "name": "Product Not in Catalog",
        "email_text": (
            "From: Anil Sharma <anil@sharma.com>\n"
            "We need 20 units of 6 inch SS316 Ball Valve "
            "with flanged ends. Please quote urgently.\n"
            "Anil Sharma, Sharma Chemicals, 9712345678"
        ),
        "expected_flow": "not_found",
        "expect_pdf": False,
    },
]

_DIVIDER = "=" * 50


# ─── Progress ticker ──────────────────────────────────────────────────────────
# Prints a dot every 3 seconds while the API call is running so you know
# the script is alive and not frozen.

class Ticker:
    def __init__(self, label: str):
        self.label = label
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def _run(self):
        sys.stdout.write(f"  ⏳ {self.label} ")
        sys.stdout.flush()
        count = 0
        while not self._stop.is_set():
            time.sleep(3)
            if not self._stop.is_set():
                count += 1
                sys.stdout.write(f"{count * 3}s.. ")
                sys.stdout.flush()

    def start(self):
        self._thread.start()
        return self

    def stop(self):
        self._stop.set()
        self._thread.join(timeout=1)
        sys.stdout.write("\n")
        sys.stdout.flush()


# ─── Diagnostics ──────────────────────────────────────────────────────────────

async def run_diagnostics(client: httpx.AsyncClient) -> bool:
    """Check each system component before running flows."""
    print(f"\n{_DIVIDER}")
    print("  DIAGNOSTICS")
    print(_DIVIDER)
    all_ok = True

    # 1. Health check
    print("\n  [1/4] API health check...")
    try:
        r = await client.get(f"{BASE_URL}/health", timeout=5.0)
        h = r.json()
        print(f"        ✅ OK — client={h.get('client')} model={h.get('model')}")
    except Exception as e:
        print(f"        ❌ FAILED — {e}")
        print("\n  Cannot reach API. Make sure it is running:")
        print("    uvicorn api.main:app --reload --port 8000")
        return False

    # 2. Database — check products are seeded
    print("\n  [2/4] Database — checking product catalog...")
    try:
        r = await client.get(f"{BASE_URL}/api/masters/products", timeout=10.0)
        if r.status_code == 200:
            products = r.json()
            count = len(products) if isinstance(products, list) else products.get("count", "?")
            print(f"        ✅ OK — {count} products in catalog")
        else:
            print(f"        ⚠️  Status {r.status_code} — {r.text[:100]}")
            all_ok = False
    except Exception as e:
        print(f"        ⚠️  Could not reach /api/masters/products — {e}")
        print("        (This endpoint may not be built yet — continuing)")

    # 3. LLM connectivity — lightweight ping via a dedicated diagnostic endpoint
    print("\n  [3/4] LLM connectivity check...")
    try:
        r = await client.get(f"{BASE_URL}/api/diagnostics/llm-ping", timeout=30.0)
        if r.status_code == 200:
            d = r.json()
            print(f"        ✅ OK — model={d.get('model')} response={d.get('response')!r}")
        elif r.status_code == 404:
            # Endpoint not built yet — do a minimal manual test
            print("        ℹ️  /api/diagnostics/llm-ping not found.")
            print("        → Check the API terminal for LiteLLM errors on startup.")
            print("        → Continuing — LLM will be tested when flows run.")
        else:
            print(f"        ❌ LLM ping failed — {r.status_code}: {r.text[:200]}")
            all_ok = False
    except httpx.TimeoutException:
        print("        ❌ LLM ping timed out after 30s.")
        print("        Common causes:")
        print("          • ANTHROPIC_API_KEY missing or wrong in .env")
        print("          • LITELLM_MODEL value is incorrect")
        print("          • Network issue reaching Anthropic API")
        all_ok = False
    except Exception as e:
        print(f"        ⚠️  {e} — continuing")

    # 4. LangGraph graph import check via a dedicated endpoint
    print("\n  [4/4] LangGraph graph check...")
    try:
        r = await client.get(f"{BASE_URL}/api/diagnostics/graph-check", timeout=10.0)
        if r.status_code == 200:
            print(f"        ✅ OK — graph compiled successfully")
        elif r.status_code == 404:
            print("        ℹ️  /api/diagnostics/graph-check not found — skipping")
        else:
            print(f"        ❌ Graph check failed — {r.text[:200]}")
            all_ok = False
    except Exception as e:
        print(f"        ⚠️  {e} — skipping")

    status = "✅ All checks passed" if all_ok else "⚠️  Some checks failed — flows may not work"
    print(f"\n  Result: {status}")
    return all_ok


# ─── Single flow runner ───────────────────────────────────────────────────────

async def run_flow(
    client: httpx.AsyncClient,
    idx: int,
    flow: dict,
    timeout: int
) -> dict:
    print(f"\n{_DIVIDER}")
    print(f"  FLOW {idx}: {flow['name']}")
    print(_DIVIDER)
    print(f"  Email preview: {flow['email_text'][:80].strip()}...")

    payload = {"email_text": flow["email_text"], "input_type": "email"}
    start = time.monotonic()

    ticker = Ticker(f"Calling API (timeout={timeout}s)").start()
    try:
        resp = await client.post(
            f"{BASE_URL}/api/enquiries/upload-email",
            json=payload,
            timeout=float(timeout),
        )
        ticker.stop()
        elapsed = time.monotonic() - start

        if resp.status_code != 200:
            print(f"  ❌ HTTP {resp.status_code}")
            print(f"  Body: {resp.text[:300]}")
            return {"ok": False, "data": {}, "elapsed": elapsed}

        data = resp.json()

    except httpx.TimeoutException:
        ticker.stop()
        elapsed = time.monotonic() - start
        print(f"  ❌ TIMEOUT after {elapsed:.0f}s")
        print()
        print("  The API did not respond in time. Most likely causes:")
        print("  1. LiteLLM / Claude API call is hanging inside an agent.")
        print("     → Check the API terminal. You should see log lines like:")
        print('       "Parser agent starting..." or LiteLLM DEBUG output.')
        print("     → If the API terminal is also silent, the LLM call is")
        print("       blocking the async event loop. Fix: ensure all LLM")
        print("       calls use `await litellm.acompletion(...)` not the")
        print("       sync `litellm.completion(...)` version.")
        print()
        print("  2. LangGraph graph.ainvoke() is stuck in a node.")
        print("     → Add print() statements at the START of each agent")
        print("       function to see which node it enters and where it stops.")
        print()
        print("  3. Database query inside an agent is blocking.")
        print("     → All SQLAlchemy calls must use async session + await.")
        print()
        print("  Quick debug step:")
        print("    curl -X POST http://localhost:8000/api/enquiries/upload-email \\")
        print('      -H "Content-Type: application/json" \\')
        print('      -d \'{"email_text": "Need 2 inch butterfly valve qty 5"}\' \\')
        print("      --max-time 90 -v")
        print("    Then watch the API terminal for where it stops logging.")
        return {"ok": False, "data": {}, "elapsed": elapsed}

    except httpx.ConnectError:
        ticker.stop()
        print("  ❌ Cannot connect to API on port 8000.")
        print("     Start it with: uvicorn api.main:app --reload --port 8000")
        return {"ok": False, "data": {}, "elapsed": 0}

    except Exception as exc:
        ticker.stop()
        elapsed = time.monotonic() - start
        print(f"  ❌ Unexpected error: {exc}")
        return {"ok": False, "data": {}, "elapsed": elapsed}

    # ── Print results ──────────────────────────────────────────────────────
    status      = data.get("status", "unknown")
    flow_type   = data.get("flow_type", "?")
    message     = data.get("message", "")
    quotation_id    = data.get("quotation_id")
    pdf_available   = data.get("pdf_available", False)
    pdf_path        = data.get("pdf_path")
    clarification   = data.get("clarification_questions")
    reasoning       = data.get("ai_reasoning", [])
    needs_review    = data.get("requires_human_review", False)

    icon = "✅" if status != "failed" else "❌"

    print(f"  Status:   {icon} {status.upper()}")
    print(f"  Flow:     {flow_type}")
    print(f"  Message:  {message}")
    print(f"  Time:     {elapsed:.1f}s")

    if reasoning:
        print("  Steps:")
        for r in reasoning:
            print(f"    → {r}")

    if quotation_id:
        print(f"  Quote ID: {quotation_id}")

    if pdf_available and pdf_path:
        print(f"  PDF:      {pdf_path} ✅")
    elif flow["expect_pdf"]:
        print("  PDF:      ❌ NOT generated (expected one)")

    if clarification:
        print(f"  Clarification:\n    {clarification[:300]}")

    if needs_review:
        print("  ⚠️  Requires human review before sending")

    # ── Verdict ───────────────────────────────────────────────────────────
    matched  = (flow_type == flow["expected_flow"])
    pdf_ok   = (pdf_available == flow["expect_pdf"])
    ok       = matched and pdf_ok and status != "failed"

    verdict = "✅ PASS" if ok else "❌ MISMATCH"
    notes = []
    if not matched:
        notes.append(f"expected flow={flow['expected_flow']!r}, got {flow_type!r}")
    if not pdf_ok:
        notes.append(f"expected pdf={flow['expect_pdf']}, got {pdf_available}")
    if notes:
        verdict += "  (" + ", ".join(notes) + ")"

    print(f"\n  Verdict:  {verdict}")
    return {"ok": ok, "data": data, "elapsed": elapsed}


# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Quotation system demo runner")
    parser.add_argument("--diagnose", action="store_true",
                        help="Run diagnostics only, skip flows")
    parser.add_argument("--flow", type=int, choices=[1, 2, 3, 4],
                        help="Run only a specific flow (1-4)")
    parser.add_argument("--timeout", type=int, default=60,
                        help="Per-request timeout in seconds (default 60)")
    args = parser.parse_args()

    print("\n" + _DIVIDER)
    print("  QUOTATION SYSTEM — DEMO RUNNER")
    print(_DIVIDER)

    async with httpx.AsyncClient() as client:

        # ── Always run health check first ──────────────────────────────────
        print("\n  Pre-flight: health check...", end=" ", flush=True)
        try:
            health = await client.get(f"{BASE_URL}/health", timeout=5.0)
            h = health.json()
            print(f"✅  |  client={h.get('client')}  model={h.get('model')}")
        except httpx.ConnectError:
            print("\n\n  ❌ API is not running. Start it first:")
            print("     uvicorn api.main:app --reload --port 8000")
            sys.exit(1)
        except Exception as e:
            print(f"❌  {e}")
            sys.exit(1)

        # ── Diagnostics ────────────────────────────────────────────────────
        if args.diagnose:
            await run_diagnostics(client)
            return

        # ── Choose flows to run ────────────────────────────────────────────
        flows_to_run = (
            [(args.flow, FLOWS[args.flow - 1])]
            if args.flow
            else list(enumerate(FLOWS, 1))
        )

        print(f"\n  Running {len(flows_to_run)} flow(s) "
              f"with timeout={args.timeout}s per flow")
        print("  Tip: watch the API terminal in parallel to see agent logs.\n")

        results = []
        for idx, flow in flows_to_run:
            result = await run_flow(client, idx, flow, args.timeout)
            results.append(result)
            # Small pause between flows so logs don't interleave
            if idx != flows_to_run[-1][0]:
                await asyncio.sleep(1)

    # ── Summary ───────────────────────────────────────────────────────────
    passed     = sum(1 for r in results if r["ok"])
    total      = len(results)
    total_time = sum(r["elapsed"] for r in results)

    print(f"\n{_DIVIDER}")
    print(f"  SUMMARY: {passed}/{total} passed  |  Total time: {total_time:.1f}s")
    print(_DIVIDER)

    if passed < total:
        print("\n  Some flows didn't match expectations.")
        print("  LLM output can vary — check the API terminal for detail.")
        print("  Run with --diagnose to check individual components.\n")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))