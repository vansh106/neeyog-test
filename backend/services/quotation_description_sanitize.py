"""Strip internal supplier names from customer-facing quotation text."""

from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from services.pricing_service import get_suppliers

_DESC_SEP = " : "
_EXCLUDED_LABELS = frozenset({"supplier", "supplier id"})
_PLACEHOLDER_VALUES = frozenset({"----", "—", "-"})
_MAKE_PATTERN = re.compile(r"\s+make\b", re.IGNORECASE)


async def supplier_names_for_client(db: AsyncSession, *, client_id: str | None = None) -> list[str]:
    """All supplier names for the client, longest first (for safe multi-word matching)."""
    settings = get_settings()
    cid = (client_id or settings.ACTIVE_CLIENT or "").strip()
    if not cid:
        return []
    rows = await get_suppliers(cid, db, active_only=False)
    names = {str(s.name).strip() for s in rows if getattr(s, "name", None) and str(s.name).strip()}
    return sorted(names, key=len, reverse=True)


def strip_supplier_names_from_text(text: str, supplier_names: list[str] | None) -> str:
    """Remove known supplier names and trailing ``Make`` markers from free text."""
    if not text:
        return ""
    result = text
    if supplier_names:
        for name in sorted({n.strip() for n in supplier_names if n and str(n).strip()}, key=len, reverse=True):
            pattern = re.compile(r"\b" + re.escape(name) + r"\b", re.IGNORECASE)
            result = pattern.sub("", result)
    result = _MAKE_PATTERN.sub("", result)
    result = re.sub(r"\s{2,}", " ", result)
    result = re.sub(r"\s+—", " —", result)
    return result.strip()


def sanitize_quotation_description_for_display(
    desc: object,
    supplier_names: list[str] | None = None,
) -> str:
    """Drop empty spec lines and omit supplier names from quotation descriptions."""
    if not desc:
        return ""
    names = supplier_names or []
    out: list[str] = []
    for line in str(desc).split("\n"):
        if _DESC_SEP not in line:
            cleaned = strip_supplier_names_from_text(line.strip(), names)
            if cleaned:
                out.append(cleaned)
            continue
        label, _, val = line.partition(_DESC_SEP)
        if label.strip().lower() in _EXCLUDED_LABELS:
            continue
        v = val.strip()
        if not v or v in _PLACEHOLDER_VALUES:
            continue
        cleaned_val = strip_supplier_names_from_text(v, names)
        if not cleaned_val:
            continue
        out.append(f"{label.strip()}{_DESC_SEP}{cleaned_val}")
    return "\n".join(out)
