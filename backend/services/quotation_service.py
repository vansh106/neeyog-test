"""Quotation business logic — retrieval, PDF lookup, listing.

Pure service — no FastAPI imports, no HTTPException.
Raises only from core.exceptions.
"""

import copy
import json
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from core.config import get_settings
from core.exceptions import ProductNotFoundError, QuotationBuildError
from db.models import AuditLog, ClientCompany, PurchaseOrder, Quotation, QuotationProductHistory
from services.masters_service import _category_label
from services import enquiry_service as enquiry_svc
from services.pdf_service import generate_quotation_pdf
from services.quotation_description_sanitize import (
    sanitize_quotation_description_for_display,
    strip_supplier_names_from_text,
    supplier_names_for_client,
)
from services.quotation_audit_diff import (
    build_financial_change_view,
    build_line_items_change_view,
    build_pdf_change_view,
    financial_rows_from_quotation,
)

QUOTATION_CRM_STATUSES: frozenset[str] = frozenset({"po_received", "lost", "ongoing"})
LINE_CRM_STATUS_ORDER: tuple[str, ...] = ("ongoing", "po_received", "lost")
LOCKED_LINE_CRM_STATUSES: frozenset[str] = frozenset({"po_received", "lost"})


def _normalize_line_crm_status(raw: object, *, fallback: str = "ongoing") -> str:
    st = str(raw or fallback).strip().lower()
    if st == "hold":
        st = "ongoing"
    if st in QUOTATION_CRM_STATUSES:
        return st
    return fallback if fallback in QUOTATION_CRM_STATUSES else "ongoing"


def is_line_crm_status_locked(raw: object, *, fallback: str = "ongoing") -> bool:
    """PO received and Lost line statuses cannot be changed."""
    return _normalize_line_crm_status(raw, fallback=fallback) in LOCKED_LINE_CRM_STATUSES


def _line_quantity(li: dict) -> int:
    try:
        qty = int(float(li.get("quantity") or 1))
    except (TypeError, ValueError):
        qty = 1
    return max(1, qty)


def _line_total_amount(li: dict) -> float:
    if li.get("line_total") is not None:
        try:
            return round(float(li["line_total"]), 2)
        except (TypeError, ValueError):
            pass
    unit = float(li.get("unit_price") or 0.0)
    return round(unit * _line_quantity(li), 2)


def derive_quotation_status_from_lines(lines: list) -> str:
    statuses: list[str] = []
    for li in lines:
        if not isinstance(li, dict):
            continue
        statuses.append(_normalize_line_crm_status(li.get("crm_status")))
    if not statuses:
        return "ongoing"
    if all(s == "po_received" for s in statuses):
        return "po_received"
    if all(s == "lost" for s in statuses):
        return "lost"
    if any(s == "ongoing" for s in statuses):
        return "ongoing"
    if any(s == "po_received" for s in statuses):
        return "po_received"
    return "ongoing"


def build_line_status_summaries(
    lines: list,
    *,
    fallback_status: str = "ongoing",
) -> dict[str, dict]:
    """Per-CRM-status counts and product labels for quotation list UI."""
    valid_lines = [li for li in lines if isinstance(li, dict)]
    total = len(valid_lines)
    fallback = _normalize_line_crm_status(fallback_status)
    buckets: dict[str, list[dict]] = {st: [] for st in LINE_CRM_STATUS_ORDER}

    for idx, li in enumerate(valid_lines):
        st = _normalize_line_crm_status(li.get("crm_status"), fallback=fallback)
        remarks = li.get("crm_status_remarks")
        if st == "lost":
            remarks = str(remarks or "").strip() or None
        else:
            remarks = None
        buckets[st].append(
            {
                "line_index": idx,
                "label": _short_label(li),
                "quantity": _line_quantity(li),
                "line_total": _line_total_amount(li),
                "status_remarks": remarks,
            }
        )

    return {
        st: {
            "count": len(buckets[st]),
            "total_lines": total,
            "products": buckets[st],
        }
        for st in LINE_CRM_STATUS_ORDER
    }


def quotation_has_line_status(lines: list, status: str, *, fallback_status: str = "ongoing") -> bool:
    target = _normalize_line_crm_status(status)
    fallback = _normalize_line_crm_status(fallback_status)
    for li in lines:
        if not isinstance(li, dict):
            continue
        if _normalize_line_crm_status(li.get("crm_status"), fallback=fallback) == target:
            return True
    return False


def _primary_category_from_lines(lines: list[dict]) -> str:
    counts: dict[str, int] = {}
    for li in lines:
        if not isinstance(li, dict):
            continue
        cat = str(li.get("category") or "").strip().lower()
        if "hose" in cat:
            label = "Hoses"
        elif "damper" in cat:
            label = "Dampers"
        elif cat and cat not in ("other", "others", ""):
            label = "Valves"
        else:
            label = "Others"
        counts[label] = counts.get(label, 0) + 1
    if not counts:
        return "Others"
    return max(counts, key=lambda k: counts[k])


def _product_title_from_desc_text(name: str, supplier_names: list[str] | None = None) -> str:
    if "\n" in name:
        first = name.split("\n")[0].strip()
        if first.lower().startswith("product :"):
            name = first.split(":", 1)[1].strip()
        else:
            name = first
    if supplier_names:
        return strip_supplier_names_from_text(name, supplier_names)
    return name


def _short_label(line: dict, supplier_names: list[str] | None = None) -> str:
    raw = str(line.get("product_name") or line.get("description") or "").strip()
    name = _product_title_from_desc_text(raw, supplier_names)
    size = str(line.get("size") or "").strip()
    if len(name) > 36:
        name = name[:33] + "..."
    if size:
        return f"{name} {size}".strip()
    return name or "Item"


def _listing_row_short_label(
    line: dict,
    *,
    max_name: int = 52,
    supplier_names: list[str] | None = None,
) -> str:
    """Single-line label for enquiry/quote listing rows (one row per product)."""
    raw = str(line.get("product_name") or line.get("description") or "").strip()
    name = _product_title_from_desc_text(raw, supplier_names)
    size = str(line.get("size") or "").strip()
    if len(name) > max_name:
        name = name[: max_name - 3] + "..."
    if size:
        return f"{name} {size}".strip()
    return name or "Item"


