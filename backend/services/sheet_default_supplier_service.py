"""Per masters-sheet default supplier (catalog_table + optional nav_slug)."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models import MasterSheetDefaultSupplier, Supplier
from masters.product_master import SHEET_TABLES
from services.masters_service import MASTERS_HIDDEN_SHEET_KEYS
from services.pricing_service import active_client_id, get_supplier_or_none

VALID_CATALOG_TABLES = frozenset(
    k for k, _ in SHEET_TABLES if k not in MASTERS_HIDDEN_SHEET_KEYS
)


def normalize_nav_slug(nav_slug: str | None) -> str:
    return (nav_slug or "").strip()


def validate_catalog_table(catalog_table: str) -> str:
    key = (catalog_table or "").strip()
    if key not in VALID_CATALOG_TABLES:
        raise ValueError(f"Unknown sheet: {key}")
    return key


async def get_sheet_default_supplier_row(
    client_id: str,
    catalog_table: str,
    nav_slug: str | None,
    db: AsyncSession,
) -> MasterSheetDefaultSupplier | None:
    table = validate_catalog_table(catalog_table)
    slug = normalize_nav_slug(nav_slug)
    result = await db.execute(
        select(MasterSheetDefaultSupplier)
        .options(selectinload(MasterSheetDefaultSupplier.supplier))
        .where(
            MasterSheetDefaultSupplier.client_id == client_id,
            MasterSheetDefaultSupplier.catalog_table == table,
            MasterSheetDefaultSupplier.nav_slug == slug,
        )
    )
    row = result.scalar_one_or_none()
    if row is not None or not slug:
        return row
    result = await db.execute(
        select(MasterSheetDefaultSupplier)
        .options(selectinload(MasterSheetDefaultSupplier.supplier))
        .where(
            MasterSheetDefaultSupplier.client_id == client_id,
            MasterSheetDefaultSupplier.catalog_table == table,
            MasterSheetDefaultSupplier.nav_slug == "",
        )
    )
    return result.scalar_one_or_none()


async def list_sheet_default_suppliers(
    client_id: str,
    db: AsyncSession,
) -> list[MasterSheetDefaultSupplier]:
    result = await db.execute(
        select(MasterSheetDefaultSupplier)
        .options(selectinload(MasterSheetDefaultSupplier.supplier))
        .where(MasterSheetDefaultSupplier.client_id == client_id)
        .order_by(
            MasterSheetDefaultSupplier.catalog_table,
            MasterSheetDefaultSupplier.nav_slug,
        )
    )
    return list(result.scalars().all())


async def set_sheet_default_supplier(
    client_id: str,
    catalog_table: str,
    nav_slug: str | None,
    supplier_id: uuid.UUID,
    db: AsyncSession,
) -> MasterSheetDefaultSupplier:
    table = validate_catalog_table(catalog_table)
    slug = normalize_nav_slug(nav_slug)
    if await get_supplier_or_none(supplier_id, client_id, db) is None:
        raise ValueError("Supplier not found")

    result = await db.execute(
        select(MasterSheetDefaultSupplier).where(
            MasterSheetDefaultSupplier.client_id == client_id,
            MasterSheetDefaultSupplier.catalog_table == table,
            MasterSheetDefaultSupplier.nav_slug == slug,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = MasterSheetDefaultSupplier(
            client_id=client_id,
            catalog_table=table,
            nav_slug=slug,
            supplier_id=supplier_id,
        )
        db.add(row)
    else:
        row.supplier_id = supplier_id
    await db.commit()
    await db.refresh(row, attribute_names=["supplier"])
    return row


async def clear_sheet_default_supplier(
    client_id: str,
    catalog_table: str,
    nav_slug: str | None,
    db: AsyncSession,
) -> bool:
    table = validate_catalog_table(catalog_table)
    slug = normalize_nav_slug(nav_slug)
    result = await db.execute(
        select(MasterSheetDefaultSupplier).where(
            MasterSheetDefaultSupplier.client_id == client_id,
            MasterSheetDefaultSupplier.catalog_table == table,
            MasterSheetDefaultSupplier.nav_slug == slug,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return False
    await db.execute(delete(MasterSheetDefaultSupplier).where(MasterSheetDefaultSupplier.id == row.id))
    await db.commit()
    return True


def row_to_dict(row: MasterSheetDefaultSupplier | None) -> dict | None:
    if row is None:
        return None
    supplier: Supplier | None = row.supplier
    return {
        "catalog_table": row.catalog_table,
        "nav_slug": row.nav_slug or None,
        "supplier_id": str(row.supplier_id),
        "supplier_name": supplier.name if supplier else None,
    }


async def resolve_sheet_default_supplier(
    catalog_table: str,
    nav_slug: str | None,
    db: AsyncSession,
) -> dict | None:
    client_id = active_client_id()
    row = await get_sheet_default_supplier_row(client_id, catalog_table, nav_slug, db)
    if row is None:
        return None
    if row.supplier is not None and not row.supplier.is_active:
        return None
    return row_to_dict(row)
