"""Quotation business logic — retrieval, PDF lookup, listing.

Pure service — no FastAPI imports, no HTTPException.
Raises only from core.exceptions.
"""

import json
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import get_settings
from core.exceptions import ProductNotFoundError, QuotationBuildError
from db.models import AuditLog, ClientCompany, Quotation, QuotationProductHistory
from services import enquiry_service as enquiry_svc
from services.pdf_service import generate_quotation_pdf

QUOTATION_CRM_STATUSES: frozenset[str] = frozenset({"po_received", "lost", "hold", "ongoing"})


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
    if not out:
        return None
    return out


def _quotation_payload_for_pdf(q: Quotation) -> dict:
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
    if getattr(q, "created_at", None):
        out["quotation_date"] = q.created_at.strftime("%d/%m/%Y")
    emp = getattr(q, "client_employee", None)
    if emp is not None and getattr(emp, "full_name", None):
        out["quotation_client_employee"] = {
            "full_name": str(emp.full_name).strip(),
            "designation": str(emp.designation).strip() if getattr(emp, "designation", None) else "",
        }
    return out


async def regenerate_quotation_pdf(q: Quotation) -> str | None:
    settings = get_settings()
    client_json = settings.get_client_json()
    pdf_path = await generate_quotation_pdf(_quotation_payload_for_pdf(q), client_json)
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
        )
        .where(Quotation.id == quotation_id)
    )
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise ProductNotFoundError(f"Quotation {quotation_id} not found")
    return quotation


async def get_quotation_pdf_path(quotation_id: str, db: AsyncSession) -> str:
    """Return the absolute PDF file path for a quotation.

    Raises ProductNotFoundError if quotation doesn't exist.
    Raises QuotationBuildError if PDF not yet generated or file missing.
    """
    quotation = await get_quotation(quotation_id, db)
    # Always regenerate on download so the file matches the latest UI/PDF template.
    regenerated = await regenerate_quotation_pdf(quotation)
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

    if status and str(status).strip():
        conds.append(Quotation.status == str(status).strip())

    if date_from is not None:
        dt0 = datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc)
        conds.append(Quotation.created_at >= dt0)

    if date_to is not None:
        dt1 = datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        conds.append(Quotation.created_at < dt1)

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
    if st in ("lost", "hold") and not remarks:
        raise ValueError("Remarks are required for Lost and Hold")

    q = await get_quotation(quotation_id, db)
    q.status = st
    q.status_remarks = remarks if st in ("lost", "hold") else None

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
                "status_remarks": q.status_remarks,
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
    before_totals = {
        "subtotal": float(q.subtotal or 0),
        "gst_amount": float(q.gst_amount or 0),
        "pf_amount": float(q.pf_amount or 0),
        "total_amount": float(q.total_amount or 0),
    }

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

    gst_rate = float(q.gst_rate)
    pf_rate = float(q.pf_rate)
    quote_line_items, subtotal, gst_amount, pf_amount, total_amount = enquiry_svc._calc_totals(
        quote_line_items, gst_rate=gst_rate, pf_rate=pf_rate
    )

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
        **_quotation_payload_for_pdf(q),
        "line_items": quote_line_items,
        "subtotal": subtotal,
        "gst_rate": gst_rate,
        "gst_amount": gst_amount,
        "pf_rate": pf_rate,
        "pf_amount": pf_amount,
        "total_amount": total_amount,
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
        "total_amount": float(total_amount or 0),
    }
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

    if pdf_display_overrides is None:
        q.pdf_display_overrides = None
    elif isinstance(pdf_display_overrides, dict):
        q.pdf_display_overrides = _trim_pdf_display_overrides(pdf_display_overrides, line_count)
    else:
        raise ValueError("pdf_display_overrides must be an object or null")

    pdf_path = await regenerate_quotation_pdf(q)
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
