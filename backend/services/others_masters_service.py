"""CRUD for dynamic Others product family (categories, sheets, rows)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import get_settings
from db.others_models import (
    OTHERS_CATALOG_PREFIX,
    OthersCategory,
    OthersSheet,
    OthersSheetRow,
    is_others_catalog_key,
    others_catalog_key_for_sheet_id,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _client_id() -> str:
    return get_settings().ACTIVE_CLIENT


def _jsonable(v: Any) -> Any:
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    return v


def _category_dict(cat: OthersCategory) -> dict[str, Any]:
    sheets = cat.__dict__.get("sheets")
    sheet_list = [_sheet_dict(s) for s in sheets] if isinstance(sheets, list) else []
    return {
        "id": str(cat.id),
        "name": cat.name,
        "sort_order": cat.sort_order,
        "sheets": sheet_list,
    }


def _sheet_dict(sheet: OthersSheet) -> dict[str, Any]:
    rows = sheet.__dict__.get("rows")
    row_count = len(rows) if isinstance(rows, list) else 0
    return {
        "id": str(sheet.id),
        "category_id": str(sheet.category_id),
        "name": sheet.name,
        "catalog_key": sheet.catalog_key,
        "sort_order": sheet.sort_order,
        "row_count": row_count,
    }


def _row_dict(row: OthersSheetRow) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "row_id": str(row.id),
        "sheet_id": str(row.sheet_id),
        "sr_no": row.sr_no,
        "description": row.description,
        "price_inr": row.price_inr,
    }


def _catalog_row_dict(row: OthersSheetRow) -> dict[str, Any]:
    """Shape for configurator / full-category-catalog."""
    return {
        "row_id": str(row.id),
        "id": str(row.id),
        "client_id": row.client_id,
        "sr_no": row.sr_no,
        "description": row.description,
        "price_inr": row.price_inr,
    }


async def get_tree(db: AsyncSession) -> list[dict[str, Any]]:
    client_id = _client_id()
    q = (
        select(OthersCategory)
        .where(OthersCategory.client_id == client_id)
        .options(selectinload(OthersCategory.sheets).selectinload(OthersSheet.rows))
        .order_by(OthersCategory.sort_order, OthersCategory.name)
    )
    cats = (await db.execute(q)).scalars().all()
    for cat in cats:
        cat.sheets.sort(key=lambda s: (s.sort_order, s.name.lower()))
    return [_category_dict(c) for c in cats]


async def create_category(db: AsyncSession, name: str) -> dict[str, Any]:
    name = name.strip()
    if not name:
        raise ValueError("Category name is required")
    client_id = _client_id()
    max_order = (
        await db.execute(
            select(func.coalesce(func.max(OthersCategory.sort_order), -1)).where(
                OthersCategory.client_id == client_id
            )
        )
    ).scalar_one()
    cat = OthersCategory(
        client_id=client_id,
        name=name,
        sort_order=int(max_order) + 1,
    )
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return {
        "id": str(cat.id),
        "name": cat.name,
        "sort_order": cat.sort_order,
        "sheets": [],
    }


async def update_category(db: AsyncSession, category_id: str, name: str) -> dict[str, Any]:
    name = name.strip()
    if not name:
        raise ValueError("Category name is required")
    cat = await _get_category(db, category_id)
    cat.name = name
    cat.updated_at = _utcnow()
    await db.commit()
    await db.refresh(cat, attribute_names=["sheets"])
    return _category_dict(cat)


async def delete_category(db: AsyncSession, category_id: str) -> None:
    cat = await _get_category(db, category_id)
    await db.delete(cat)
    await db.commit()


async def create_sheet(db: AsyncSession, category_id: str, name: str) -> dict[str, Any]:
    name = name.strip()
    if not name:
        raise ValueError("Sheet name is required")
    cat = await _get_category(db, category_id)
    client_id = _client_id()
    sheet_id = uuid.uuid4()
    max_order = (
        await db.execute(
            select(func.coalesce(func.max(OthersSheet.sort_order), -1)).where(
                OthersSheet.category_id == cat.id
            )
        )
    ).scalar_one()
    sheet = OthersSheet(
        id=sheet_id,
        client_id=client_id,
        category_id=cat.id,
        name=name,
        catalog_key=others_catalog_key_for_sheet_id(sheet_id),
        sort_order=int(max_order) + 1,
    )
    db.add(sheet)
    await db.flush()
    await db.refresh(sheet)
    return {
        "id": str(sheet.id),
        "category_id": str(sheet.category_id),
        "name": sheet.name,
        "catalog_key": sheet.catalog_key,
        "sort_order": sheet.sort_order,
        "row_count": 0,
    }


async def update_sheet(db: AsyncSession, sheet_id: str, name: str) -> dict[str, Any]:
    name = name.strip()
    if not name:
        raise ValueError("Sheet name is required")
    sheet = await _get_sheet(db, sheet_id)
    sheet.name = name
    sheet.updated_at = _utcnow()
    await db.commit()
    await db.refresh(sheet)
    return _sheet_dict(sheet)


async def delete_sheet(db: AsyncSession, sheet_id: str) -> None:
    sheet = await _get_sheet(db, sheet_id)
    await db.delete(sheet)
    await db.commit()


async def list_rows(db: AsyncSession, sheet_id: str) -> list[dict[str, Any]]:
    sheet = await _get_sheet(db, sheet_id)
    q = (
        select(OthersSheetRow)
        .where(OthersSheetRow.sheet_id == sheet.id, OthersSheetRow.client_id == _client_id())
        .order_by(OthersSheetRow.sr_no.asc().nulls_last(), OthersSheetRow.description.asc().nulls_last())
    )
    rows = (await db.execute(q)).scalars().all()
    return [_row_dict(r) for r in rows]


async def create_row(
    db: AsyncSession,
    sheet_id: str,
    *,
    sr_no: float | None = None,
    description: str | None = None,
    price_inr: float | None = None,
) -> dict[str, Any]:
    sheet = await _get_sheet(db, sheet_id)
    desc = (description or "").strip()
    if not desc:
        raise ValueError("Description is required")
    row = OthersSheetRow(
        client_id=_client_id(),
        sheet_id=sheet.id,
        sr_no=sr_no,
        description=desc,
        price_inr=price_inr,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _row_dict(row)


async def update_row(
    db: AsyncSession,
    row_id: str,
    *,
    sr_no: float | None = None,
    description: str | None = None,
    price_inr: float | None = None,
    clear_sr_no: bool = False,
    clear_price: bool = False,
) -> dict[str, Any]:
    row = await _get_row(db, row_id)
    if clear_sr_no:
        row.sr_no = None
    elif sr_no is not None:
        row.sr_no = sr_no
    if description is not None:
        desc = description.strip()
        if not desc:
            raise ValueError("Description is required")
        row.description = desc
    if clear_price:
        row.price_inr = None
    elif price_inr is not None:
        row.price_inr = price_inr
    row.updated_at = _utcnow()
    await db.commit()
    await db.refresh(row)
    return _row_dict(row)


async def delete_row(db: AsyncSession, row_id: str) -> None:
    row = await _get_row(db, row_id)
    await db.delete(row)
    await db.commit()


async def get_sheet_by_catalog_key(db: AsyncSession, catalog_key: str) -> OthersSheet | None:
    if not is_others_catalog_key(catalog_key):
        return None
    client_id = _client_id()
    q = select(OthersSheet).where(
        OthersSheet.client_id == client_id,
        OthersSheet.catalog_key == catalog_key,
    )
    return (await db.execute(q)).scalar_one_or_none()


async def get_full_catalog_for_key(db: AsyncSession, catalog_key: str) -> list[dict[str, Any]]:
    sheet = await get_sheet_by_catalog_key(db, catalog_key)
    if sheet is None:
        return []
    q = (
        select(OthersSheetRow)
        .where(OthersSheetRow.sheet_id == sheet.id, OthersSheetRow.client_id == _client_id())
        .order_by(OthersSheetRow.sr_no.asc().nulls_last(), OthersSheetRow.description.asc().nulls_last())
    )
    rows = (await db.execute(q)).scalars().all()
    return [_catalog_row_dict(r) for r in rows]


async def get_sheet_label(db: AsyncSession, catalog_key: str) -> str | None:
    sheet = await get_sheet_by_catalog_key(db, catalog_key)
    return sheet.name if sheet else None


async def list_catalog_categories(db: AsyncSession) -> list[dict[str, str | int]]:
    """Others sheets as catalog categories for masters listing."""
    client_id = _client_id()
    q = (
        select(OthersSheet)
        .where(OthersSheet.client_id == client_id)
        .order_by(OthersSheet.name)
    )
    sheets = (await db.execute(q)).scalars().all()
    out: list[dict[str, str | int]] = []
    for sheet in sheets:
        count = (
            await db.execute(
                select(func.count())
                .select_from(OthersSheetRow)
                .where(OthersSheetRow.sheet_id == sheet.id, OthersSheetRow.client_id == client_id)
            )
        ).scalar_one()
        out.append(
            {
                "key": sheet.catalog_key,
                "label": f"Others — {sheet.name}",
                "count": int(count or 0),
            }
        )
    return out


async def _get_category(db: AsyncSession, category_id: str) -> OthersCategory:
    try:
        cid = uuid.UUID(category_id)
    except ValueError as e:
        raise ValueError("Invalid category id") from e
    q = (
        select(OthersCategory)
        .where(OthersCategory.id == cid, OthersCategory.client_id == _client_id())
        .options(selectinload(OthersCategory.sheets))
    )
    cat = (await db.execute(q)).scalar_one_or_none()
    if cat is None:
        raise ValueError("Category not found")
    return cat


async def _get_sheet(db: AsyncSession, sheet_id: str) -> OthersSheet:
    try:
        sid = uuid.UUID(sheet_id)
    except ValueError as e:
        raise ValueError("Invalid sheet id") from e
    q = select(OthersSheet).where(OthersSheet.id == sid, OthersSheet.client_id == _client_id())
    sheet = (await db.execute(q)).scalar_one_or_none()
    if sheet is None:
        raise ValueError("Sheet not found")
    return sheet


async def _get_row(db: AsyncSession, row_id: str) -> OthersSheetRow:
    try:
        rid = uuid.UUID(row_id)
    except ValueError as e:
        raise ValueError("Invalid row id") from e
    q = select(OthersSheetRow).where(OthersSheetRow.id == rid, OthersSheetRow.client_id == _client_id())
    row = (await db.execute(q)).scalar_one_or_none()
    if row is None:
        raise ValueError("Row not found")
    return row


OTHERS_CASCADE_STEPS = ["description"]