def _full_line_description(line: dict, supplier_names: list[str] | None = None) -> str:
    desc = str(line.get("product_name") or line.get("description") or "").strip()
    if supplier_names:
        desc = sanitize_quotation_description_for_display(desc, supplier_names)
    if not desc:
        return "—"
    size = str(line.get("size") or "").strip()
    qty = line.get("quantity")
    unit = str(line.get("unit") or "Nos").strip()
    extras: list[str] = []
    if size:
        extras.append(f"Size: {size}")
    try:
        if qty is not None and float(qty) > 0:
            extras.append(f"Qty: {int(float(qty))} {unit}")
    except (TypeError, ValueError):
        pass
    if extras:
        return f"{desc}\n\n" + "\n".join(extras)
    return desc


def item_desc_lines_from_lines(lines: list[dict], supplier_names: list[str] | None = None) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for li in lines:
        if not isinstance(li, dict):
            continue
        short = _listing_row_short_label(li, supplier_names=supplier_names)
        full = _full_line_description(li, supplier_names=supplier_names)
        if short == "Item" and full == "—":
            continue
        out.append({"short": short, "full": full})
    return out


def _item_desc_short_from_lines(lines: list[dict], supplier_names: list[str] | None = None) -> str:
    bits = [_short_label(li, supplier_names) for li in lines[:3] if isinstance(li, dict)]
    bits = [b for b in bits if b and b != "Item"]
    if not bits:
        return "—"
    out = " · ".join(bits)
    if len(lines) > 3:
        out += " …"
    return out[:250]


def item_desc_short_from_lines(lines: list[dict], supplier_names: list[str] | None = None) -> str:
    """Public helper for enquiry / PO style listing snippets."""
    return _item_desc_short_from_lines(lines, supplier_names)


def listing_fields_from_quotation(q: Quotation, *, supplier_names: list[str] | None = None) -> dict:
    from masters.listing_category import listing_fields_from_lines

    lines = q.line_items if isinstance(q.line_items, list) else []
    primary = _primary_category_from_lines(lines)
    masters = listing_fields_from_lines(lines, primary_fallback=primary)
    return {
        "primary_category": primary,
        "category_label": masters["category_label"],
        "sub_category": masters["sub_category"],
        "category_lines": masters["category_lines"],
        "item_desc_short": _item_desc_short_from_lines(lines, supplier_names),
        "item_desc_lines": item_desc_lines_from_lines(lines, supplier_names),
    }


def default_validity_date(created_at: datetime | None, validity_days: int) -> date | None:
    if created_at is None:
        return None
    base = created_at.date() if hasattr(created_at, "date") else None
    if base is None:
        return None
    return base + timedelta(days=max(0, int(validity_days or 0)))


async def po_totals_by_quotation_ids(
    db: AsyncSession,
    quotation_ids: list[uuid.UUID],
) -> dict[str, float]:
    if not quotation_ids:
        return {}
    stmt = (
        select(PurchaseOrder.quotation_id, func.coalesce(func.sum(PurchaseOrder.total_amount), 0.0))
        .where(PurchaseOrder.quotation_id.in_(quotation_ids))
        .group_by(PurchaseOrder.quotation_id)
    )
    result = await db.execute(stmt)
    out: dict[str, float] = {}
    for qid, total in result.all():
        if qid is not None:
            out[str(qid)] = round(float(total or 0), 2)
    return out


def _trim_str(s: object, max_len: int) -> str:
    t = str(s) if s is not None else ""
    return t[:max_len]


def _trim_kv_rows(rows: object, *, max_items: int, max_label: int, max_value: int) -> list | None:
    if not isinstance(rows, list):
        return None
    out: list = []
    for row in rows[:max_items]:
        if not isinstance(row, dict):
            continue
        lab = _trim_str(row.get("label"), max_label)
        val = _trim_str(row.get("value"), max_value)
        if lab or val:
            out.append({"label": lab, "value": val})
    return out or None


def _trim_pdf_display_overrides(overrides: dict | None, line_count: int) -> dict | None:
    if overrides is None:
        return None
    if not isinstance(overrides, dict):
        return None
    out = dict(overrides)
    lines = out.get("lines")
    if isinstance(lines, list):
        out["lines"] = lines[: max(0, line_count)]
    for key in ("header_left", "header_right", "company_left_extra"):
        trimmed = _trim_kv_rows(out.get(key), max_items=24, max_label=200, max_value=2000)
        if trimmed is None:
            out.pop(key, None)
        else:
            out[key] = trimmed
    for sk in ("thank_you_row", "company_right_text", "footer_contact", "footer_thanks", "footer_disclaimer"):
        if sk in out and out[sk] is not None:
            out[sk] = _trim_str(out[sk], 4000)
    ti = out.get("terms_items")
    if isinstance(ti, list):
        out["terms_items"] = [_trim_str(x, 1500) for x in ti[:30] if str(x).strip()]
        if not out["terms_items"]:
            out.pop("terms_items", None)
    vs = out.get("valuation_supplement_rows")
    if isinstance(vs, list):
        rows_o = []
        for row in vs[:20]:
            if not isinstance(row, dict):
                continue
            rows_o.append(
                {
                    "sr": _trim_str(row.get("sr"), 40),
                    "description": _trim_str(row.get("description"), 2500),
                    "size": _trim_str(row.get("size"), 500),
                    "qty": _trim_str(row.get("qty"), 80),
                    "rate": _trim_str(row.get("rate"), 80),
                    "disc": _trim_str(row.get("disc"), 80),
                    "total": _trim_str(row.get("total"), 80),
                }
            )
        if rows_o:
            out["valuation_supplement_rows"] = rows_o
        else:
            out.pop("valuation_supplement_rows", None)
    if "notes" in out and out["notes"] is not None:
        out["notes"] = _trim_str(out["notes"], 20000)
    fc = out.get("financial_config")
    if isinstance(fc, dict):
        out["financial_config"] = fc
    if not out:
        return None
    return out


def _parse_bool(v: object, default: bool = False) -> bool:
    if isinstance(v, bool):
        return v
    if v is None:
        return default
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "on"):
        return True
    if s in ("0", "false", "no", "off"):
        return False
    return default


def _parse_charge_mode(v: object) -> str:
    s = str(v or "percent").strip().lower()
    return "amount" if s == "amount" else "percent"


