"""Supplier pricing + Parth margin / customer discount calculations.

Single place for price math (`calculate_price`) and async DB helpers used by
the suppliers API. Catalog tables are never duplicated — prices reference
``catalog_table`` + ``catalog_row_id`` only.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

import io

from sqlalchemy import Float as SAFloat
from sqlalchemy import String, cast, func, select, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import get_settings
from db.models import Supplier, SupplierCategoryPricing, SupplierProductPrice
from services.masters_service import SHEET_MODEL_BY_KEY


@dataclass
class PriceBreakdown:
    catalog_table: str
    catalog_row_id: str
    supplier_id: str
    supplier_name: str
    list_price: float
    supplier_discount_pct: float
    cost_to_parth: float
    margin_multiplier: float
    parth_selling_price: float
    customer_discount_pct: float
    customer_discount_amount: float
    final_unit_price: float
    quantity: int
    line_total: float


def calculate_price(
    list_price: float,
    supplier_discount_pct: float,
    margin_multiplier: float,
    customer_discount_pct: float,
    quantity: int = 1,
) -> dict[str, Any]:
    """Pure pricing math — no database."""
    cost_to_parth = list_price * (1 - supplier_discount_pct / 100.0)
    parth_selling = cost_to_parth * margin_multiplier
    discount_amount = parth_selling * (customer_discount_pct / 100.0)
    final_price = parth_selling - discount_amount
    line_total = final_price * quantity
    return {
        "list_price": round(list_price, 2),
        "supplier_discount_pct": supplier_discount_pct,
        "cost_to_parth": round(cost_to_parth, 2),
        "margin_multiplier": margin_multiplier,
        "parth_selling_price": round(parth_selling, 2),
        "customer_discount_pct": customer_discount_pct,
        "customer_discount_amount": round(discount_amount, 2),
        "final_unit_price": round(final_price, 2),
        "quantity": quantity,
        "line_total": round(line_total, 2),
    }


async def get_price_for_product(
    supplier_id: str,
    catalog_table: str,
    catalog_row_id: str,
    db: AsyncSession,
) -> SupplierProductPrice | None:
    sid = uuid.UUID(supplier_id)
    rid = uuid.UUID(catalog_row_id)
    result = await db.execute(
        select(SupplierProductPrice)
        .options(selectinload(SupplierProductPrice.supplier))
        .where(
            SupplierProductPrice.supplier_id == sid,
            SupplierProductPrice.catalog_table == catalog_table,
            SupplierProductPrice.catalog_row_id == rid,
        )
    )
    return result.scalar_one_or_none()


async def get_supplier_category_pricing(
    supplier_id: uuid.UUID,
    category_key: str,
    db: AsyncSession,
) -> SupplierCategoryPricing | None:
    result = await db.execute(
        select(SupplierCategoryPricing).where(
            SupplierCategoryPricing.supplier_id == supplier_id,
            SupplierCategoryPricing.category_key == category_key,
        )
    )
    return result.scalar_one_or_none()


async def get_resolved_supplier_category_pricing(
    supplier_id: uuid.UUID,
    category_key: str,
    db: AsyncSession,
) -> dict[str, float]:
    """Resolve pricing vars for supplier+category, falling back to 'all' then defaults."""
    row = await get_supplier_category_pricing(supplier_id, category_key, db)
    if row is None and category_key != "all":
        row = await get_supplier_category_pricing(supplier_id, "all", db)
    margin = float(row.margin_multiplier) if row and row.margin_multiplier is not None else 1.4
    sup_disc = float(row.supplier_discount_pct) if row and row.supplier_discount_pct is not None else 0.0
    return {
        "margin_multiplier": margin,
        "supplier_discount_pct": sup_disc,
        "customer_discount_pct": 0.0,
    }


async def get_suppliers(client_id: str, db: AsyncSession, *, active_only: bool = True) -> list[Supplier]:
    q = select(Supplier).where(Supplier.client_id == client_id)
    if active_only:
        q = q.where(Supplier.is_active.is_(True))
    q = q.order_by(Supplier.name)
    result = await db.execute(q)
    return list(result.scalars().all())


async def bulk_get_prices(
    supplier_id: str,
    products: list[dict[str, str]],
    db: AsyncSession,
) -> dict[str, SupplierProductPrice]:
    if not products:
        return {}
    sid = uuid.UUID(supplier_id)
    pairs: list[tuple[str, uuid.UUID]] = []
    for p in products:
        ct = p.get("catalog_table") or ""
        cr = p.get("catalog_row_id") or ""
        if not ct or not cr:
            continue
        try:
            pairs.append((ct, uuid.UUID(cr)))
        except ValueError:
            continue
    if not pairs:
        return {}

    result = await db.execute(
        select(SupplierProductPrice)
        .options(selectinload(SupplierProductPrice.supplier))
        .where(
            SupplierProductPrice.supplier_id == sid,
            tuple_(SupplierProductPrice.catalog_table, SupplierProductPrice.catalog_row_id).in_(pairs),
        )
    )
    rows = result.scalars().all()
    return {f"{r.catalog_table}:{r.catalog_row_id}": r for r in rows}


async def create_supplier(
    client_id: str,
    name: str,
    primary_category_key: str,
    margin_multiplier: float | None,
    supplier_discount_pct: float | None,
    contact_person: str | None,
    phone: str | None,
    email: str | None,
    address: str | None,
    notes: str | None,
    db: AsyncSession,
) -> Supplier:
    supplier = Supplier(
        client_id=client_id,
        name=name,
        primary_category_key=primary_category_key or "all",
        default_discount_pct=float(supplier_discount_pct or 0.0),
        contact_person=contact_person,
        phone=phone,
        email=email,
        address=address,
        notes=notes,
    )
    db.add(supplier)
    await db.flush()

    # Create initial category pricing row (optional fields).
    db.add(
        SupplierCategoryPricing(
            supplier_id=supplier.id,
            category_key=(primary_category_key or "all"),
            margin_multiplier=margin_multiplier,
            supplier_discount_pct=supplier_discount_pct,
        )
    )
    await db.commit()
    await db.refresh(supplier)
    return supplier


async def update_supplier(
    supplier_id: uuid.UUID,
    client_id: str,
    db: AsyncSession,
    *,
    name: str | None = None,
    primary_category_key: str | None = None,
    contact_person: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    address: str | None = None,
    notes: str | None = None,
) -> Supplier | None:
    row = await db.get(Supplier, supplier_id)
    if row is None or row.client_id != client_id:
        return None
    if name is not None:
        row.name = name
    if primary_category_key is not None:
        row.primary_category_key = primary_category_key or "all"
    if contact_person is not None:
        row.contact_person = contact_person
    if phone is not None:
        row.phone = phone
    if email is not None:
        row.email = email
    if address is not None:
        row.address = address
    if notes is not None:
        row.notes = notes
    await db.commit()
    await db.refresh(row)
    return row


async def list_supplier_category_pricing(
    supplier_id: uuid.UUID,
    db: AsyncSession,
) -> list[SupplierCategoryPricing]:
    result = await db.execute(
        select(SupplierCategoryPricing)
        .where(SupplierCategoryPricing.supplier_id == supplier_id)
        .order_by(SupplierCategoryPricing.category_key)
    )
    return list(result.scalars().all())


async def upsert_supplier_category_pricing(
    supplier_id: uuid.UUID,
    category_key: str,
    db: AsyncSession,
    *,
    margin_multiplier: float | None = None,
    supplier_discount_pct: float | None = None,
) -> SupplierCategoryPricing:
    row = await get_supplier_category_pricing(supplier_id, category_key, db)
    if row is None:
        row = SupplierCategoryPricing(supplier_id=supplier_id, category_key=category_key)
        db.add(row)
        await db.flush()
    if margin_multiplier is not None:
        row.margin_multiplier = margin_multiplier
    if supplier_discount_pct is not None:
        row.supplier_discount_pct = supplier_discount_pct
    await db.commit()
    await db.refresh(row)
    return row


async def set_preferred_supplier(client_id: str, supplier_id: uuid.UUID, db: AsyncSession) -> Supplier | None:
    row = await db.get(Supplier, supplier_id)
    if row is None or row.client_id != client_id:
        return None
    await db.execute(update(Supplier).where(Supplier.client_id == client_id).values(is_preferred=False))
    row.is_preferred = True
    await db.commit()
    await db.refresh(row)
    return row


async def deactivate_supplier(supplier_id: uuid.UUID, client_id: str, db: AsyncSession) -> Supplier | None:
    row = await db.get(Supplier, supplier_id)
    if row is None or row.client_id != client_id:
        return None
    row.is_active = False
    row.is_preferred = False
    await db.commit()
    await db.refresh(row)
    return row


async def upsert_supplier_price(
    supplier_id: str,
    catalog_table: str,
    catalog_row_id: str,
    list_price_inr: float,
    discount_pct_override: float | None,
    db: AsyncSession,
) -> SupplierProductPrice:
    sid = uuid.UUID(supplier_id)
    rid = uuid.UUID(catalog_row_id)
    result = await db.execute(
        select(SupplierProductPrice).where(
            SupplierProductPrice.supplier_id == sid,
            SupplierProductPrice.catalog_table == catalog_table,
            SupplierProductPrice.catalog_row_id == rid,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.list_price_inr = list_price_inr
        existing.discount_pct_override = discount_pct_override
        row = existing
    else:
        row = SupplierProductPrice(
            supplier_id=sid,
            catalog_table=catalog_table,
            catalog_row_id=rid,
            list_price_inr=list_price_inr,
            discount_pct_override=discount_pct_override,
        )
        db.add(row)
    await db.commit()
    loaded = await db.execute(
        select(SupplierProductPrice)
        .options(selectinload(SupplierProductPrice.supplier))
        .where(SupplierProductPrice.id == row.id)
    )
    return loaded.scalar_one()


async def bulk_upsert_supplier_prices(
    supplier_id: str,
    prices: list[dict[str, Any]],
    db: AsyncSession,
) -> dict[str, int]:
    created = 0
    updated = 0
    failed = 0
    for p in prices:
        try:
            ct = str(p["catalog_table"])
            cr = str(p["catalog_row_id"])
            lp = float(p["list_price_inr"])
            ov = p.get("discount_pct_override")
            ov_f = float(ov) if ov is not None else None
            result = await db.execute(
                select(SupplierProductPrice).where(
                    SupplierProductPrice.supplier_id == uuid.UUID(supplier_id),
                    SupplierProductPrice.catalog_table == ct,
                    SupplierProductPrice.catalog_row_id == uuid.UUID(cr),
                )
            )
            ex = result.scalar_one_or_none()
            if ex:
                ex.list_price_inr = lp
                ex.discount_pct_override = ov_f
                updated += 1
            else:
                db.add(
                    SupplierProductPrice(
                        supplier_id=uuid.UUID(supplier_id),
                        catalog_table=ct,
                        catalog_row_id=uuid.UUID(cr),
                        list_price_inr=lp,
                        discount_pct_override=ov_f,
                    )
                )
                created += 1
        except Exception:
            failed += 1
    await db.commit()
    return {"created": created, "updated": updated, "failed": failed}


async def list_supplier_prices(
    supplier_id: uuid.UUID,
    client_id: str,
    db: AsyncSession,
    *,
    catalog_table: str | None = None,
) -> list[SupplierProductPrice]:
    sup = await db.get(Supplier, supplier_id)
    if sup is None or sup.client_id != client_id:
        return []
    q = (
        select(SupplierProductPrice)
        .options(selectinload(SupplierProductPrice.supplier))
        .where(SupplierProductPrice.supplier_id == supplier_id)
    )
    if catalog_table:
        q = q.where(SupplierProductPrice.catalog_table == catalog_table)
    q = q.order_by(SupplierProductPrice.catalog_table, SupplierProductPrice.catalog_row_id)
    result = await db.execute(q)
    return list(result.scalars().all())


async def update_pricing_config(*_args, **_kwargs):  # type: ignore[no-untyped-def]
    """Legacy no-op: pricing config moved to supplier-category pricing."""
    raise NotImplementedError("Client pricing config has been deprecated. Use supplier-category pricing instead.")


async def get_supplier_or_none(supplier_id: uuid.UUID, client_id: str, db: AsyncSession) -> Supplier | None:
    row = await db.get(Supplier, supplier_id)
    if row is None or row.client_id != client_id:
        return None
    return row


_SKIP_DESC = frozenset(
    {
        "row_id",
        "client_id",
        "created_at",
        "updated_at",
        "source_file",
        "price_inr",
        "sr_no",
        "product_sheet",
    }
)


def catalog_model_for_table(catalog_table: str) -> type | None:
    return SHEET_MODEL_BY_KEY.get(catalog_table)


def parse_supplier_xlsx_to_rows(content: bytes, column_map: dict[str, str]) -> list[dict[str, str]]:
    """Parse first worksheet of an .xlsx file into row dicts using ``column_map`` (Excel header → our field)."""
    import openpyxl

    lookup = {str(k).strip().lstrip("\ufeff"): str(v).strip() for k, v in (column_map or {}).items() if k is not None}

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    try:
        ws = wb.active
        headers: list[str] = []
        parsed: list[dict[str, str]] = []
        for row_idx, row in enumerate(ws.iter_rows(values_only=True)):
            if row_idx == 0:
                headers = [
                    str(c).strip().lstrip("\ufeff") if c is not None else "" for c in row
                ]
                continue
            if not row or not any(c is not None and str(c).strip() != "" for c in row):
                continue
            row_dict: dict[str, str] = {}
            for col_idx, value in enumerate(row):
                if col_idx >= len(headers):
                    break
                excel_col = headers[col_idx]
                if not excel_col:
                    continue
                our_field = lookup.get(excel_col.strip(), excel_col.strip())
                if not our_field or not str(our_field).strip():
                    continue
                if value is None:
                    continue
                s = str(value).strip()
                if s:
                    row_dict[str(our_field).strip()] = s
            if row_dict:
                parsed.append(row_dict)
        return parsed
    finally:
        wb.close()


def _norm_price_value(raw: str | float | int | None) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip().replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


async def match_catalog_row(
    catalog_table: str,
    spec_filters: dict[str, str],
    db: AsyncSession,
) -> tuple[str | None, str | None]:
    """
    Exact match on catalog columns (case-insensitive string compare for text).
    Returns (row_id_str, None) on unique match, or (None, reason) on miss/ambiguous.
    """
    model = catalog_model_for_table(catalog_table)
    if model is None:
        return None, "unknown_catalog_table"

    client_id = active_client_id()
    stmt = select(model.row_id).where(model.client_id == client_id)

    reserved = frozenset({"price", "discount_override", "__skip__"})
    applied = 0
    for col_name, raw_val in spec_filters.items():
        if col_name in reserved:
            continue
        if not raw_val or not str(raw_val).strip():
            continue
        col = getattr(model, col_name, None)
        if col is None:
            continue
        col_t = model.__table__.columns.get(col_name)
        if col_t is None:
            continue
        v = str(raw_val).strip()
        if isinstance(col_t.type, SAFloat):
            try:
                fv = float(v.replace(",", ""))
            except ValueError:
                return None, "invalid_numeric_filter"
            stmt = stmt.where(col == fv)
        else:
            stmt = stmt.where(func.lower(func.trim(cast(col, String))) == v.lower())
        applied += 1

    if applied == 0:
        return None, "no_spec_filters"

    stmt = stmt.limit(3)
    result = await db.execute(stmt)
    ids = list(result.scalars().all())
    if len(ids) == 1:
        return str(ids[0]), None
    if len(ids) == 0:
        return None, "no_catalog_match"
    return None, "ambiguous_catalog_match"


async def describe_catalog_row(catalog_table: str, row_id: uuid.UUID, db: AsyncSession) -> str:
    model = catalog_model_for_table(catalog_table)
    if model is None:
        return ""
    client_id = active_client_id()
    r = await db.execute(select(model).where(model.row_id == row_id, model.client_id == client_id))
    obj = r.scalar_one_or_none()
    if obj is None:
        return ""
    parts: list[str] = []
    for c in model.__table__.columns.keys():
        if c in _SKIP_DESC:
            continue
        val = getattr(obj, c, None)
        if val is None or (isinstance(val, str) and not val.strip()):
            continue
        parts.append(str(val).strip())
    return " | ".join(parts) if parts else str(row_id)


async def preview_supplier_pricelist(
    supplier_id: str,
    catalog_table: str,
    rows: list[dict[str, Any]],
    db: AsyncSession,
) -> dict[str, Any]:
    """Match rows to catalog; does not write."""
    preview_rows: list[dict[str, Any]] = []
    will_match = 0
    will_fail = 0
    will_update = 0
    will_create = 0

    for raw in rows:
        excel_data = {k: str(v).strip() if v is not None else "" for k, v in raw.items()}
        row = dict(raw)
        price_f = _norm_price_value(row.pop("price", None))
        row.pop("discount_override", None)

        if price_f is None:
            will_fail += 1
            preview_rows.append(
                {
                    "excel_data": excel_data,
                    "matched_catalog": None,
                    "price": None,
                    "status": "no_match",
                    "reason": "no price column",
                }
            )
            continue

        rid, reason = await match_catalog_row(catalog_table, row, db)
        if rid is None:
            will_fail += 1
            preview_rows.append(
                {
                    "excel_data": excel_data,
                    "matched_catalog": None,
                    "price": price_f,
                    "status": "no_match",
                    "reason": reason or "no_catalog_match",
                }
            )
            continue

        uid = uuid.UUID(rid)
        desc = await describe_catalog_row(catalog_table, uid, db)
        existing = await get_price_for_product(supplier_id, catalog_table, rid, db)
        if existing:
            status = "will_update"
            will_update += 1
        else:
            status = "will_create"
            will_create += 1
        will_match += 1
        preview_rows.append(
            {
                "excel_data": excel_data,
                "matched_catalog": {"row_id": rid, "description": desc},
                "price": price_f,
                "status": status,
                "reason": None,
            }
        )

    return {
        "total": len(rows),
        "will_match": will_match,
        "will_fail": will_fail,
        "will_update": will_update,
        "will_create": will_create,
        "preview_rows": preview_rows,
    }


async def import_supplier_pricelist(
    supplier_id: str,
    catalog_table: str,
    rows: list[dict[str, Any]],
    db: AsyncSession,
) -> dict[str, Any]:
    """Bulk import prices; single commit at end."""
    results: dict[str, Any] = {
        "total": len(rows),
        "matched": 0,
        "unmatched": 0,
        "updated": 0,
        "created": 0,
        "unmatched_rows": [],
    }
    sid = uuid.UUID(supplier_id)

    for raw in rows:
        snap = {k: str(v).strip() if v is not None else "" for k, v in raw.items()}
        row = dict(raw)
        price_f = _norm_price_value(row.pop("price", None))
        disc_raw = row.pop("discount_override", None)
        disc_f: float | None
        if disc_raw is None or str(disc_raw).strip() == "":
            disc_f = None
        else:
            try:
                disc_f = float(str(disc_raw).replace(",", ""))
            except ValueError:
                disc_f = None

        if price_f is None:
            results["unmatched"] += 1
            results["unmatched_rows"].append({**snap, "reason": "no price column"})
            continue

        rid, reason = await match_catalog_row(catalog_table, row, db)
        if rid is None:
            results["unmatched"] += 1
            results["unmatched_rows"].append({**snap, "reason": reason or "no_catalog_match"})
            continue

        result = await db.execute(
            select(SupplierProductPrice).where(
                SupplierProductPrice.supplier_id == sid,
                SupplierProductPrice.catalog_table == catalog_table,
                SupplierProductPrice.catalog_row_id == uuid.UUID(rid),
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.list_price_inr = float(price_f)
            existing.discount_pct_override = disc_f
            results["updated"] += 1
        else:
            db.add(
                SupplierProductPrice(
                    supplier_id=sid,
                    catalog_table=catalog_table,
                    catalog_row_id=uuid.UUID(rid),
                    list_price_inr=float(price_f),
                    discount_pct_override=disc_f,
                )
            )
            await db.flush()
            results["created"] += 1
        results["matched"] += 1

    await db.commit()
    return results


def active_client_id() -> str:
    return get_settings().ACTIVE_CLIENT
