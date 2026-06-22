"""Masters sidebar-aligned category labels for enquiry / quotation listings."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_LABELS_PATH = Path(__file__).resolve().parent / "masters_listing_labels.json"


@lru_cache(maxsize=1)
def _load_entries() -> list[dict]:
    raw = _LABELS_PATH.read_text(encoding="utf-8")
    data = json.loads(raw)
    return data if isinstance(data, list) else []


def masters_listing_labels(
    catalog_key: str,
    variant_type: str | None = None,
) -> tuple[str, str | None]:
    key = (catalog_key or "").strip()
    if not key:
        return "Others", None

    vt = (variant_type or "").strip() or None
    matches = [e for e in _load_entries() if e.get("key") == key]
    if not matches:
        return key.replace("_", " ").title(), None

    if vt:
        for entry in matches:
            if entry.get("variantType") == vt:
                return entry["category"], entry.get("subCategory")

    entry = matches[0]
    return entry["category"], entry.get("subCategory")


def listing_category_lines_from_lines(lines: list[dict]) -> list[dict[str, str | None]]:
    out: list[dict[str, str | None]] = []
    seen: set[tuple[str, str | None]] = set()
    for li in lines:
        if not isinstance(li, dict):
            continue
        ct = str(li.get("catalog_table") or "").strip()
        if not ct:
            continue
        vt = str(li.get("variant_type") or "").strip() or None
        category, sub_category = masters_listing_labels(ct, vt)
        sig = (category, sub_category)
        if sig in seen:
            continue
        seen.add(sig)
        out.append({"category": category, "sub_category": sub_category})
    return out


def listing_fields_from_lines(lines: list[dict], *, primary_fallback: str = "Others") -> dict:
    category_lines = listing_category_lines_from_lines(lines)
    if category_lines:
        first = category_lines[0]
        return {
            "category_label": first["category"],
            "sub_category": first["sub_category"],
            "category_lines": category_lines,
        }
    return {
        "category_label": primary_fallback,
        "sub_category": None,
        "category_lines": [],
    }
