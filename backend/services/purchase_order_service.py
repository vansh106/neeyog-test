"""Purchase order business logic."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.exceptions import ProductNotFoundError
from db.models import PurchaseOrder, Quotation
from services import enquiry_service as enquiry_svc
from services.fiscal_numbering import allocate_po_number
from services.quotation_service import (
    compute_financial_summary_from_config,
    sync_quotation_po_received_from_purchase_orders,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_optional_so_date(body: dict, *keys: str) -> date | None | object:
    """Return parsed date, None to clear, or _UNSET if key absent."""
    for key in keys:
        if key not in body:
            continue
        raw = body.get(key)
        if raw is None or raw == "":
            return None
        if isinstance(raw, date):
            return raw
        s = str(raw).strip()
        if not s:
            return None
        try:
            return date.fromisoformat(s[:10])
        except ValueError as exc:
            raise ValueError("Invalid SO date") from exc
    return _UNSET


_UNSET = object()


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
        discount_pct = enquiry_svc._normalize_discount_pct(
            sel.get("customer_discount_pct", sel.get("customerDiscountPct"))
        )
        if discount_pct is None:
            discount_pct = enquiry_svc._normalize_discount_pct(base.get("customer_discount_pct")) or 0.0

        base_unit = base.get("base_unit_price")
        if base_unit is None or float(base_unit or 0) <= 0:
            base_unit = float(base.get("unit_price") or unit_price or 0)
        base_unit = round(float(base_unit), 2)

        discount_amount = round(base_unit * (discount_pct / 100.0), 2) if discount_pct > 0 else 0.0
        line_total = _line_total(qty, unit_price)
        base["quantity"] = qty
        base["base_unit_price"] = base_unit
        base["customer_discount_pct"] = discount_pct
        base["customer_discount_amount"] = discount_amount
        base["unit_price"] = unit_price
        base["line_total"] = line_total
        base["total"] = line_total
        base["quotation_line_index"] = idx
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


async def get_purchase_order(db: AsyncSession, po_id: str) -> PurchaseOrder:
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
    if po is None:
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
    created_by_user_id: uuid.UUID | None = None,
) -> list[PurchaseOrder]:
    q = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.quotation))
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
            | PurchaseOrder.so_number.ilike(s)
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
    if created_by_user_id is not None:
        q = q.where(PurchaseOrder.created_by_user_id == created_by_user_id)
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

    so_raw = body.get("so_number") or body.get("soNumber")
    so_number = str(so_raw).strip() if so_raw else None
    if so_number == "":
        so_number = None
    so_date_raw = _parse_optional_so_date(body, "so_date", "soDate")
    so_date = None if so_date_raw is _UNSET else so_date_raw

    po_number = await allocate_po_number(db)
    po = PurchaseOrder(
        po_number=po_number,
        so_number=so_number,
        so_date=so_date,
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
    if quotation_id_raw:
        await db.flush()
        await sync_quotation_po_received_from_purchase_orders(
            uuid.UUID(str(quotation_id_raw)),
            db,
            performed_by=user_email or "system",
            performed_by_name=user_name,
            source_po_id=po.id,
        )
    await db.commit()
    await db.refresh(po)

    po = await get_purchase_order(db, str(po.id))
    return po


def _merge_financial_config(existing: dict | None, body: dict) -> dict:
    fin = _financial_body(body)
    base = dict(existing) if isinstance(existing, dict) else {}
    base.update(fin)
    return base


def _apply_computed_financials(po: PurchaseOrder, lines: list[dict], fin_body: dict) -> None:
    item_total = _item_total_from_lines(lines)
    computed = compute_financial_summary_from_config(item_total, fin_body)
    po.line_items = lines
    po.subtotal = computed["item_total"]
    po.gst_amount = computed["gst_amount"]
    po.pf_rate = float(computed.get("pf_rate") or 3)
    po.pf_amount = computed["pf_amount"]
    po.freight_amount = computed["freight_amount"]
    po.freight_rate = computed.get("freight_rate")
    po.total_amount = computed["total_amount"]
    po.primary_category = _primary_category_from_lines(lines)
    po.item_desc_short = _item_desc_short_from_lines(lines)
    po.financial_config = {
        **fin_body,
        **{
            k: computed[k]
            for k in (
                "cgst_amount",
                "sgst_amount",
                "igst_amount",
                "pf_amount",
                "freight_amount",
                "gst_amount",
                "total_amount",
            )
            if k in computed
        },
    }


async def update_purchase_order(
    db: AsyncSession,
    po_id: str,
    body: dict,
    *,
    user_email: str | None = None,
    user_name: str | None = None,
) -> PurchaseOrder:
    po = await get_purchase_order(db, po_id)
    is_quoted = po.quotation_id is not None

    selected = body.get("selected_lines") or body.get("selectedLines")
    manual_items = body.get("manual_line_items") or body.get("manualLineItems")
    client_keys = (
        "client_name", "clientName", "client_company", "clientCompany",
        "client_email", "clientEmail", "client_phone", "clientPhone",
        "client_employee_id", "clientEmployeeId",
    )
    has_client_update = any(k in body for k in client_keys)

    if is_quoted:
        if has_client_update:
            raise ValueError("Client cannot be changed on a quoted purchase order")
        if manual_items is not None:
            raise ValueError("manual_line_items not allowed for quoted purchase orders")
    else:
        if selected is not None:
            raise ValueError("selected_lines not allowed for non-quoted purchase orders")

    lines = list(po.line_items) if isinstance(po.line_items, list) else []

    if is_quoted and isinstance(selected, list):
        if not selected:
            raise ValueError("Select at least one quotation line")
        quotation = po.quotation
        if quotation is None:
            res = await db.execute(select(Quotation).where(Quotation.id == po.quotation_id))
            quotation = res.scalar_one_or_none()
        if quotation is None:
            raise ProductNotFoundError("Linked quotation not found")
        lines = _build_lines_from_quotation(quotation, selected)
        if not lines:
            raise ValueError("Could not build PO lines from quotation selection")
    elif not is_quoted and isinstance(manual_items, list):
        if not manual_items:
            raise ValueError("At least one product is required")
        lines = _build_lines_from_manual(manual_items)

    if not is_quoted and has_client_update:
        client_name = str(body.get("client_name") or body.get("clientName") or po.client_name).strip()
        if not client_name:
            raise ValueError("client_name is required")
        po.client_name = client_name
        if "client_company" in body or "clientCompany" in body:
            po.client_company = body.get("client_company") or body.get("clientCompany") or None
        if "client_email" in body or "clientEmail" in body:
            po.client_email = body.get("client_email") or body.get("clientEmail") or None
        if "client_phone" in body or "clientPhone" in body:
            po.client_phone = body.get("client_phone") or body.get("clientPhone") or None
        ce_raw = body.get("client_employee_id") or body.get("clientEmployeeId")
        if ce_raw is not None:
            if ce_raw == "" or ce_raw is False:
                po.client_employee_id = None
            else:
                try:
                    po.client_employee_id = uuid.UUID(str(ce_raw))
                except ValueError:
                    po.client_employee_id = None

    if "so_number" in body or "soNumber" in body:
        so_raw = body.get("so_number") if "so_number" in body else body.get("soNumber")
        so_number = str(so_raw).strip() if so_raw else None
        po.so_number = so_number or None

    so_date_raw = _parse_optional_so_date(body, "so_date", "soDate")
    if so_date_raw is not _UNSET:
        po.so_date = so_date_raw

    if "notes" in body:
        notes_raw = body.get("notes")
        po.notes = str(notes_raw).strip() if notes_raw else None

    if "freight_note" in body or "freightNote" in body:
        fn = body.get("freight_note") if "freight_note" in body else body.get("freightNote")
        if fn is not None:
            po.freight_note = str(fn).strip() or "Included"

    fin_body = _merge_financial_config(
        po.financial_config if isinstance(po.financial_config, dict) else None,
        body,
    )
    _apply_computed_financials(po, lines, fin_body)

    if po.quotation_id is not None:
        await db.flush()
        await sync_quotation_po_received_from_purchase_orders(
            po.quotation_id,
            db,
            performed_by=user_email or "system",
            performed_by_name=user_name,
            source_po_id=po.id,
        )

    await db.commit()
    await db.refresh(po)
    return await get_purchase_order(db, str(po.id))


async def delete_purchase_order(
    db: AsyncSession,
    po_id: str,
    *,
    user_email: str | None = None,
    user_name: str | None = None,
) -> str:
    po = await get_purchase_order(db, po_id)
    deleted_id = str(po.id)
    quotation_id = po.quotation_id
    await db.delete(po)
    if quotation_id is not None:
        await db.flush()
        await sync_quotation_po_received_from_purchase_orders(
            quotation_id,
            db,
            performed_by=user_email or "system",
            performed_by_name=user_name,
        )
    await db.commit()
    return deleted_id
