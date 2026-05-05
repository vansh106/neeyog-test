"""Quotation business logic — retrieval, PDF lookup, listing.

Pure service — no FastAPI imports, no HTTPException.
Raises only from core.exceptions.
"""

import json
import uuid
from pathlib import Path

from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from core.exceptions import ProductNotFoundError, QuotationBuildError
from db.models import AuditLog, Quotation, QuotationProductHistory
from services import enquiry_service as enquiry_svc
from services.pdf_service import generate_quotation_pdf


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
    fields = ("description", "quantity", "unit_price", "unit", "line_total")
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
            if f in ("unit_price", "line_total"):
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
        select(Quotation).where(Quotation.id == quotation_id)
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

    if not quotation.pdf_path:
        raise QuotationBuildError(f"PDF not yet generated for quotation {quotation_id}")

    pdf = Path(quotation.pdf_path)
    if not pdf.exists():
        raise QuotationBuildError(f"PDF file missing on disk: {quotation.pdf_path}")

    return str(pdf.resolve())


async def list_quotations(
    db: AsyncSession,
    limit: int = 50,
    offset: int = 0,
) -> list[Quotation]:
    """Return list of quotations ordered by creation date."""
    result = await db.execute(
        select(Quotation)
        .order_by(Quotation.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


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
        "quote_number": q.quote_number,
        "client_name": q.client_name,
        "client_company": q.client_company,
        "client_email": q.client_email,
        "client_phone": q.client_phone,
        "line_items": quote_line_items,
        "subtotal": subtotal,
        "gst_rate": gst_rate,
        "gst_amount": gst_amount,
        "pf_rate": pf_rate,
        "pf_amount": pf_amount,
        "freight_note": q.freight_note or "Extra at actual",
        "total_amount": total_amount,
        "professional_notes": q.notes or "",
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