def _resolve_charge_amount(
    base: float,
    *,
    applicable: bool,
    mode: str,
    draft: str | None,
    default_percent: float | None = None,
) -> tuple[float, float | None]:
    if not applicable or base <= 0:
        return 0.0, None
    raw = str(draft or "").strip().replace(",", "")
    if not raw:
        if default_percent is not None and mode == "percent":
            return round(base * (default_percent / 100.0), 2), default_percent
        return 0.0, None
    try:
        n = float(raw)
    except (TypeError, ValueError):
        if default_percent is not None and mode == "percent":
            return round(base * (default_percent / 100.0), 2), default_percent
        return 0.0, None
    if n < 0:
        return 0.0, None
    if mode == "percent":
        return round(base * (n / 100.0), 2), n
    return round(n, 2), None


def compute_financial_summary_from_config(
    item_total: float,
    body: dict,
) -> dict:
    """Compute quotation totals from item total and charge toggles/drafts."""
    item_total = round(float(item_total or 0), 2)
    pf_applicable = _parse_bool(body.get("pf_applicable", body.get("pfApplicable")), True)
    pf_mode = _parse_charge_mode(body.get("pf_mode", body.get("pfMode")))
    pf_draft = body.get("pf_draft", body.get("pfDraft"))
    pf_amount, pf_rate = _resolve_charge_amount(
        item_total,
        applicable=pf_applicable,
        mode=pf_mode,
        draft=str(pf_draft) if pf_draft is not None else None,
        default_percent=3.0 if pf_mode == "percent" else None,
    )

    freight_applicable = _parse_bool(body.get("freight_applicable", body.get("freightApplicable")), True)
    freight_mode = _parse_charge_mode(body.get("freight_mode", body.get("freightMode")))
    freight_draft = body.get("freight_draft", body.get("freightDraft"))
    freight_amount, freight_rate = _resolve_charge_amount(
        item_total,
        applicable=freight_applicable,
        mode=freight_mode,
        draft=str(freight_draft) if freight_draft is not None else None,
        default_percent=None,
    )

    taxable = round(
        item_total
        + (pf_amount if pf_applicable else 0.0)
        + (freight_amount if freight_applicable else 0.0),
        2,
    )

    cgst_applicable = _parse_bool(body.get("cgst_applicable", body.get("cgstApplicable")), True)
    cgst_mode = _parse_charge_mode(body.get("cgst_mode", body.get("cgstMode")))
    cgst_draft = body.get("cgst_draft", body.get("cgstDraft"))
    cgst_amount, cgst_rate = _resolve_charge_amount(
        taxable,
        applicable=cgst_applicable,
        mode=cgst_mode,
        draft=str(cgst_draft) if cgst_draft is not None else None,
        default_percent=9.0 if cgst_mode == "percent" else None,
    )

    sgst_applicable = _parse_bool(body.get("sgst_applicable", body.get("sgstApplicable")), True)
    sgst_mode = _parse_charge_mode(body.get("sgst_mode", body.get("sgstMode")))
    sgst_draft = body.get("sgst_draft", body.get("sgstDraft"))
    sgst_amount, sgst_rate = _resolve_charge_amount(
        taxable,
        applicable=sgst_applicable,
        mode=sgst_mode,
        draft=str(sgst_draft) if sgst_draft is not None else None,
        default_percent=9.0 if sgst_mode == "percent" else None,
    )

    igst_applicable = _parse_bool(body.get("igst_applicable", body.get("igstApplicable")), False)
    igst_mode = _parse_charge_mode(body.get("igst_mode", body.get("igstMode")))
    igst_draft = body.get("igst_draft", body.get("igstDraft"))
    igst_amount, igst_rate = _resolve_charge_amount(
        taxable,
        applicable=igst_applicable,
        mode=igst_mode,
        draft=str(igst_draft) if igst_draft is not None else None,
        default_percent=18.0 if igst_mode == "percent" else None,
    )

    gst_amount = round(cgst_amount + sgst_amount + igst_amount, 2)
    total_amount = round(taxable + gst_amount, 2)

    return {
        "item_total": item_total,
        "taxable_subtotal": taxable,
        "pf_applicable": pf_applicable,
        "pf_mode": pf_mode,
        "pf_draft": str(pf_draft or "").strip(),
        "pf_amount": pf_amount,
        "pf_rate": pf_rate if pf_rate is not None else (3.0 if pf_applicable and pf_mode == "percent" else None),
        "freight_applicable": freight_applicable,
        "freight_mode": freight_mode,
        "freight_draft": str(freight_draft or "").strip(),
        "freight_amount": freight_amount,
        "freight_rate": freight_rate,
        "cgst_applicable": cgst_applicable,
        "cgst_mode": cgst_mode,
        "cgst_draft": str(cgst_draft or "").strip(),
        "cgst_amount": cgst_amount,
        "cgst_rate": cgst_rate,
        "sgst_applicable": sgst_applicable,
        "sgst_mode": sgst_mode,
        "sgst_draft": str(sgst_draft or "").strip(),
        "sgst_amount": sgst_amount,
        "sgst_rate": sgst_rate,
        "igst_applicable": igst_applicable,
        "igst_mode": igst_mode,
        "igst_draft": str(igst_draft or "").strip(),
        "igst_amount": igst_amount,
        "igst_rate": igst_rate,
        "gst_amount": gst_amount,
        "total_amount": total_amount,
    }


def _totals_snapshot(q: Quotation, computed: dict | None = None) -> dict:
    comp = computed or {}
    return {
        "subtotal": float(comp.get("item_total", getattr(q, "subtotal", 0) or 0)),
        "pf_amount": float(comp.get("pf_amount", getattr(q, "pf_amount", 0) or 0)),
        "freight_amount": float(comp.get("freight_amount", getattr(q, "freight_amount", 0) or 0)),
        "gst_amount": float(comp.get("gst_amount", getattr(q, "gst_amount", 0) or 0)),
        "total_amount": float(comp.get("total_amount", getattr(q, "total_amount", 0) or 0)),
    }


def _financial_extra(q: Quotation, computed: dict | None = None) -> dict:
    comp = computed or {}
    return {
        "pf_rate": comp.get("pf_rate", getattr(q, "pf_rate", None)),
        "freight_rate": comp.get("freight_rate", getattr(q, "freight_rate", None)),
        "cgst_amount": comp.get("cgst_amount"),
        "sgst_amount": comp.get("sgst_amount"),
        "igst_amount": comp.get("igst_amount"),
    }


