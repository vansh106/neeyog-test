"""Email enquiry matcher — product sheet detection, column analysis, client match.

Deterministic v1 (DB-backed constants / ambiguity + keyword fills). Optional Gemini
refinement can be layered later without changing the persisted ``matcher`` shape.
"""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect

from core.config import get_settings
from db.models import Enquiry
from services.client_service import get_dummy_clients
from services.email_display_infer import infer_company_from_email_raw
from services.masters_service import CASCADE_STEPS, CATEGORY_LABEL_BY_KEY, SHEET_MODEL_BY_KEY

# Prefer longer / more specific phrases first.
_CATALOG_SCAN_ORDER: list[tuple[str, list[str]]] = [
    ("fp_mascon_manual_butt_weld", ["manual butt weld", "butt weld mascon", "mascon manual butt"]),
    ("fp_mascon_manual_tc_end", ["manual tc end", "mascon manual tc"]),
    ("fp_mascon_pneumatic_tc_end", ["pneumatic tc end", "mascon pneumatic tc"]),
    ("fp_mascon_pneumatic_butt_weld", ["pneumatic butt weld", "mascon pneumatic butt"]),
    ("fp_mascon_zdvm_l_type", ["zdvm l", "mascon zdvm l"]),
    ("fp_mascon_zdvm_j_type", ["zdvm j", "mascon zdvm j"]),
    ("fp_mascon_zdvp_l_type", ["zdvp l", "mascon zdvp l"]),
    ("fp_mascon_zdvp_j_type", ["zdvp j", "mascon zdvp j"]),
    ("fp_mascon_prv", ["mascon prv", " prv "]),
    ("fp_mascon_angle_sc_flanged", ["angle sc flanged", "mascon angle sc"]),
    ("fp_mascon_angle_butt_weld", ["angle butt weld", "mascon angle butt"]),
    ("fp_mascon_angle_tc_end", ["angle tc end", "mascon angle tc"]),
    ("butterfly_valve", ["butterfly"]),
    ("ball_valve", ["ball valve", " ball "]),
]

_SKIP_COLS = frozenset({"id", "sr_no", "source_file", "created_at", "updated_at"})


def _norm_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def _extract_emails(text: str) -> list[str]:
    return list(
        dict.fromkeys(
            re.findall(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text or "", flags=re.I)
        )
    )


def _pick_catalog_key(text: str) -> tuple[str, str]:
    t = _norm_text(text)
    for key, phrases in _CATALOG_SCAN_ORDER:
        if any(p.strip() in t for p in phrases):
            return key, CATEGORY_LABEL_BY_KEY.get(key, key.replace("_", " ").title())
    # Heuristics: emails often omit "Mascon" but describe diaphragm valve + actuation.
    # Infer Mascon pneumatic/manual + TC/butt-weld from common phrasing.
    is_diaphragm = "diaphragm valve" in t or "diaphragm valves" in t or "diaphragm" in t
    is_pneumatic = "pneumatic" in t or "pneumatically" in t or "actuator moc" in t or "actuator" in t
    is_manual = "manual" in t or "handwheel" in t or "wheel" in t
    is_tc = "tc end" in t or " tri clamp" in t or "triclover" in t or re.search(r"\btc\b", t) is not None
    is_butt = "butt weld" in t or "buttweld" in t or "bw end" in t

    if is_diaphragm and (is_pneumatic or is_manual or is_tc or is_butt):
        # Prefer pneumatic when actuator is mentioned.
        if is_pneumatic and is_tc and not is_butt:
            key = "fp_mascon_pneumatic_tc_end"
            return key, CATEGORY_LABEL_BY_KEY.get(key, key.replace("_", " ").title())
        if is_pneumatic and (is_butt or not is_tc):
            key = "fp_mascon_pneumatic_butt_weld"
            return key, CATEGORY_LABEL_BY_KEY.get(key, key.replace("_", " ").title())
        if is_manual and is_tc and not is_butt:
            key = "fp_mascon_manual_tc_end"
            return key, CATEGORY_LABEL_BY_KEY.get(key, key.replace("_", " ").title())
        if is_manual and (is_butt or not is_tc):
            key = "fp_mascon_manual_butt_weld"
            return key, CATEGORY_LABEL_BY_KEY.get(key, key.replace("_", " ").title())
    if "mascon" in t:
        return "fp_mascon_manual_butt_weld", CATEGORY_LABEL_BY_KEY.get(
            "fp_mascon_manual_butt_weld", "Mascon (default sheet)"
        )
    return "", ""


def _model_columns(model: type) -> list[str]:
    return sorted(
        c.key for c in inspect(model).mapper.column_attrs if c.key not in _SKIP_COLS
    )


