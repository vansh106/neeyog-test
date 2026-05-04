"""Rules for quotation / valve–work related mail (IMAP sync + inbox listing)."""

from __future__ import annotations

import re

from core.config import Settings, get_settings


def _csv_terms(s: str) -> list[str]:
    return [x.strip().lower() for x in s.split(",") if x.strip()]


def _any_in(haystack: str, terms: list[str]) -> bool:
    return any(t in haystack for t in terms)


def is_quotation_work_related(
    subject: str,
    body: str,
    sender_email: str,
    *,
    settings: Settings | None = None,
) -> bool:
    """True when the message looks like a buyer RFQ (valves / pricing / B2B portals)."""
    cfg = settings or get_settings()
    combined = f"{subject}\n{body}\n{sender_email}".lower()

    portal_terms = _csv_terms(cfg.email_portal_signal_terms)
    commerce_terms = _csv_terms(cfg.email_quotation_commerce_terms)
    product_terms = _csv_terms(cfg.email_quotation_product_terms)
    portal_loose = _csv_terms(cfg.email_portal_loose_terms)

    portal = _any_in(combined, portal_terms)
    commerce = _any_in(combined, commerce_terms)
    product = _any_in(combined, product_terms)

    if portal:
        if commerce or product:
            return True
        if _any_in(combined, portal_loose):
            return True
        return False

    if commerce and product:
        return True

    # Short RFQs: price/quote language + sizing without the word "valve"
    if commerce and re.search(r"\b(dn\d{1,4}|\d{1,3}\s*(mm|inch|\"|''))\b", combined):
        return True

    return False


def _parse_from_subject_body(raw_input: str) -> tuple[str, str, str]:
    """Best-effort parse of our stored email text (From/Date/Subject + blank line + body)."""
    subject = ""
    sender = ""
    lines = raw_input.replace("\r\n", "\n").split("\n")
    for line in lines[:40]:
        ls = line.strip()
        low = ls.lower()
        if low.startswith("subject:"):
            subject = ls[8:].strip()
        elif low.startswith("from:"):
            sender = ls[5:].strip()
    body_start = raw_input.find("\n\n")
    body = raw_input[body_start + 2 :] if body_start != -1 else raw_input
    return subject, body, sender


def raw_input_is_quotation_work_related(raw_input: str, *, settings: Settings | None = None) -> bool:
    """Same rules as sync, using the stored email-style blob (From/Subject/body)."""
    if not raw_input or not raw_input.strip():
        return False
    subject, body, sender = _parse_from_subject_body(raw_input)
    return is_quotation_work_related(subject, body, sender, settings=settings)
