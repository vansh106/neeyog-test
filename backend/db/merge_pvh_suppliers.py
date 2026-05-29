"""Merge duplicate suppliers PVH-S01 and PVH-A01 into a single supplier PVH.

- Creates supplier ``PVH`` (if missing)
- Copies all ``supplier_product_prices`` from both legacy suppliers
- Copies ``supplier_category_pricing`` rows
- Points butterfly sheet defaults (hygienic-pvh, aluminium-pvh) to PVH
- Updates ``client_pricing_configs.default_supplier_id`` when it referenced a legacy id
- Deletes PVH-S01 and PVH-A01 (prices cascade away after copy)

Usage (from ``backend/``):
  python -m db.merge_pvh_suppliers --dry-run
  python -m db.merge_pvh_suppliers
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import uuid
from pathlib import Path

from sqlalchemy import delete, func, select, update

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import get_settings  # noqa: E402
from core.database import async_session_factory, init_db  # noqa: E402
from db.models import (  # noqa: E402
    ClientPricingConfig,
    MasterSheetDefaultSupplier,
    Supplier,
    SupplierCategoryPricing,
    SupplierProductPrice,
)

logger = logging.getLogger(__name__)

LEGACY_NAMES = ("PVH-S01", "PVH-A01")
TARGET_NAME = "PVH"
BUTTERFLY_NAV_SLUGS = ("hygienic-pvh", "aluminium-pvh")
BUTTERFLY_CATALOG = "butterfly_valve"


async def _find_supplier_by_name(session, client_id: str, name: str) -> Supplier | None:
    result = await session.execute(
        select(Supplier).where(
            Supplier.client_id == client_id,
            func.lower(Supplier.name) == name.strip().lower(),
        )
    )
    return result.scalar_one_or_none()


async def _run(dry_run: bool) -> None:
    settings = get_settings()
    client_id = settings.ACTIVE_CLIENT

    await init_db()
    async with async_session_factory() as session:
        legacy: list[Supplier] = []
        for name in LEGACY_NAMES:
            s = await _find_supplier_by_name(session, client_id, name)
            if s is None:
                raise RuntimeError(f"Supplier {name!r} not found for client {client_id}")
            legacy.append(s)

        target = await _find_supplier_by_name(session, client_id, TARGET_NAME)
        if target is None:
            template = legacy[0]
            target = Supplier(
                client_id=client_id,
                name=TARGET_NAME,
                primary_category_key=template.primary_category_key,
                contact_person=template.contact_person,
                phone=template.phone,
                email=template.email,
                address=template.address,
                notes=template.notes,
                default_discount_pct=template.default_discount_pct,
                is_active=True,
                is_preferred=any(s.is_preferred for s in legacy),
            )
            if not dry_run:
                session.add(target)
                await session.flush()
            logger.info("Will create supplier %s", TARGET_NAME)
        else:
            logger.info("Using existing supplier %s (%s)", target.name, target.id)

        if target.id is None and dry_run:
            target_id = uuid.uuid4()
        else:
            target_id = target.id
            assert target_id is not None

        price_stats = {"copied": 0, "skipped_existing": 0}
        for old in legacy:
            prices = (
                await session.execute(
                    select(SupplierProductPrice).where(SupplierProductPrice.supplier_id == old.id)
                )
            ).scalars().all()
            for p in prices:
                exists = (
                    await session.execute(
                        select(SupplierProductPrice.id).where(
                            SupplierProductPrice.supplier_id == target_id,
                            SupplierProductPrice.catalog_table == p.catalog_table,
                            SupplierProductPrice.catalog_row_id == p.catalog_row_id,
                        )
                    )
                ).scalar_one_or_none()
                if exists:
                    price_stats["skipped_existing"] += 1
                    continue
                if dry_run:
                    price_stats["copied"] += 1
                    continue
                session.add(
                    SupplierProductPrice(
                        supplier_id=target_id,
                        catalog_table=p.catalog_table,
                        catalog_row_id=p.catalog_row_id,
                        list_price_inr=p.list_price_inr,
                        discount_pct_override=p.discount_pct_override,
                    )
                )
                price_stats["copied"] += 1

        cat_stats = {"copied": 0}
        seen_categories: set[str] = set()
        if not dry_run and target.id:
            existing_cats = (
                await session.execute(
                    select(SupplierCategoryPricing.category_key).where(
                        SupplierCategoryPricing.supplier_id == target_id
                    )
                )
            ).scalars().all()
            seen_categories = set(existing_cats)

        for old in legacy:
            rows = (
                await session.execute(
                    select(SupplierCategoryPricing).where(SupplierCategoryPricing.supplier_id == old.id)
                )
            ).scalars().all()
            for cp in rows:
                if cp.category_key in seen_categories:
                    continue
                seen_categories.add(cp.category_key)
                if dry_run:
                    cat_stats["copied"] += 1
                    continue
                session.add(
                    SupplierCategoryPricing(
                        supplier_id=target_id,
                        category_key=cp.category_key,
                        margin_multiplier=cp.margin_multiplier,
                        supplier_discount_pct=cp.supplier_discount_pct,
                        customer_discount_pct=cp.customer_discount_pct,
                    )
                )
                cat_stats["copied"] += 1

        default_rows = (
            await session.execute(
                select(MasterSheetDefaultSupplier).where(
                    MasterSheetDefaultSupplier.client_id == client_id,
                    MasterSheetDefaultSupplier.supplier_id.in_([s.id for s in legacy]),
                )
            )
        ).scalars().all()

        for nav in BUTTERFLY_NAV_SLUGS:
            row = next(
                (r for r in default_rows if r.catalog_table == BUTTERFLY_CATALOG and r.nav_slug == nav),
                None,
            )
            if row is None:
                logger.warning("No default supplier row for nav %r (will create)", nav)
                if not dry_run and target.id:
                    session.add(
                        MasterSheetDefaultSupplier(
                            client_id=client_id,
                            catalog_table=BUTTERFLY_CATALOG,
                            nav_slug=nav,
                            supplier_id=target_id,
                        )
                    )
            else:
                logger.info(
                    "Default %s / %s: %s -> %s",
                    BUTTERFLY_CATALOG,
                    nav,
                    next(s.name for s in legacy if s.id == row.supplier_id),
                    TARGET_NAME,
                )
                if not dry_run:
                    row.supplier_id = target_id

        legacy_ids = [s.id for s in legacy]
        if not dry_run:
            await session.execute(
                update(ClientPricingConfig)
                .where(ClientPricingConfig.default_supplier_id.in_(legacy_ids))
                .values(default_supplier_id=target_id)
            )
            await session.execute(delete(Supplier).where(Supplier.id.in_(legacy_ids)))
        else:
            cfg_count = (
                await session.execute(
                    select(func.count())
                    .select_from(ClientPricingConfig)
                    .where(ClientPricingConfig.default_supplier_id.in_(legacy_ids))
                )
            ).scalar_one()
            if cfg_count:
                logger.info("Would update %d client_pricing_configs rows", cfg_count)

        if dry_run:
            logger.info(
                "Dry run: prices copied=%d skipped=%d category_rows=%d defaults=%d delete=%s",
                price_stats["copied"],
                price_stats["skipped_existing"],
                cat_stats["copied"],
                len(default_rows),
                LEGACY_NAMES,
            )
            return

        await session.commit()
        final_count = (
            await session.execute(
                select(func.count())
                .select_from(SupplierProductPrice)
                .where(SupplierProductPrice.supplier_id == target_id)
            )
        ).scalar_one()
        logger.info(
            "Done. %s has %d product prices. Removed suppliers %s.",
            TARGET_NAME,
            final_count,
            ", ".join(LEGACY_NAMES),
        )


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    p = argparse.ArgumentParser(description="Merge PVH-S01 + PVH-A01 into PVH")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    asyncio.run(_run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