async def update_quotation_financial_summary(
    quotation_id: str,
    body: dict,
    db: AsyncSession,
    *,
    performed_by: str = "user",
    performed_by_name: str | None = None,
) -> Quotation:
    q = await get_quotation(quotation_id, db)
    item_total = round(float(q.subtotal or 0), 2)
    before_rows = financial_rows_from_quotation(q)
    before_totals = _totals_snapshot(q)
    before_extra = _financial_extra(q)
    computed = compute_financial_summary_from_config(item_total, body if isinstance(body, dict) else {})

    q.pf_amount = float(computed["pf_amount"])
    if computed.get("pf_rate") is not None:
        q.pf_rate = float(computed["pf_rate"])
    q.freight_amount = float(computed["freight_amount"])
    q.freight_rate = float(computed["freight_rate"]) if computed.get("freight_rate") is not None else None
    q.freight_note = (
        "Extra at actual"
        if not computed["freight_applicable"] or computed["freight_amount"] <= 0
        else ""
    )
    q.gst_amount = float(computed["gst_amount"])
    q.total_amount = float(computed["total_amount"])

    ov = dict(q.pdf_display_overrides) if isinstance(q.pdf_display_overrides, dict) else {}
    ov["financial_config"] = {
        "pf_applicable": computed["pf_applicable"],
        "pf_mode": computed["pf_mode"],
        "pf_draft": computed["pf_draft"],
        "freight_applicable": computed["freight_applicable"],
        "freight_mode": computed["freight_mode"],
        "freight_draft": computed["freight_draft"],
        "cgst_applicable": computed["cgst_applicable"],
        "cgst_mode": computed["cgst_mode"],
        "cgst_draft": computed["cgst_draft"],
        "sgst_applicable": computed["sgst_applicable"],
        "sgst_mode": computed["sgst_mode"],
        "sgst_draft": computed["sgst_draft"],
        "igst_applicable": computed["igst_applicable"],
        "igst_mode": computed["igst_mode"],
        "igst_draft": computed["igst_draft"],
        "cgst_amount": computed["cgst_amount"],
        "sgst_amount": computed["sgst_amount"],
        "igst_amount": computed["igst_amount"],
    }
    line_count = len(q.line_items) if isinstance(q.line_items, list) else 0
    q.pdf_display_overrides = _trim_pdf_display_overrides(ov, line_count)

    pdf_path = await regenerate_quotation_pdf(
        q,
        db=db,
        prepared_by_email=performed_by,
        prepared_by_name=performed_by_name,
    )
    if pdf_path:
        q.pdf_path = pdf_path

    after_rows = financial_rows_from_quotation(q, computed)
    after_totals = _totals_snapshot(q, computed)
    after_extra = _financial_extra(q, computed)
    change_view = build_financial_change_view(before_rows, after_rows)

    db.add(
        AuditLog(
            id=uuid.uuid4(),
            entity_type="quotation",
            entity_id=q.id,
            action="quotation_financial_summary_updated",
            performed_by=performed_by or "user",
            details={
                "performed_by_name": performed_by_name,
                "quotation_id": str(q.id),
                "quote_number": q.quote_number,
                "total_amount": computed["total_amount"],
                "totals_before": before_totals,
                "totals_after": after_totals,
                "financial_before": before_extra,
                "financial_after": after_extra,
                "change_view": change_view,
            },
        )
    )
    await db.commit()
    await db.refresh(q)
    return q


def _preparer_from_quotation(q: Quotation) -> tuple[str | None, str | None, str | None]:
    name = (getattr(q, "created_by_name", None) or "").strip()
    email = ""
    phone = (getattr(q, "created_by_phone", None) or "").strip()
    creator = getattr(q, "created_by_user", None)
    if creator is not None:
        if not name and getattr(creator, "full_name", None):
            name = str(creator.full_name).strip()
        if getattr(creator, "email", None):
            email = str(creator.email).strip()
        if not phone and getattr(creator, "phone", None):
            phone = str(creator.phone).strip()
    return name or None, email or None, phone or None


def _quotation_payload_for_pdf(
    q: Quotation,
    *,
    prepared_by_email: str | None = None,
    prepared_by_name: str | None = None,
    prepared_by_phone: str | None = None,
) -> dict:
    li = q.line_items if isinstance(q.line_items, list) else []
    ov = q.pdf_display_overrides if isinstance(q.pdf_display_overrides, dict) else {}
    out: dict = {
        "quote_number": q.quote_number,
        "client_name": q.client_name,
        "client_company": q.client_company,
        "client_email": q.client_email,
        "client_phone": q.client_phone,
        "line_items": li,
        "subtotal": float(q.subtotal or 0),
        "gst_rate": float(q.gst_rate),
        "gst_amount": float(q.gst_amount or 0),
        "pf_rate": float(q.pf_rate),
        "pf_amount": float(q.pf_amount or 0),
        "freight_note": q.freight_note or "Extra at actual",
        "freight_amount": float(getattr(q, "freight_amount", 0) or 0),
        "freight_rate": float(q.freight_rate) if getattr(q, "freight_rate", None) is not None else None,
        "total_amount": float(q.total_amount or 0),
        "validity_days": int(q.validity_days or 15),
        "professional_notes": q.notes or "",
        "pdf_display_overrides": ov,
    }
    if q.enquiry_id:
        out["enquiry_id"] = str(q.enquiry_id)
        enq = getattr(q, "enquiry", None)
        if enq is not None and getattr(enq, "created_at", None):
            out["enquiry_date"] = enq.created_at.strftime("%d/%m/%Y")
        if enq is not None:
            eno = (getattr(enq, "enquiry_number", None) or "").strip()
            if eno:
                out["enquiry_number"] = eno
            pd = getattr(enq, "parsed_data", None) or {}
            if isinstance(pd, dict):
                src = str(pd.get("enquiry_source") or "").strip()
                if src:
                    out["enquiry_reference"] = src.replace("_", " ").title()
    if getattr(q, "created_at", None):
        out["quotation_date"] = q.created_at.strftime("%d/%m/%Y")
    emp = getattr(q, "client_employee", None)
    if emp is not None and getattr(emp, "full_name", None):
        out["quotation_client_employee"] = {
            "full_name": str(emp.full_name).strip(),
            "address_code": str(getattr(emp, "address_code", None) or "").strip(),
            "phone": str(getattr(emp, "phone", None) or "").strip(),
            "email": str(getattr(emp, "email", None) or "").strip(),
            "department": str(getattr(emp, "department", None) or "").strip(),
            "designation": str(emp.designation).strip() if getattr(emp, "designation", None) else "",
        }
    prep_name, prep_email, prep_phone = _preparer_from_quotation(q)
    if prepared_by_name and str(prepared_by_name).strip():
        prep_name = str(prepared_by_name).strip()
    if prepared_by_email and str(prepared_by_email).strip():
        prep_email = str(prepared_by_email).strip()
    if prepared_by_phone and str(prepared_by_phone).strip():
        prep_phone = str(prepared_by_phone).strip()
    if prep_name:
        out["prepared_by_name"] = prep_name
    if prep_email:
        out["prepared_by_email"] = prep_email
    if prep_phone:
        out["prepared_by_phone"] = prep_phone
    return out


