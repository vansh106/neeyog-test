"""Composes the outbound email to the client (clarification or confirmation)."""

import logging
import re

from agents.state import EnquiryState, emit
from core.exceptions import LLMCallError
from core.litellm_client import llm_client
from services.sse_service import evt_agent_start, evt_agent_complete

logger = logging.getLogger(__name__)

_NON_TECH_MISSING_KEYS = {
    # client identifiers / contact
    "client_company",
    "client_email",
    "client_phone",
    "client_name",
    "company_name",
    "email",
    "phone",
    "address",
    "delivery_address",
    "billing_address",
    "city",
    "state",
    "country",
    # commercial / admin
    "gst",
    "gst_number",
    "pan",
    "payment_terms",
    "freight",
    "freight_terms",
    "warranty",
    "lead_time",
    "packing",
    "dispatch",
}

_ADMIN_QUESTION_PATTERNS = [
    r"\bgst\b",
    r"\bgst\s*number\b",
    r"\bpan\b",
    r"\bbilling\s+address\b",
    r"\bdelivery\s+address\b",
    r"\bshipping\s+address\b",
    r"\bfreight\b",
    r"\bpayment\s+terms\b",
    r"\bwarranty\b",
]

def _strip_admin_questions(email_body: str) -> str:
    """Remove admin/billing/shipping questions that the composer must not ask."""
    text = (email_body or "").strip()
    if not text:
        return text
    lines = text.splitlines()
    out: list[str] = []
    pat = re.compile("|".join(_ADMIN_QUESTION_PATTERNS), re.IGNORECASE)
    for ln in lines:
        if pat.search(ln):
            # Drop lines containing banned asks (bullets, sentences, etc.)
            continue
        out.append(ln)
    # Clean up excessive blank lines (max 1 consecutive).
    cleaned: list[str] = []
    blank = False
    for ln in out:
        is_blank = not ln.strip()
        if is_blank:
            if blank:
                continue
            blank = True
        else:
            blank = False
        cleaned.append(ln)
    return "\n".join(cleaned).strip()

def _filter_technical_missing_fields(missing_fields: list) -> list[str]:
    out: list[str] = []
    for x in missing_fields or []:
        s = str(x).strip()
        if not s:
            continue
        key = s.lower().strip()
        if key in _NON_TECH_MISSING_KEYS:
            continue
        out.append(s)
    # de-dupe preserving order
    seen: set[str] = set()
    uniq: list[str] = []
    for s in out:
        k = s.lower()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(s)
    return uniq

def _fallback_email(client_name: str, missing_fields: list[str], existing_draft: str, instructions: str) -> str:
    name = (client_name or "").strip() or "Sir/Madam"
    missing = [str(x).strip() for x in (missing_fields or []) if str(x).strip()]
    lines: list[str] = [
        f"Dear {name},",
        "",
    ]
    if existing_draft and str(existing_draft).strip():
        # If we already have a drafted email body, keep it (LLM failed on refinement).
        lines.append(str(existing_draft).strip())
    else:
        lines.append("Thank you for your enquiry. To proceed with the quotation, we request the following details:")
        if missing:
            lines.extend([f"- {m}" for m in missing])
        else:
            lines.append("- Please confirm the missing specifications required to finalize the quote.")
    if instructions and str(instructions).strip():
        lines.extend(["", f"Note from our team: {str(instructions).strip()}"])
    lines.extend(["", "Please revert at your earliest convenience.", "", "Warm regards,", "Marketing Team, Parth Valves and Hoses LLP"])
    return _strip_admin_questions("\n".join(lines).strip())


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
        client_name = str(parsed_data.get("client_name", "Sir/Madam") or "Sir/Madam")
        missing_fields_raw = state.get("missing_fields", [])
        missing_fields = _filter_technical_missing_fields(list(missing_fields_raw or []))

        # If nothing technical is missing, don't ask for extra admin/commercial fields.
        if not missing_fields and not (instructions or "").strip():
            final_email = (
                f"Dear {client_name},\n\n"
                "Thank you for your enquiry. We have noted your requirements and are processing your quotation.\n\n"
                "Please revert at your earliest convenience.\n\n"
                "Warm regards,\n"
                "Marketing Team, Parth Valves and Hoses LLP"
            )
        else:
            prompt = (
                f"Draft email to client:\n{existing_draft}\n\n"
                f"Additional instructions from team:\n{instructions}\n\n"
                f"Client name: {client_name}\n"
                f"Missing TECHNICAL fields only: {missing_fields}\n\n"
                "Rewrite or refine the email based on the instructions. "
                "If missing technical fields are provided, ask only for those. "
                "Do NOT ask for GST/address/payment/freight/warranty.\n"
            )
            try:
                # Some providers occasionally return an empty message; retry once, then fall back.
                final_email = await llm_client.complete(
                    system_prompt=prompts_mod.EMAIL_COMPOSER_SYSTEM_PROMPT,
                    user_prompt=prompt,
                )
            except LLMCallError:
                try:
                    final_email = await llm_client.complete(
                        system_prompt=prompts_mod.EMAIL_COMPOSER_SYSTEM_PROMPT,
                        user_prompt=prompt,
                    )
                except LLMCallError:
                    logger.exception("Email composer LLM failed twice; using fallback email")
                    final_email = _fallback_email(client_name, list(missing_fields or []), existing_draft, instructions)
        final_email = _strip_admin_questions(final_email)

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
