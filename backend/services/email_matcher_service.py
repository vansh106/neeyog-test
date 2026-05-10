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


# Start of a numbered RFQ line (Item 1:, Line 2:, SR No. 1, …)
_RFQ_ITEM_HEAD = re.compile(
    r"(?im)^[\s·\-\*]*(?:item|line|sr\.?\s*no\.?|s\.?\s*n[o]?\.?)\s*[:\-]?\s*(\d+)\s*[:\.\)\-]",
)


def _split_rfq_item_blocks(raw: str) -> list[str]:
    """Split body into one string per RFQ line when multiple Item N: / Line N: blocks exist."""
    text = (raw or "").strip()
    if not text:
        return []
    matches = list(_RFQ_ITEM_HEAD.finditer(text))
    if len(matches) <= 1:
        return [text]
    blocks: list[str] = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[start:end].strip()
        if chunk:
            blocks.append(chunk)
    return blocks if blocks else [text]


def _extract_quantity_from_segment(segment: str) -> int:
    m = re.search(r"(?i)quantity\s*[:\-]?\s*(\d+)", segment or "")
    if m:
        return max(1, int(m.group(1)))
    m2 = re.search(r"(?i)\bqty\s*[:\-]?\s*(\d+)", segment or "")
    if m2:
        return max(1, int(m2.group(1)))
    return 1


async def _analyze_sheet_shape(
    model: type,
    db: AsyncSession,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[tuple[str, list[str]]]]:
    """Constants, derived OD columns, and multi-value columns (with sample values) for a sheet."""
    constant_columns: list[dict[str, Any]] = []
    derived_columns: list[dict[str, Any]] = []
    multi_cols: list[tuple[str, list[str]]] = []
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
            multi_cols.append((col, tops))
    return constant_columns, derived_columns, multi_cols


async def _match_segment_cascade(
    segment: str,
    full_raw: str,
    steps: list[str],
    model: type | None,
    constant_columns: list[dict[str, Any]],
    derived_columns: list[dict[str, Any]],
    multi_cols: list[tuple[str, list[str]]],
    db: AsyncSession,
) -> tuple[dict[str, str], list[dict[str, Any]], list[str]]:
    """Fill cascade fields for one RFQ line using only that line's text (+ masters)."""
    seg_norm = _norm_text(segment)
    full_norm = _norm_text(full_raw)
    filled: dict[str, str] = {}

    for c in constant_columns:
        filled[str(c["key"])] = str(c.get("value") or "").strip()

    for col, tops in multi_cols:
        if _email_mentions_any(seg_norm, tops):
            best = next((t for t in tops if _norm_text(t) in seg_norm), tops[0])
            filled[col] = best

    ambiguous: list[dict[str, Any]] = []
    if model is not None:
        for amb_col in ("diaphragm", "seat", "ball_disc"):
            if not hasattr(model, amb_col):
                continue
            dc_all = await _distinct_count(db, model, amb_col)
            if dc_all <= 1:
                continue
            tops = await _top_values(db, model, amb_col, limit=10)
            if _email_mentions_any(seg_norm, tops):
                hit = next((t for t in tops if _norm_text(t) in seg_norm), tops[0])
                if hit:
                    filled.setdefault(amb_col, hit)
                continue
            ambiguous.append(
                {
                    "column": amb_col,
                    "options": tops,
                    "distinct_values": dc_all,
                }
            )

    for step in steps:
        if step in filled and str(filled.get(step, "")).strip():
            continue
        if any(c["key"] == step for c in constant_columns):
            filled[step] = next((str(c["value"]) for c in constant_columns if c["key"] == step), "")
            continue
        if any(d["key"] == step for d in derived_columns):
            continue
        if step == "valve_size":
            m = re.search(r"dn\s*(\d+)", segment, re.I)
            if m:
                filled[step] = f"DN {m.group(1)}"
                continue
            m2 = re.search(r"(\d+(?:\.\d+)?)\s*mm\b", segment, re.I)
            if m2:
                filled[step] = f"{m2.group(1)}mm"
                continue
        if step in ("tc_od", "pipe_od"):
            m_od = re.search(r"\btc\s*end\s*(\d+(?:\.\d+)?)\b", segment, re.I)
            if not m_od:
                m_od = re.search(r"\btc\s*(\d+(?:\.\d+)?)\b", segment, re.I)
            if not m_od:
                m_od = re.search(r"\btc\s*(\d+(?:\.\d+)?)\b", full_raw, re.I)
            if m_od:
                filled[step] = m_od.group(1)
                continue
        if model is not None and hasattr(model, step):
            tops = await _top_values(db, model, step, limit=20)
            hit = next((t for t in tops if _norm_text(t) and _norm_text(t) in seg_norm), None)
            if not hit:
                hit = next((t for t in tops if _norm_text(t) and _norm_text(t) in full_norm), None)
            if hit:
                filled[step] = hit

    missing = []
    for step in steps:
        if step in filled and str(filled.get(step, "")).strip():
            continue
        if any(d["key"] == step for d in derived_columns):
            continue
        if any(c["key"] == step for c in constant_columns):
            v = next((str(c["value"]) for c in constant_columns if c["key"] == step), "")
            if v.strip():
                continue
        missing.append(step)

    return filled, ambiguous, missing