async def regenerate_quotation_pdf(
    q: Quotation,
    *,
    db: AsyncSession | None = None,
    prepared_by_email: str | None = None,
    prepared_by_name: str | None = None,
) -> str | None:
    settings = get_settings()
    client_json = settings.get_client_json()
    supplier_names = await supplier_names_for_client(db) if db is not None else []
    payload = _quotation_payload_for_pdf(
        q,
        prepared_by_email=prepared_by_email,
        prepared_by_name=prepared_by_name,
    )
    payload["supplier_names"] = supplier_names
    pdf_path = await generate_quotation_pdf(
        payload,
        client_json,
    )
    return pdf_path


def _safe_float(x: object, default: float = 0.0) -> float:
    try:
        return float(x) if x is not None else default
    except Exception:
        return default


def _line_key(li: dict) -> str:
    ct = str(li.get("catalog_table") or "").strip().lower()
    cr = str(li.get("catalog_row_id") or "").strip().lower()
    desc = str(li.get("description") or "").strip().lower()
    if ct and cr:
        return f"{ct}:{cr}"
    return desc or "line"


def _diff_quote_lines(before: list[dict], after: list[dict]) -> dict:
    bmap: dict[str, dict] = {_line_key(x): x for x in (before or []) if isinstance(x, dict)}
    amap: dict[str, dict] = {_line_key(x): x for x in (after or []) if isinstance(x, dict)}

    added = [k for k in amap.keys() if k not in bmap]
    removed = [k for k in bmap.keys() if k not in amap]
    changed: list[dict] = []
    fields = (
        "description",
        "quantity",
        "base_unit_price",
        "customer_discount_pct",
        "customer_discount_amount",
        "unit_price",
        "unit",
        "line_total",
    )
    for k in amap.keys():
        if k not in bmap:
            continue
        b = bmap[k]
        a = amap[k]
        delta: dict[str, dict] = {}
        for f in fields:
            bv = b.get(f)
            av = a.get(f)
            if f in ("quantity",):
                try:
                    bv = int(bv) if bv is not None else None
                except Exception:
                    pass
                try:
                    av = int(av) if av is not None else None
                except Exception:
                    pass
            if f in ("base_unit_price", "customer_discount_pct", "customer_discount_amount", "unit_price", "line_total"):
                bv = round(_safe_float(bv, 0.0), 2)
                av = round(_safe_float(av, 0.0), 2)
            if (bv is None and av is None) or str(bv) == str(av):
                continue
            delta[f] = {"from": bv, "to": av}
        if delta:
            changed.append({"line": k, "changes": delta})

    return {
        "added": added[:10],
        "removed": removed[:10],
        "changed": changed[:10],
        "counts": {"added": len(added), "removed": len(removed), "changed": len(changed)},
    }


async def get_quotation(quotation_id: str, db: AsyncSession) -> Quotation:
    """Fetch a quotation by ID. Raises ProductNotFoundError if missing."""
    result = await db.execute(
        select(Quotation)
        .options(
            selectinload(Quotation.client_employee),
            selectinload(Quotation.enquiry),
            selectinload(Quotation.created_by_user),
        )
        .where(Quotation.id == quotation_id)
    )
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise ProductNotFoundError(f"Quotation {quotation_id} not found")
    return quotation


async def get_quotation_pdf_path(
    quotation_id: str,
    db: AsyncSession,
    *,
    prepared_by_email: str | None = None,
    prepared_by_name: str | None = None,
) -> str:
    """Return the absolute PDF file path for a quotation.

    Raises ProductNotFoundError if quotation doesn't exist.
    Raises QuotationBuildError if PDF not yet generated or file missing.
    """
    quotation = await get_quotation(quotation_id, db)
    # Always regenerate on download so the file matches the latest UI/PDF template.
    regenerated = await regenerate_quotation_pdf(
        quotation,
        db=db,
        prepared_by_email=prepared_by_email,
        prepared_by_name=prepared_by_name,
    )
    if regenerated:
        quotation.pdf_path = regenerated
        await db.commit()
        pdf = Path(regenerated)
        if pdf.exists():
            return str(pdf.resolve())

    # Fallback only if regeneration unexpectedly failed but an old file exists.
    if quotation.pdf_path:
        pdf = Path(quotation.pdf_path)
        if pdf.exists():
            return str(pdf.resolve())

    raise QuotationBuildError(f"Could not generate PDF for quotation {quotation_id}")


