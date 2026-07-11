"""Deterministic catalog matching helpers for packaging masters."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.final_product_models import CatalogFpAluminiumFoilRow, CatalogFpPaperProductsRow

VARIANT_NAV_SLUG: dict[str, str] = {
    # Aluminium Foil
    "Foil Wrap": "foil-wrap",
    "Foil Box": "foil-box",
    "Foil Container": "foil-container",
    "Premium Foil Container": "premium-foil-container",
    "Foil Paper Lids": "foil-paper-lids",
    "Exclusive Foil Container": "exclusive-foil-container",
    "Pet Lid": "pet-lid",
    # Paper Products
    "Eco Paper Cups": "eco-paper-cups",
    "Clarro Paper Cups Tall": "clarro-cups-tall",
    "Clarro Paper Cups": "clarro-cups",
    "Clarro Paper Wati": "clarro-wati",
    "Dolphin Paper Cups": "dolphin-cups",
    "Export Paper Cups": "export-cups",
    "Ripple Cups Brown": "ripple-brown",
    "Ripple Cups Black": "ripple-black",
    "CP Double Wall Cups": "cp-double-wall",
    "SI Double Wall Cups": "si-double-wall",
    "HIPS Lids": "hips-lids",
    "Paper Lids": "paper-lids",
    "Bagasse Lids": "bagasse-lids",
    "Paper Container Kraft": "container-kraft",
    "PW Salad Kraft Bowl": "salad-kraft",
    "PW Salad White Bowl": "salad-white",
    "Paper Salad SFP Bowl": "salad-sfp",
    "Paper Container White": "container-white",
    "Paper Container 110Dia": "container-110dia",
    "Biodegradable Super Paper": "bio-super",
    "Paper Plates": "paper-plates",
}

CATALOG_MODELS: dict[str, type] = {
    "fp_aluminium_foil": CatalogFpAluminiumFoilRow,
    "fp_paper_products": CatalogFpPaperProductsRow,
}

FOIL_CASCADE = ("size_value", "size_unit", "weight_grade", "product_name", "dimensions")
PAPER_CASCADE = ("size_value", "gsm", "diameter_top", "product_name")


def _norm(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9.]+", _norm(text)) if len(t) >= 2}


def infer_catalog_key(variant_type: str | None, description: str, keywords: list[str]) -> str | None:
    vt = (variant_type or "").strip()
    if vt in VARIANT_NAV_SLUG:
        if vt.startswith("Foil") or vt in ("Pet Lid", "Premium Foil Container", "Exclusive Foil Container"):
            return "fp_aluminium_foil"
        return "fp_paper_products"
    blob = " ".join([description, *keywords]).lower()
    foil_hits = ("foil", "aluminium", "aluminum", "pet lid")
    paper_hits = (
        "paper",
        "cup",
        "cups",
        "plate",
        "plates",
        "lid",
        "lids",
        "container",
        "bowl",
        "ripple",
        "clarro",
        "dolphin",
        "bagasse",
        "bio",
        "wati",
    )
    if any(h in blob for h in foil_hits) and "paper cup" not in blob:
        return "fp_aluminium_foil"
    if any(h in blob for h in paper_hits):
        return "fp_paper_products"
    return None


def infer_variant_type(catalog_key: str | None, description: str, keywords: list[str]) -> str | None:
    blob = _norm(" ".join([description, *keywords]))
    candidates = list(VARIANT_NAV_SLUG.keys())
    foil_variants = {
        "Foil Wrap",
        "Foil Box",
        "Foil Container",
        "Premium Foil Container",
        "Foil Paper Lids",
        "Exclusive Foil Container",
        "Pet Lid",
    }
    if catalog_key == "fp_aluminium_foil":
        candidates = [vt for vt in candidates if vt in foil_variants]
    elif catalog_key == "fp_paper_products":
        candidates = [vt for vt in candidates if vt not in foil_variants]

    # Prefer longer / more specific labels first
    for vt in sorted(candidates, key=lambda x: len(x), reverse=True):
        if _norm(vt) in blob:
            return vt
        # token overlap for short aliases
        vt_tokens = _tokens(vt)
        if vt_tokens and vt_tokens.issubset(_tokens(blob)):
            return vt

    # Heuristic aliases
    aliases: list[tuple[str, str]] = [
        ("foil wrap", "Foil Wrap"),
        ("foil box", "Foil Box"),
        ("premium foil", "Premium Foil Container"),
        ("exclusive foil", "Exclusive Foil Container"),
        ("foil container", "Foil Container"),
        ("foil paper lid", "Foil Paper Lids"),
        ("pet lid", "Pet Lid"),
        ("eco paper cup", "Eco Paper Cups"),
        ("clarro tall", "Clarro Paper Cups Tall"),
        ("clarro wati", "Clarro Paper Wati"),
        ("clarro", "Clarro Paper Cups"),
        ("dolphin", "Dolphin Paper Cups"),
        ("export cup", "Export Paper Cups"),
        ("ripple brown", "Ripple Cups Brown"),
        ("ripple black", "Ripple Cups Black"),
        ("double wall", "SI Double Wall Cups"),
        ("hips lid", "HIPS Lids"),
        ("bagasse lid", "Bagasse Lids"),
        ("paper lid", "Paper Lids"),
        ("salad kraft", "PW Salad Kraft Bowl"),
        ("salad white", "PW Salad White Bowl"),
        ("salad sfp", "Paper Salad SFP Bowl"),
        ("container kraft", "Paper Container Kraft"),
        ("container white", "Paper Container White"),
        ("110dia", "Paper Container 110Dia"),
        ("biodegradable", "Biodegradable Super Paper"),
        ("bio plate", "Biodegradable Super Paper"),
        ("paper plate", "Paper Plates"),
    ]
    for needle, vt in aliases:
        if needle in blob and vt in candidates:
            return vt
    return None


def score_row(row: Any, *, size_hint: str | None, keywords: list[str], description: str) -> float:
    name = _norm(getattr(row, "product_name", None))
    size = _norm(getattr(row, "size_value", None))
    dims = _norm(getattr(row, "dimensions", None))
    gsm = _norm(getattr(row, "gsm", None))
    hay = f"{name} {size} {dims} {gsm}"
    score = 0.0
    hint = _norm(size_hint)
    if hint and hint in hay:
        score += 0.45
    elif hint:
        # partial numeric overlap e.g. 100ML vs 100
        nums = re.findall(r"\d+(?:\.\d+)?", hint)
        for n in nums:
            if n and n in hay:
                score += 0.2
                break
    for kw in keywords:
        k = _norm(kw)
        if len(k) >= 2 and k in hay:
            score += 0.08
    for t in _tokens(description):
        if len(t) >= 3 and t in hay:
            score += 0.04
    return min(score, 1.0)


def cascade_from_row(catalog_key: str, row: Any, variant_type: str | None) -> dict[str, str]:
    keys = FOIL_CASCADE if catalog_key == "fp_aluminium_foil" else PAPER_CASCADE
    out: dict[str, str] = {}
    vt = (variant_type or getattr(row, "variant_type", None) or "").strip()
    if vt:
        out["variant_type"] = vt
    for k in keys:
        v = getattr(row, k, None)
        if v is not None and str(v).strip():
            out[k] = str(v).strip()
    return out


async def find_best_row(
    db: AsyncSession,
    *,
    client_id: str,
    catalog_key: str,
    variant_type: str | None,
    size_hint: str | None,
    keywords: list[str],
    description: str,
) -> tuple[Any | None, float]:
    model = CATALOG_MODELS.get(catalog_key)
    if model is None:
        return None, 0.0

    q = select(model).where(model.client_id == client_id)
    if variant_type:
        q = q.where(model.variant_type == variant_type)

    # Narrow by size / keyword when possible
    clauses = []
    hint = (size_hint or "").strip()
    if hint:
        clauses.append(model.product_name.ilike(f"%{hint}%"))
        if hasattr(model, "size_value"):
            clauses.append(model.size_value.ilike(f"%{hint}%"))
    for kw in keywords[:6]:
        k = (kw or "").strip()
        if len(k) >= 3:
            clauses.append(model.product_name.ilike(f"%{k}%"))
    if clauses:
        q = q.where(or_(*clauses))

    q = q.limit(80)
    rows = (await db.execute(q)).scalars().all()
    if not rows and variant_type:
        # fallback: all rows in variant
        rows = (
            await db.execute(
                select(model)
                .where(model.client_id == client_id, model.variant_type == variant_type)
                .limit(80)
            )
        ).scalars().all()
    if not rows:
        return None, 0.0

    best = None
    best_score = -1.0
    for row in rows:
        s = score_row(row, size_hint=size_hint, keywords=keywords, description=description)
        if s > best_score:
            best_score = s
            best = row
    return best, max(best_score, 0.0)