def _is_od_column(name: str) -> bool:
    n = name.lower()
    return "od" in n or n in ("tc_od", "pipe_od")


async def _distinct_count(db: AsyncSession, model: type, col: str) -> int:
    c = getattr(model, col)
    stmt = select(func.count(func.distinct(c)))
    # Ensure we only consider the active client (otherwise distinct/constant analysis breaks).
    if hasattr(model, "client_id"):
        client_id = get_settings().ACTIVE_CLIENT
        stmt = stmt.select_from(model).where(getattr(model, "client_id") == client_id)
    r = await db.execute(stmt)
    return int(r.scalar() or 0)


async def _top_values(db: AsyncSession, model: type, col: str, limit: int = 12) -> list[str]:
    c = getattr(model, col)
    stmt = select(c).where(c.isnot(None))
    if hasattr(model, "client_id"):
        client_id = get_settings().ACTIVE_CLIENT
        stmt = stmt.where(getattr(model, "client_id") == client_id)
    r = await db.execute(stmt.distinct().limit(limit))
    return [str(x[0]).strip() for x in r.fetchall() if x[0] is not None and str(x[0]).strip()]


def _email_mentions_any(norm_email: str, values: list[str]) -> bool:
    for v in values:
        vn = _norm_text(v)
        if len(vn) < 3:
            continue
        if vn in norm_email:
            return True
    return False


async def run_matcher_for_enquiry(enquiry: Enquiry, db: AsyncSession) -> dict[str, Any]:
    raw = (enquiry.raw_input or "").strip()
    norm = _norm_text(raw)

    catalog_key, product_label = _pick_catalog_key(raw)
    steps = list(CASCADE_STEPS.get(catalog_key, [])) if catalog_key else []

    model = SHEET_MODEL_BY_KEY.get(catalog_key) if catalog_key else None

    constant_columns: list[dict[str, Any]] = []
    derived_columns: list[dict[str, Any]] = []
    ambiguous_groups: list[dict[str, Any]] = []
    filled_cascade: dict[str, str] = {}
    missing_cascade_keys: list[str] = []

    if model is not None:
        cols = _model_columns(model)
        for col in cols:
            if _is_od_column(col):
                derived_columns.append(
                    {
                        "key": col,
                        "derived_from": "valve_size",
                        "note": "OD follows valve size in masters — not matched from email text.",
                    }
                )
                continue
            dc = await _distinct_count(db, model, col)
            if dc <= 1:
                r0 = await db.execute(select(getattr(model, col)).where(getattr(model, col).isnot(None)).limit(1))
                row = r0.first()
                val = str(row[0]).strip() if row and row[0] is not None else ""
                constant_columns.append({"key": col, "value": val, "distinct_count": dc})
            else:
                tops = await _top_values(db, model, col, limit=15)
                if _email_mentions_any(norm, tops):
                    best = next((t for t in tops if _norm_text(t) in norm), tops[0])
                    filled_cascade[col] = best

        for amb_col in ("diaphragm", "seat", "ball_disc"):
            if not hasattr(model, amb_col):
                continue
            dc_all = await _distinct_count(db, model, amb_col)
            if dc_all <= 1:
                continue
            tops = await _top_values(db, model, amb_col, limit=10)
            if _email_mentions_any(norm, tops):
                hit = next((t for t in tops if _norm_text(t) in norm), tops[0])
                filled_cascade.setdefault(amb_col, hit)
                continue
            ambiguous_groups.append(
                {
                    "column": amb_col,
                    "options": tops,
                    "distinct_values": dc_all,
                }
            )

    # Heuristic fills from email for cascade steps not yet filled
    for step in steps:
        if step in filled_cascade:
            continue
        if any(c["key"] == step for c in constant_columns):
            filled_cascade[step] = next(c["value"] for c in constant_columns if c["key"] == step)
            continue
        if any(d["key"] == step for d in derived_columns):
            continue
        # DN / size
        if step == "valve_size":
            m = re.search(r"dn\s*(\d+)", raw, re.I)
            if m:
                filled_cascade[step] = f"DN {m.group(1)}"
                continue
            m2 = re.search(r"(\d+(?:\.\d+)?)\s*mm\b", raw, re.I)
            if m2:
                filled_cascade[step] = f"{m2.group(1)}mm"
                continue
        # OD hints (TC end 25 / TC 25 etc). Even if OD is derivable, capturing it improves sheet inference.
        if step in ("tc_od", "pipe_od"):
            m_od = re.search(r"\btc\s*end\s*(\d+(?:\.\d+)?)\b", raw, re.I)
            if not m_od:
                m_od = re.search(r"\btc\s*(\d+(?:\.\d+)?)\b", raw, re.I)
            if m_od:
                filled_cascade[step] = m_od.group(1)
                continue
        if model is not None and hasattr(model, step):
            tops = await _top_values(db, model, step, limit=20)
            hit = next((t for t in tops if _norm_text(t) and _norm_text(t) in norm), None)
            if hit:
                filled_cascade[step] = hit

    for step in steps:
        if step not in filled_cascade and not any(d["key"] == step for d in derived_columns):
            if not any(c["key"] == step for c in constant_columns):
                missing_cascade_keys.append(step)

    product_completeness = "complete" if not ambiguous_groups and not missing_cascade_keys else "incomplete"

    # Client resolution (dummy DB)
    emails = _extract_emails(raw)
    footer_company = infer_company_from_email_raw(raw) or ""
    clients = get_dummy_clients()
    matched: dict[str, Any] | None = None
    suggested_new: dict[str, Any] = {
        "company_name": footer_company or "New client",
        "branch_name": "Head Office",
        "contact_name": "Procurement",
        "phone": "",
        "email": emails[0] if emails else "",
        "city": "",
        "state": "",
        "pincode": "",
        "address_line1": "",
        "country": "India",
    }
    for em in emails:
        el = em.lower()
        for br in clients:
            bid = str(br.get("id") or "")
            er = str(br.get("email") or "").lower()
            if er and er == el:
                matched = {
                    "mode": "existing",
                    "selected_client_id": bid,
                    "label": br.get("company_name") or br.get("contact_name") or bid,
                }
                break
        if matched:
            break
    if not matched and footer_company:
        for br in clients:
            cn = str(br.get("company_name") or "").lower()
            if cn and cn in footer_company.lower():
                matched = {
                    "mode": "existing",
                    "selected_client_id": str(br.get("id")),
                    "label": br.get("company_name"),
                }
                break

    client_block = matched or {"mode": "suggested_new", "suggested_new_client": suggested_new}

    # Confidence heuristic
    filled_n = len([k for k in steps if k in filled_cascade])
    total_n = max(len(steps), 1)
    conf = 0.45 + 0.45 * (filled_n / total_n) - (0.12 if ambiguous_groups else 0) - (0.08 if not catalog_key else 0)
    conf = max(0.15, min(0.97, conf))

    return {
        "version": 1,
        "product_completeness": product_completeness,
        "confidence": round(conf, 3),
        "catalog_key": catalog_key or None,
        "product_label": product_label or None,
        "cascade_steps": [{"key": s, "label": s.replace("_", " ").title()} for s in steps],
        "filled_cascade": filled_cascade,
        "missing_cascade_keys": missing_cascade_keys,
        "constant_columns": constant_columns,
        "derived_columns": derived_columns,
        "ambiguous_groups": ambiguous_groups,
        "client": client_block,
        "notes": "Matcher v1 uses masters distinct-value rules; refine with Gemini later if needed.",
    }