async def list_quotations(
    db: AsyncSession,
    limit: int = 50,
    offset: int = 0,
    *,
    search: str | None = None,
    client_name: str | None = None,
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    created_by_user_id: uuid.UUID | None = None,
) -> list[Quotation]:
    """Return list of quotations ordered by creation date, with optional filters."""
    stmt = select(Quotation).options(selectinload(Quotation.enquiry))
    conds: list = []

    if search and str(search).strip():
        term = f"%{str(search).strip()}%"
        conds.append(
            or_(
                Quotation.quote_number.ilike(term),
                Quotation.client_name.ilike(term),
                Quotation.client_company.ilike(term),
            )
        )

    if client_name and str(client_name).strip():
        cn = f"%{str(client_name).strip()}%"
        conds.append(
            or_(
                Quotation.client_name.ilike(cn),
                Quotation.client_company.ilike(cn),
            )
        )

    if date_from is not None:
        dt0 = datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc)
        conds.append(Quotation.created_at >= dt0)

    if date_to is not None:
        dt1 = datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        conds.append(Quotation.created_at < dt1)
    if created_by_user_id is not None:
        conds.append(Quotation.created_by_user_id == created_by_user_id)

    if conds:
        stmt = stmt.where(and_(*conds))

    stmt = stmt.order_by(Quotation.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_quotation_crm_status(
    quotation_id: str,
    status: str,
    status_remarks: str | None,
    db: AsyncSession,
    *,
    performed_by: str = "user",
    performed_by_name: str | None = None,
) -> Quotation:
    st = str(status or "").strip()
    if st not in QUOTATION_CRM_STATUSES:
        raise ValueError(f"Invalid status. Use one of: {', '.join(sorted(QUOTATION_CRM_STATUSES))}")

    remarks = (str(status_remarks).strip() if status_remarks is not None else "") or None
    if st == "lost" and not remarks:
        raise ValueError("Remarks are required for Lost")

    q = await get_quotation(quotation_id, db)
    lines = copy.deepcopy(q.line_items) if isinstance(q.line_items, list) else []
    if not lines:
        q.status = st
        q.status_remarks = remarks if st == "lost" else None
    else:
        updated: list[dict] = []
        for li in lines:
            if not isinstance(li, dict):
                continue
            row = dict(li)
            if is_line_crm_status_locked(row.get("crm_status")):
                updated.append(row)
                continue
            row["crm_status"] = st
            row["crm_status_remarks"] = remarks if st == "lost" else None
            updated.append(row)
        q.line_items = updated
        flag_modified(q, "line_items")
        q.status = derive_quotation_status_from_lines(updated)
        q.status_remarks = None

    db.add(
        AuditLog(
            id=uuid.uuid4(),
            entity_type="quotation",
            entity_id=q.id,
            action="quotation_crm_status",
            performed_by=performed_by or "user",
            details={
                "performed_by_name": performed_by_name,
                "quotation_id": str(q.id),
                "quote_number": q.quote_number,
                "status": st,
                "status_remarks": remarks,
                "scope": "all_lines",
            },
        )
    )

    await db.commit()
    await db.refresh(q)
    return q


def _quotation_line_indices_covered_by_pos(pos: list[PurchaseOrder]) -> set[int]:
    covered: set[int] = set()
    for po in pos:
        items = po.line_items if isinstance(po.line_items, list) else []
        for li in items:
            if not isinstance(li, dict):
                continue
            raw_idx = li.get("quotation_line_index")
            if raw_idx is None:
                continue
            try:
                covered.add(int(raw_idx))
            except (TypeError, ValueError):
                continue
    return covered


async def sync_quotation_po_received_from_purchase_orders(
    quotation_id: uuid.UUID,
    db: AsyncSession,
    *,
    performed_by: str = "system",
    performed_by_name: str | None = None,
    source_po_id: uuid.UUID | None = None,
) -> Quotation | None:
    """Align quotation line CRM statuses with linked POs (covered lines → po_received)."""
    q = await get_quotation(str(quotation_id), db)
    res = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.quotation_id == quotation_id)
    )
    pos = list(res.scalars().all())
    covered = _quotation_line_indices_covered_by_pos(pos)

    lines = copy.deepcopy(q.line_items) if isinstance(q.line_items, list) else []
    if not lines:
        return q

    changed_indices: list[int] = []
    for i, li in enumerate(lines):
        if not isinstance(li, dict):
            continue
        current = _normalize_line_crm_status(li.get("crm_status"))
        if current == "lost":
            continue
        if i in covered:
            if current != "po_received":
                row = dict(li)
                row["crm_status"] = "po_received"
                row["crm_status_remarks"] = None
                lines[i] = row
                changed_indices.append(i)
        elif current == "po_received":
            row = dict(li)
            row["crm_status"] = "ongoing"
            row["crm_status_remarks"] = None
            lines[i] = row
            changed_indices.append(i)

    if not changed_indices:
        return q

    q.line_items = lines
    flag_modified(q, "line_items")
    q.status = derive_quotation_status_from_lines(lines)
    q.status_remarks = None

    for idx in changed_indices:
        row = lines[idx]
        if not isinstance(row, dict):
            continue
        db.add(
            AuditLog(
                id=uuid.uuid4(),
                entity_type="quotation",
                entity_id=q.id,
                action="quotation_line_crm_status",
                performed_by=performed_by or "system",
                details={
                    "performed_by_name": performed_by_name,
                    "quotation_id": str(q.id),
                    "quote_number": q.quote_number,
                    "line_index": idx,
                    "line_label": _short_label(row),
                    "status": _normalize_line_crm_status(row.get("crm_status")),
                    "status_remarks": row.get("crm_status_remarks"),
                    "auto_from_purchase_order": True,
                    "source_po_id": str(source_po_id) if source_po_id else None,
                },
            )
        )

    return q


async def update_line_crm_status(
    quotation_id: str,
    line_index: int,
    status: str,
    status_remarks: str | None,
    db: AsyncSession,
    *,
    performed_by: str = "user",
    performed_by_name: str | None = None,
) -> Quotation:
    st = _normalize_line_crm_status(status)
    remarks = (str(status_remarks).strip() if status_remarks is not None else "") or None
    if st == "lost" and not remarks:
        raise ValueError("Remarks are required for Lost")

    q = await get_quotation(quotation_id, db)
    lines = copy.deepcopy(q.line_items) if isinstance(q.line_items, list) else []
    if line_index < 0 or line_index >= len(lines) or not isinstance(lines[line_index], dict):
        raise ValueError("Invalid line index")

    row = dict(lines[line_index])
    if is_line_crm_status_locked(row.get("crm_status")):
        current = _normalize_line_crm_status(row.get("crm_status"))
        label = current.replace("_", " ")
        raise ValueError(f"Cannot change status: this product is locked as {label}.")

    row["crm_status"] = st
    row["crm_status_remarks"] = remarks if st == "lost" else None
    lines[line_index] = row
    q.line_items = lines
    flag_modified(q, "line_items")
    q.status = derive_quotation_status_from_lines(lines)
    q.status_remarks = None

    db.add(
        AuditLog(
            id=uuid.uuid4(),
            entity_type="quotation",
            entity_id=q.id,
            action="quotation_line_crm_status",
            performed_by=performed_by or "user",
            details={
                "performed_by_name": performed_by_name,
                "quotation_id": str(q.id),
                "quote_number": q.quote_number,
                "line_index": line_index,
                "line_label": _short_label(row),
                "status": st,
                "status_remarks": row.get("crm_status_remarks"),
            },
        )
    )

    await db.commit()
    await db.refresh(q)
    return q


async def archive_quotation(
    quotation_id: str,
    db: AsyncSession,
    *,
    performed_by: str = "user",
    performed_by_name: str | None = None,
) -> Quotation:
    q = await get_quotation(quotation_id, db)
    if q.is_archived:
        return q
    q.is_archived = True
    db.add(
        AuditLog(
            id=uuid.uuid4(),
            entity_type="quotation",
            entity_id=q.id,
            action="quotation_archived",
            performed_by=performed_by or "user",
            details={
                "performed_by_name": performed_by_name,
                "quotation_id": str(q.id),
                "quote_number": q.quote_number,
            },
        )
    )
    await db.commit()
    await db.refresh(q)
    return q


