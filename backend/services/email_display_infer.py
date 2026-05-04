"""Infer client / company display name from raw email text (signature, footer)."""

from __future__ import annotations

import re


_SUFFIX = re.compile(
    r"(PVT\.?\s*LTD|LLP|PRIVATE\s+LIMITED|LIMITED|LTD\.?|INC\.?|LLC|CORPORATION)\.?\s*$",
    re.IGNORECASE,
)

_SKIP_SUBSTR = (
    "http://",
    "https://",
    "www.",
    "@",
    "unsubscribe",
    "mailto:",
    "sent from my",
    "get outlook",
)

_SKIP_PREFIX = re.compile(
    r"^(regards|thanks|thank you|best regards|sincerely|cheers|warm regards|kind regards)\b",
    re.IGNORECASE,
)


def _clean_line(ln: str) -> str:
    s = ln.strip().strip("*").strip()
    return " ".join(s.split())


def infer_company_from_email_raw(raw: str | None) -> str | None:
    """Best-effort company name from footer (e.g. … SERVICES PVT LTD) or last ALL-CAPS block."""
    if not raw or not raw.strip():
        return None

    tail = raw.strip()[-4500:]
    lines = [_clean_line(x) for x in tail.splitlines()]
    lines = [x for x in lines if x]

    for ln in reversed(lines):
        if len(ln) < 6:
            continue
        low = ln.lower()
        if any(s in low for s in _SKIP_SUBSTR):
            continue
        if _SKIP_PREFIX.match(ln):
            continue
        if re.match(r"^[\d\s\+\-\(\)\./]{8,}$", ln) and "@" not in ln:
            continue
        if re.match(r"^[#\-_=]{3,}$", ln):
            continue

        m = _SUFFIX.search(ln)
        if m:
            name = ln[: m.start()].strip()
            if len(name) >= 4 and sum(c.isalpha() for c in name) >= 4:
                full = f"{name} {m.group(1)}".strip()
                return " ".join(full.split())

        if (
            len(ln) >= 14
            and ln.isupper()
            and "@" not in ln
            and sum(c.isalpha() for c in ln) >= 10
            and any(k in ln for k in ("SERVICES", "PVT", "LTD", "LLP", "LIMITED", "PROCUREMENT", "PRIVATE", "INDIA"))
        ):
            return " ".join(ln.split())

    return None