async def persist_matcher_on_enquiry(enquiry_id: str, db: AsyncSession) -> Enquiry:
    from services.enquiry_service import get_enquiry

    e = await get_enquiry(enquiry_id, db)
    payload = await run_matcher_for_enquiry(e, db)
    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    pd = {**pd, "matcher": payload}
    c = payload.get("client")
    if isinstance(c, dict):
        if c.get("mode") == "existing":
            lbl = str(c.get("label") or "").strip()
            if lbl:
                pd["client_company"] = lbl
        elif c.get("mode") == "suggested_new" and isinstance(c.get("suggested_new_client"), dict):
            nc = c["suggested_new_client"]
            pd["client_name"] = nc.get("contact_name") or pd.get("client_name") or "Contact"
            pd["client_email"] = nc.get("email") or pd.get("client_email")
            pd["client_phone"] = nc.get("phone") or pd.get("client_phone")
            pd["client_company"] = str(nc.get("company_name") or pd.get("client_company") or "Unknown").strip()
    if not str(pd.get("client_company") or "").strip():
        pd["client_company"] = infer_company_from_email_raw(e.raw_input or "") or "Unknown"
    e.parsed_data = pd
    e.confidence_score = float(payload.get("confidence") or 0)
    e.flow_type = "product_complete" if payload.get("product_completeness") == "complete" else "product_incomplete"
    e.status = "matcher_ready"
    fc = payload.get("filled_cascade") or {}
    filled_summary = ", ".join(fc.keys()) if isinstance(fc, dict) and fc else "—"
    e.ai_reasoning = json.dumps(
        [
            f"Catalog: {payload.get('product_label') or '—'}",
            f"Completeness: {payload.get('product_completeness')}",
            f"Filled fields: {filled_summary}",
        ],
        ensure_ascii=False,
    )
    await db.commit()
    await db.refresh(e)
    return e