async def update_quotation_listing_dates(
    quotation_id: str,
    db: AsyncSession,
    *,
    validity_date: date | None = None,
    next_follow_up_date: date | None = None,
    set_validity: bool = False,
    set_follow_up: bool = False,
    performed_by: str = "user",
    performed_by_name: str | None = None,
) -> Quotation:
    q = await get_quotation(quotation_id, db)
    changed: dict[str, object] = {}
    if set_validity:
        q.validity_date = validity_date
        changed["validity_date"] = validity_date.isoformat() if validity_date else None
    if set_follow_up:
        q.next_follow_up_date = next_follow_up_date
        changed["next_follow_up_date"] = (
            next_follow_up_date.isoformat() if next_follow_up_date else None
        )
    if not changed:
        return q

    db.add(
        AuditLog(
            id=uuid.uuid4(),
            entity_type="quotation",
            entity_id=q.id,
            action="quotation_listing_dates",
            performed_by=performed_by or "user",
            details={
                "performed_by_name": performed_by_name,
                "quotation_id": str(q.id),
                "quote_number": q.quote_number,
                **changed,
            },
        )
    )
    await db.commit()
    await db.refresh(q)
    return q


async def get_product_quote_history(
    db: AsyncSession,
    *,
    category: str,
    catalog_table: str | None = None,
    catalog_row_id: str | None = None,
    variant_type: str | None = None,
    construction: str | None = None,
    valve_size: str | None = None,
    end_connection: str | None = None,
    pressure: str | None = None,
    body: str | None = None,
    ball_disc: str | None = None,
    stem: str | None = None,
    seat: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, list[QuotationProductHistory]]:
    settings = get_settings()
    conds = [QuotationProductHistory.client_config == settings.ACTIVE_CLIENT]

    cat_norm = category.strip().lower() if category else ""
    if cat_norm:
        conds.append(QuotationProductHistory.category == cat_norm)

    # Preferred exact lookup (works across all categories if catalog ids are present).
    use_catalog_lookup = False
    if catalog_table and catalog_row_id:
        try:
            import uuid as _uuid

            row_uuid = _uuid.UUID(str(catalog_row_id))
        except Exception:
            row_uuid = None
        if row_uuid is not None:
            conds.append(QuotationProductHistory.catalog_table == catalog_table.strip().lower())
            conds.append(QuotationProductHistory.catalog_row_id == row_uuid)
            use_catalog_lookup = True

    def add_if(field, value: str | None) -> None:
        if value is not None and value.strip() != "":
            conds.append(field == value.strip())

    if not use_catalog_lookup:
        add_if(QuotationProductHistory.variant_type, variant_type)
        add_if(QuotationProductHistory.construction, construction)
        add_if(QuotationProductHistory.valve_size, valve_size)
        add_if(QuotationProductHistory.end_connection, end_connection)
        add_if(QuotationProductHistory.pressure, pressure)
        add_if(QuotationProductHistory.body, body)
        add_if(QuotationProductHistory.ball_disc, ball_disc)
        add_if(QuotationProductHistory.stem, stem)
        add_if(QuotationProductHistory.seat, seat)

    where_clause = and_(*conds)
    total = (
        await db.execute(
            select(func.count(QuotationProductHistory.id)).where(where_clause),
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(QuotationProductHistory)
            .where(where_clause)
            .order_by(QuotationProductHistory.quoted_at.desc(), QuotationProductHistory.created_at.desc())
            .offset(max(0, offset))
            .limit(min(max(1, limit), 100)),
        )
    ).scalars().all()
    return int(total or 0), list(rows)


