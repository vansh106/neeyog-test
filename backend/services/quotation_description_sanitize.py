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
_END_CONNECTION_DUP = re.compile(r"^(Fitting(?: End \d+)?) End Connection ([12])$")


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


def _parse_desc_line(line: str) -> tuple[str, str] | None:
    if _DESC_SEP not in line:
        return None
    label, _, val = line.partition(_DESC_SEP)
    return label.strip(), val.strip()


def _collapse_duplicate_end_connection_lines(desc: str) -> str:
    lines = desc.split("\n")
    parsed = [_parse_desc_line(line) for line in lines]
    sibling_values: dict[str, str] = {}
    for item in parsed:
        if not item:
            continue
        label, val = item
        if not label:
            continue
        m = _END_CONNECTION_DUP.match(label)
        if m:
            sibling_values[f"{m.group(1)} End Connection {2 if m.group(2) == '1' else 1}"] = val

    out: list[str] = []
    for line, item in zip(lines, parsed):
        if not item:
            out.append(line)
            continue
        label, val = item
        m = _END_CONNECTION_DUP.match(label)
        if not m:
            out.append(line)
            continue
        sibling_label = f"{m.group(1)} End Connection {2 if m.group(2) == '1' else 1}"
        sibling_val = sibling_values.get(sibling_label)
        if sibling_val and sibling_val == val and m.group(2) == "2":
            continue
        if sibling_val and sibling_val == val and m.group(2) == "1":
            out.append(f"{m.group(1)} End Connection{_DESC_SEP}{val}")
            continue
        out.append(line)
    return "\n".join(out)


def collapse_duplicate_fitting_description(desc: str) -> str:
    """When both hose ends use the same fitting, show one fitting block in the PDF."""
    if not desc or "Fitting End" not in desc:
        return _collapse_duplicate_end_connection_lines(desc)

    lines = desc.split("\n")
    end1: dict[str, str] = {}
    end2: dict[str, str] = {}
    kept: list[str] = []

    for line in lines:
        parsed = _parse_desc_line(line)
        if not parsed:
            kept.append(line)
            continue
        label, val = parsed
        if label.startswith("Fitting End 1 "):
            end1[label[len("Fitting End 1 ") :]] = val
            continue
        if label.startswith("Fitting End 2 "):
            end2[label[len("Fitting End 2 ") :]] = val
            continue
        kept.append(line)

    if not end1 or not end2:
        return _collapse_duplicate_end_connection_lines(desc)

    keys = set(end1) | set(end2)
    if any((end1.get(k) or "") != (end2.get(k) or "") for k in keys):
        return _collapse_duplicate_end_connection_lines(desc)

    merged = [f"Fitting{_DESC_SEP}Both ends (same type)"]
    merged.extend(f"Fitting {suffix}{_DESC_SEP}{val}" for suffix, val in end1.items())

    product_idx = next((i for i, line in enumerate(kept) if line.startswith(f"Product{_DESC_SEP}")), -1)
    if product_idx == -1:
        return _collapse_duplicate_end_connection_lines("\n".join([*merged, *kept]))
    return _collapse_duplicate_end_connection_lines(
        "\n".join([*kept[: product_idx + 1], *merged, *kept[product_idx + 1 :]])
    )


def sanitize_quotation_description_for_display(
    desc: object,
    supplier_names: list[str] | None = None,
) -> str:
    """Drop empty spec lines and omit supplier names from quotation descriptions."""
    if not desc:
        return ""
    names = supplier_names or []
    desc_text = collapse_duplicate_fitting_description(str(desc))
    out: list[str] = []
    for line in desc_text.split("\n"):
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
