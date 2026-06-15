"""Purchase order business logic."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import get_settings
from core.exceptions import ProductNotFoundError
from db.models import PurchaseOrder, Quotation
from services import enquiry_service as enquiry_svc
from services.fiscal_numbering import allocate_po_number
from services.quotation_service import compute_financial_summary_from_config
from services.po_pdf_service import generate_purchase_order_pdf


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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


def _short_label(line: dict) -> str:
    name = str(line.get("product_name") or line.get("description") or "").strip()
    if "\n" in name:
        name = name.split("\n")[0].strip()
    size = str(line.get("size") or "").strip()
    if len(name) > 36:
        name = name[:33] + "..."
    if size:
        return f"{name} {size}".strip()
    return name or "Item"


def _item_desc_short_from_lines(lines: list[dict]) -> str:
    bits = [_short_label(li) for li in lines[:3] if isinstance(li, dict)]
    bits = [b for b in bits if b and b != "Item"]
    if not bits:
        return "—"
    out = " · ".join(bits)
    if len(lines) > 3:
        out += " …"
    return out[:250]


def _financial_body(body: dict) -> dict:
    fin = body.get("financial")
    if isinstance(fin, dict):
        return fin
    keys = (
        "pf_applicable", "pfApplicable", "pf_mode", "pfMode", "pf_draft", "pfDraft",
        "freight_applicable", "freightApplicable", "freight_mode", "freightMode",
        "freight_draft", "freightDraft",
        "cgst_applicable", "cgstApplicable", "cgst_mode", "cgstMode", "cgst_draft", "cgstDraft",
        "sgst_applicable", "sgstApplicable", "sgst_mode", "sgstMode", "sgst_draft", "sgstDraft",
        "igst_applicable", "igstApplicable", "igst_mode", "igstMode", "igst_draft", "igstDraft",
    )
    return {k: body[k] for k in keys if k in body}


def _line_total(qty: float, unit_price: float) -> float:
    return round(float(qty or 1) * float(unit_price or 0), 2)


def _build_lines_from_quotation(
    quotation: Quotation,
    selected: list[dict],
) -> list[dict]:
    src = quotation.line_items if isinstance(quotation.line_items, list) else []
    out: list[dict] = []
    for sel in selected:
        if not isinstance(sel, dict):
            continue
        idx = int(sel.get("line_index", sel.get("lineIndex", -1)))
        if idx < 0 or idx >= len(src):
            continue
        base = dict(src[idx])
        qty = int(sel.get("quantity", base.get("quantity") or 1))
        unit_price = float(sel.get("unit_price", sel.get("unitPrice", base.get("unit_price") or 0)))
        line_total = _line_total(qty, unit_price)
        base["quantity"] = qty
        base["unit_price"] = unit_price
        base["line_total"] = line_total
        base["total"] = line_total
        if sel.get("quoted_unit_price") is not None:
            base["quoted_unit_price"] = float(sel["quoted_unit_price"])
        elif sel.get("quotedUnitPrice") is not None:
            base["quoted_unit_price"] = float(sel["quotedUnitPrice"])
        else:
            base["quoted_unit_price"] = float(src[idx].get("unit_price") or 0)
        out.append(base)
    return out


def _build_lines_from_manual(manual_items: list) -> list[dict]:
    _, _, quote_line_items, _ = enquiry_svc.expand_manual_line_items_to_quote_parts(manual_items)
    if not quote_line_items:
        raise ValueError("No valid products for purchase order")
    return quote_line_items


def _item_total_from_lines(lines: list[dict]) -> float:
    total = 0.0
    for li in lines:
        if not isinstance(li, dict) or bool(li.get("price_tbd")):
            continue
        lt = li.get("line_total")
        if lt is not None:
            total += float(lt)
        else:
            total += _line_total(li.get("quantity", 1), li.get("unit_price", 0))
    return round(total, 2)


def _po_pdf_payload(po: PurchaseOrder, user_email: str | None = None) -> dict:
    emp = getattr(po, "client_employee", None)
    emp_payload = None
    if emp is not None:
        emp_payload = {
            "full_name": emp.full_name,
            "phone": emp.phone,
            "email": emp.email,
            "designation": emp.designation,
        }
    return {
        "po_number": po.po_number,
        "po_date": po.created_at.strftime("%d/%m/%Y") if po.created_at else "",
        "quote_number": po.quote_number,
        "client_name": po.client_name,
        "client_company": po.client_company,
        "client_email": po.client_email,
        "client_phone": po.client_phone,
        "quotation_client_employee": emp_payload,
        "line_items": po.line_items if isinstance(po.line_items, list) else [],
        "subtotal": po.subtotal,
        "gst_rate": po.gst_rate,
        "gst_amount": po.gst_amount,
        "pf_rate": po.pf_rate,
        "pf_amount": po.pf_amount,
        "freight_note": po.freight_note,
        "freight_amount": po.freight_amount,
        "freight_rate": po.freight_rate,
        "total_amount": po.total_amount,
        "financial_config": po.financial_config if isinstance(po.financial_config, dict) else {},
        "notes": po.notes,
        "prepared_by_name": (po.created_by_name or "").strip() or None,
        "prepared_by_email": user_email,
    }


async def regenerate_purchase_order_pdf(
    db: AsyncSession,
    po: PurchaseOrder,
    *,
    user_email: str | None = None,
) -> str | None:
    settings = get_settings()
    client_config = settings.get_client_json()
    payload = _po_pdf_payload(po, user_email=user_email)
    path = await generate_purchase_order_pdf(payload, client_config)
    if path:
        po.pdf_path = path
        po.updated_at = _utcnow()
        await db.commit()
        await db.refresh(po)
    return path


async def get_purchase_order(db: AsyncSession, po_id: str, *, include_archived: bool = False) -> PurchaseOrder:
    try:
        uid = uuid.UUID(str(po_id))
    except ValueError as exc:
        raise ProductNotFoundError(f"Invalid purchase order id: {po_id}") from exc
    res = await db.execute(
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.quotation),
            selectinload(PurchaseOrder.client_employee),
            selectinload(PurchaseOrder.created_by_user),
        )
        .where(PurchaseOrder.id == uid)
    )
    po = res.scalar_one_or_none()
    if po is None or (po.is_archived and not include_archived):
        raise ProductNotFoundError(f"Purchase order not found: {po_id}")
    return po


async def list_purchase_orders(
    db: AsyncSession,
    *,
    limit: int = 100,
    offset: int = 0,
    search: str | None = None,
    client_name: str | None = None,
    date_from=None,
    date_to=None,
    po_type: str | None = None,
) -> list[PurchaseOrder]:
    q = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.quotation))
        .where(PurchaseOrder.is_archived.is_(False))
        .order_by(PurchaseOrder.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if search and search.strip():
        s = f"%{search.strip()}%"
        q = q.where(
            PurchaseOrder.po_number.ilike(s)
            | PurchaseOrder.client_name.ilike(s)
            | PurchaseOrder.quote_number.ilike(s)
            | PurchaseOrder.item_desc_short.ilike(s)
        )
    if client_name and client_name.strip():
        q = q.where(PurchaseOrder.client_name.ilike(f"%{client_name.strip()}%"))
    if date_from is not None:
        q = q.where(PurchaseOrder.created_at >= date_from)
    if date_to is not None:
        q = q.where(PurchaseOrder.created_at <= date_to)
    if po_type == "quoted":
        q = q.where(PurchaseOrder.quotation_id.isnot(None))
    elif po_type == "non_quoted":
        q = q.where(PurchaseOrder.quotation_id.is_(None))
    res = await db.execute(q)
    return list(res.scalars().all())


async def create_purchase_order(
    db: AsyncSession,
    body: dict,
    *,
    user_id: uuid.UUID | None,
    user_name: str | None,
    user_email: str | None = None,
) -> PurchaseOrder:
    quotation: Quotation | None = None
    quotation_id_raw = body.get("quotation_id") or body.get("quotationId")
    selected = body.get("selected_lines") or body.get("selectedLines")
    manual_items = body.get("manual_line_items") or body.get("manualLineItems")

    if quotation_id_raw:
        try:
            qid = uuid.UUID(str(quotation_id_raw))
        except ValueError as exc:
            raise ValueError("Invalid quotation_id") from exc
        res = await db.execute(
            select(Quotation)
            .options(selectinload(Quotation.client_employee))
            .where(Quotation.id == qid)
        )
        quotation = res.scalar_one_or_none()
        if quotation is None:
            raise ProductNotFoundError("Quotation not found")
        if not isinstance(selected, list) or not selected:
            raise ValueError("Select at least one quotation line for a quoted PO")
        lines = _build_lines_from_quotation(quotation, selected)
        if not lines:
            raise ValueError("Could not build PO lines from quotation selection")
        client_name = quotation.client_name
        client_company = quotation.client_company
        client_email = quotation.client_email
        client_phone = quotation.client_phone
        client_employee_id = quotation.client_employee_id
        quote_number = quotation.quote_number
    else:
        if not isinstance(manual_items, list) or not manual_items:
            raise ValueError("manual_line_items required for non-quoted PO")
        lines = _build_lines_from_manual(manual_items)
        client_name = str(body.get("client_name") or body.get("clientName") or "").strip()
        if not client_name:
            raise ValueError("client_name is required")
        client_company = (body.get("client_company") or body.get("clientCompany") or None)
        client_email = (body.get("client_email") or body.get("clientEmail") or None)
        client_phone = (body.get("client_phone") or body.get("clientPhone") or None)
        client_employee_id = None
        ce_raw = body.get("client_employee_id") or body.get("clientEmployeeId")
        if ce_raw:
            try:
                client_employee_id = uuid.UUID(str(ce_raw))
            except ValueError:
                client_employee_id = None
        quote_number = None
        quotation_id_raw = None

    item_total = _item_total_from_lines(lines)
    fin_body = _financial_body(body)
    computed = compute_financial_summary_from_config(item_total, fin_body)

    po_number = await allocate_po_number(db)
    po = PurchaseOrder(
        po_number=po_number,
        quotation_id=uuid.UUID(str(quotation_id_raw)) if quotation_id_raw else None,
        quote_number=quote_number,
        client_name=client_name,
        client_company=client_company,
        client_email=client_email,
        client_phone=client_phone,
        client_employee_id=client_employee_id,
        line_items=lines,
        subtotal=computed["item_total"],
        gst_rate=float(computed.get("gst_amount", 0) and 18 or 18),
        gst_amount=computed["gst_amount"],
        pf_rate=float(computed.get("pf_rate") or 3),
        pf_amount=computed["pf_amount"],
        freight_note=str(body.get("freight_note") or body.get("freightNote") or "Included"),
        freight_amount=computed["freight_amount"],
        freight_rate=computed.get("freight_rate"),
        total_amount=computed["total_amount"],
        primary_category=_primary_category_from_lines(lines),
        item_desc_short=_item_desc_short_from_lines(lines),
        financial_config={**fin_body, **{k: computed[k] for k in (
            "cgst_amount", "sgst_amount", "igst_amount", "pf_amount", "freight_amount", "gst_amount", "total_amount"
        ) if k in computed}},
        notes=(body.get("notes") or None),
        created_by_user_id=user_id,
        created_by_name=(user_name or "").strip() or None,
    )
    db.add(po)
    await db.commit()
    await db.refresh(po)

    po = await get_purchase_order(db, str(po.id))
    await regenerate_purchase_order_pdf(db, po, user_email=user_email)
    return await get_purchase_order(db, str(po.id))


async def get_purchase_order_pdf_path(
    db: AsyncSession,
    po_id: str,
    *,
    user_email: str | None = None,
) -> str:
    po = await get_purchase_order(db, po_id)
    await regenerate_purchase_order_pdf(db, po, user_email=user_email)
    po = await get_purchase_order(db, po_id)
    if not po.pdf_path:
        raise ValueError("PDF generation failed")
    return po.pdf_path


async def archive_purchase_order(db: AsyncSession, po_id: str) -> PurchaseOrder:
    try:
        uid = uuid.UUID(str(po_id))
    except ValueError as exc:
        raise ProductNotFoundError(f"Invalid purchase order id: {po_id}") from exc
    res = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == uid))
    po = res.scalar_one_or_none()
    if po is None:
        raise ProductNotFoundError(f"Purchase order not found: {po_id}")
    if po.is_archived:
        return po
    po.is_archived = True
    po.updated_at = _utcnow()
    await db.commit()
    await db.refresh(po)
    return po