async def update_quotation_from_manual_line_items(
    quotation_id: str,
    line_items_in: list,
    db: AsyncSession,
    *,
    performed_by: str = "user",
    performed_by_name: str | None = None,
) -> Quotation:
    """Rebuild quotation lines from manual configurator payloads; regenerate PDF and history.

    Raises ``ValueError`` when ``line_items_in`` produces no valid rows.
    """
    if not isinstance(line_items_in, list) or not line_items_in:
        raise ValueError("lineItems must be a non-empty array")

    q = await get_quotation(quotation_id, db)
    enquiry = await enquiry_svc.get_enquiry(str(q.enquiry_id), db)
    before_lines = list(q.line_items or []) if isinstance(q.line_items, list) else []
    before_totals = _totals_snapshot(q)
    before_extra = _financial_extra(q)

    parsed_products, matched_products, quote_line_items, history_rows = (
        enquiry_svc.expand_manual_line_items_to_quote_parts(line_items_in)
    )
    chosen_discount_pct: float | None = None
    for li in line_items_in:
        if not isinstance(li, dict):
            continue
        d = enquiry_svc._normalize_discount_pct(li.get("customer_discount_pct"))
        if d is None:
            continue
        chosen_discount_pct = d
        break
    if not quote_line_items:
        raise ValueError("At least one valid line item is required")

    for idx, qli in enumerate(quote_line_items):
        if idx < len(before_lines) and isinstance(before_lines[idx], dict):
            old = before_lines[idx]
            qli["crm_status"] = _normalize_line_crm_status(
                old.get("crm_status"), fallback=q.status or "ongoing"
            )
            old_remarks = old.get("crm_status_remarks")
            if qli["crm_status"] == "lost" and old_remarks:
                qli["crm_status_remarks"] = str(old_remarks).strip() or None
        else:
            qli["crm_status"] = "ongoing"

    gst_rate = float(q.gst_rate)
    pf_rate = float(q.pf_rate)
    quote_line_items, subtotal, _, pf_amount, _base_total = enquiry_svc._calc_totals(
        quote_line_items, gst_rate=gst_rate, pf_rate=pf_rate
    )
    freight_amount = float(getattr(q, "freight_amount", 0) or 0)
    taxable_subtotal = round(subtotal + pf_amount + freight_amount, 2)
    gst_amount = round(taxable_subtotal * (gst_rate / 100.0), 2)
    total_amount = round(taxable_subtotal + gst_amount, 2)

    await db.execute(delete(QuotationProductHistory).where(QuotationProductHistory.quotation_id == q.id))
    await db.flush()

    settings = get_settings()
    for idx, qli in enumerate(quote_line_items):
        h = history_rows[idx] if idx < len(history_rows) else {}
        unit_price = enquiry_svc._clean_float(qli.get("unit_price"), 0.0)
        quantity = enquiry_svc._normalize_int(qli.get("quantity"), 1)
        line_total = round(unit_price * quantity, 2)
        db.add(
            QuotationProductHistory(
                id=uuid.uuid4(),
                quotation_id=q.id,
                enquiry_id=q.enquiry_id,
                client_config=settings.ACTIVE_CLIENT,
                quote_number=q.quote_number,
                client_name=q.client_name or None,
                client_company=q.client_company or None,
                line_index=idx,
                unit_price=unit_price,
                quantity=quantity,
                line_total=line_total,
                currency="INR",
                category=str(h.get("category") or "unknown"),
                catalog_table=h.get("catalog_table"),
                catalog_row_id=h.get("catalog_row_id"),
                variant_type=h.get("variant_type"),
                construction=h.get("construction"),
                valve_size=h.get("valve_size"),
                end_connection=h.get("end_connection"),
                pressure=h.get("pressure"),
                body=h.get("body"),
                ball_disc=h.get("ball_disc"),
                stem=h.get("stem"),
                seat=h.get("seat"),
            )
        )

    q.line_items = quote_line_items
    q.status = derive_quotation_status_from_lines(quote_line_items)
    q.subtotal = subtotal
    q.gst_amount = gst_amount
    q.pf_amount = pf_amount
    q.total_amount = total_amount
    q.pdf_display_overrides = _trim_pdf_display_overrides(
        q.pdf_display_overrides if isinstance(q.pdf_display_overrides, dict) else None,
        len(quote_line_items),
    )

    enquiry.matched_products = matched_products
    payload: dict = {}
    try:
        if enquiry.raw_input:
            parsed = json.loads(enquiry.raw_input)
            if isinstance(parsed, dict):
                payload = parsed
    except Exception:
        payload = {}
    payload["manual_line_items"] = line_items_in
    payload["line_items"] = quote_line_items
    payload.setdefault("source", "manual_dropdown")
    enquiry.raw_input = json.dumps(payload, ensure_ascii=False)

    pd = enquiry.parsed_data if isinstance(enquiry.parsed_data, dict) else {}
    pd = {**pd, "products_requested": parsed_products}
    enquiry.parsed_data = pd

    client_json = settings.get_client_json()
    quotation_data = {
        **_quotation_payload_for_pdf(q, prepared_by_email=performed_by, prepared_by_name=performed_by_name),
        "line_items": quote_line_items,
        "subtotal": subtotal,
        "gst_rate": gst_rate,
        "gst_amount": gst_amount,
        "pf_rate": pf_rate,
        "pf_amount": pf_amount,
        "total_amount": total_amount,
        "supplier_names": await supplier_names_for_client(db),
    }

    pdf_path = await generate_quotation_pdf(quotation_data, client_json)
    if pdf_path:
        q.pdf_path = pdf_path

    # Audit log: quotation edited (short diff + totals delta)
    after_lines = quote_line_items
    diff = _diff_quote_lines(before_lines, after_lines)
    after_totals = {
        "subtotal": float(subtotal or 0),
        "gst_amount": float(gst_amount or 0),
        "pf_amount": float(pf_amount or 0),
        "freight_amount": float(freight_amount or 0),
        "total_amount": float(total_amount or 0),
    }
    after_extra = {
        "pf_rate": float(pf_rate),
        "freight_rate": float(q.freight_rate) if q.freight_rate is not None else None,
    }
    change_view = build_line_items_change_view(before_lines, after_lines, diff)
    db.add(
        AuditLog(
            id=uuid.uuid4(),
            entity_type="quotation",
            entity_id=q.id,
            action="quotation_edited",
            performed_by=performed_by or "user",
            details={
                "performed_by_name": performed_by_name,
                "quotation_id": str(q.id),
                "quote_number": q.quote_number,
                "enquiry_id": str(q.enquiry_id),
                "diff": diff,
                "totals_before": before_totals,
                "totals_after": after_totals,
                "change_view": change_view,
            },
        )
    )

    if enquiry.company_id is not None and chosen_discount_pct is not None:
        company = await db.get(ClientCompany, enquiry.company_id)
        if company is not None:
            company.default_discount_pct = float(chosen_discount_pct)

    await db.commit()
    await db.refresh(q)
    return q


async def update_quotation_pdf_display_overrides(
    quotation_id: str,
    pdf_display_overrides: dict | None,
    db: AsyncSession,
    *,
    performed_by: str = "user",
    performed_by_name: str | None = None,
) -> Quotation:
    """Store PDF-only text overlays (line description/size, notes) and regenerate the PDF file."""
    q = await get_quotation(quotation_id, db)
    line_count = len(q.line_items) if isinstance(q.line_items, list) else 0
    before_ov = copy.deepcopy(q.pdf_display_overrides) if isinstance(q.pdf_display_overrides, dict) else {}

    if pdf_display_overrides is None:
        q.pdf_display_overrides = None
    elif isinstance(pdf_display_overrides, dict):
        q.pdf_display_overrides = _trim_pdf_display_overrides(pdf_display_overrides, line_count)
    else:
        raise ValueError("pdf_display_overrides must be an object or null")

    after_ov = copy.deepcopy(q.pdf_display_overrides) if isinstance(q.pdf_display_overrides, dict) else {}
    change_view = build_pdf_change_view(before_ov, after_ov)

    pdf_path = await regenerate_quotation_pdf(
        q,
        db=db,
        prepared_by_email=performed_by,
        prepared_by_name=performed_by_name,
    )
    if pdf_path:
        q.pdf_path = pdf_path

    db.add(
        AuditLog(
            id=uuid.uuid4(),
            entity_type="quotation",
            entity_id=q.id,
            action="quotation_pdf_display_updated",
            performed_by=performed_by or "user",
            details={
                "performed_by_name": performed_by_name,
                "quotation_id": str(q.id),
                "quote_number": q.quote_number,
                "change_view": change_view,
            },
        )
    )

    await db.commit()
    await db.refresh(q)
    return q


async def list_quotation_audit(quotation_id: str, db: AsyncSession, *, limit: int = 25) -> list[AuditLog]:
    qid = uuid.UUID(str(quotation_id))
    rows = (
        await db.execute(
            select(AuditLog)
            .where(
                AuditLog.entity_type == "quotation",
                AuditLog.entity_id == qid,
            )
            .order_by(AuditLog.created_at.desc())
            .limit(min(max(1, int(limit or 25)), 100)),
        )
    ).scalars().all()
    return list(rows)