async def run_matcher_for_enquiry(enquiry: Enquiry, db: AsyncSession) -> dict[str, Any]:
    raw = (enquiry.raw_input or "").strip()

    catalog_key, product_label = _pick_catalog_key(raw)
    steps = list(CASCADE_STEPS.get(catalog_key, [])) if catalog_key else []

    model = SHEET_MODEL_BY_KEY.get(catalog_key) if catalog_key else None

    segments = _split_rfq_item_blocks(raw)
    if not segments:
        segments = [raw]

    constant_columns: list[dict[str, Any]] = []
    derived_columns: list[dict[str, Any]] = []
    multi_cols: list[tuple[str, list[str]]] = []
    if model is not None:
        constant_columns, derived_columns, multi_cols = await _analyze_sheet_shape(model, db)

    line_items: list[dict[str, Any]] = []
    ambiguous_groups: list[dict[str, Any]] = []
    for i, segment in enumerate(segments):
        fc, amb, miss = await _match_segment_cascade(
            segment,
            raw,
            steps,
            model,
            constant_columns,
            derived_columns,
            multi_cols,
            db,
        )
        qty = _extract_quantity_from_segment(segment)
        idx = i + 1
        for g in amb:
            ambiguous_groups.append({**g, "line_index": idx})
        line_items.append(
            {
                "index": idx,
                "quantity": qty,
                "filled_cascade": fc,
                "ambiguous_groups": amb,
                "missing_cascade_keys": miss,
                "snippet": (segment[:600] + "…") if len(segment) > 600 else segment,
            }
        )

    filled_cascade: dict[str, str] = dict(line_items[0]["filled_cascade"]) if line_items else {}
    missing_cascade_keys: list[str] = sorted(
        {k for li in line_items for k in (li.get("missing_cascade_keys") or [])}
    )
    all_complete = all(
        not (li.get("missing_cascade_keys") or []) and not (li.get("ambiguous_groups") or [])
        for li in line_items
    )
    product_completeness = "complete" if all_complete and not ambiguous_groups else "incomplete"

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

    # Confidence heuristic: average fill ratio across RFQ lines
    total_n = max(len(steps), 1)
    ratios: list[float] = []
    for li in line_items:
        fc_li = li.get("filled_cascade") if isinstance(li.get("filled_cascade"), dict) else {}
        fn = len([k for k in steps if fc_li.get(k) and str(fc_li[k]).strip()])
        ratios.append(fn / total_n)
    avg_fill = sum(ratios) / max(len(ratios), 1) if ratios else 0.0
    conf = 0.45 + 0.45 * avg_fill - (0.12 if ambiguous_groups else 0) - (0.08 if not catalog_key else 0)
    if len(line_items) > 1:
        conf = max(0.15, conf - 0.03)
    conf = max(0.15, min(0.97, conf))

    return {
        "version": 2,
        "product_completeness": product_completeness,
        "confidence": round(conf, 3),
        "catalog_key": catalog_key or None,
        "product_label": product_label or None,
        "rfq_line_count": len(line_items),
        "cascade_steps": [{"key": s, "label": s.replace("_", " ").title()} for s in steps],
        "filled_cascade": filled_cascade,
        "line_items": line_items,
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
    e.confidence_score = float(payload.get("confidence") or 0)
    e.flow_type = "product_complete" if payload.get("product_completeness") == "complete" else "product_incomplete"
    e.status = "matcher_ready"
    fc = payload.get("filled_cascade") or {}
    lix = payload.get("line_items") if isinstance(payload.get("line_items"), list) else []
    nlines = len(lix) if lix else 1
    filled_summary = ", ".join(fc.keys()) if isinstance(fc, dict) and fc else "—"
    e.ai_reasoning = json.dumps(
        [
            f"Catalog: {payload.get('product_label') or '—'}",
            f"RFQ lines detected: {nlines}",
            f"Completeness: {payload.get('product_completeness')}",
            f"Line 1 filled fields: {filled_summary}",
        ],
        ensure_ascii=False,
    )
    pd["products_requested"] = [
        {
            "product_description": f"{payload.get('product_label') or 'Product'} — item {li.get('index', i + 1)}",
            "quantity": li.get("quantity") if isinstance(li.get("quantity"), int) else 1,
        }
        for i, li in enumerate(lix)
    ] if lix else (
        [
            {
                "product_description": str(payload.get("product_label") or "Product"),
                "quantity": 1,
            }
        ]
    )
    e.parsed_data = pd
    await db.commit()
    await db.refresh(e)
    return e
