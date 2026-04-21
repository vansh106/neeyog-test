"""Idempotent seeder for valve-assembly accessory tables.

Parth catalog accessory data lives in the existing `catalog_*` tables
(`catalog_operator`, `catalog_brackets_coupler`, `catalog_sov`,
`catalog_limit_switch_box`, `catalog_positioner`).

This script fills them with the Parth revamp values **only when empty** so
running it multiple times is safe. Use `--force` to truncate and reinsert.

Usage:
    python -m db.seed_accessories                   # insert if empty
    python -m db.seed_accessories --force           # wipe + reseed
    python -m db.seed_accessories --client-id foo   # custom client
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, func, select  # noqa: E402

from core.database import async_session_factory, init_db  # noqa: E402
from db.sheet_models import (  # noqa: E402
    CatalogBracketsCouplerRow,
    CatalogLimitSwitchRow,
    CatalogOperatorRow,
    CatalogPositionerRow,
    CatalogSovRow,
)

logger = logging.getLogger(__name__)


# ── Source-of-truth data (from the revamp workbook) ──────────────────────
OPERATOR_DATA = [
    # Ball Valve 2 Way
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '1/2"', "model_name": "DA55", "base_price": 3999},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '1/2"', "model_name": "SA55", "base_price": 4862},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '3/4"', "model_name": "DA55", "base_price": 3999},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '3/4"', "model_name": "SA55", "base_price": 4862},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '1"', "model_name": "DA55", "base_price": 3999},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '1"', "model_name": "SA65", "base_price": 6051},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '1 1/4"', "model_name": "DA55", "base_price": 3999},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '1 1/4"', "model_name": "SA75", "base_price": 7323},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '1 1/2"', "model_name": "DA55", "base_price": 3999},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '1 1/2"', "model_name": "SA75", "base_price": 7323},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '2"', "model_name": "DA65", "base_price": 5041},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '2"', "model_name": "SA85", "base_price": 9202},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '2 1/2"', "model_name": "DA75", "base_price": 5985},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '2 1/2"', "model_name": "SA100", "base_price": 12000},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '3"', "model_name": "DA85", "base_price": 7552},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '3"', "model_name": "SA115", "base_price": 16074},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '4"', "model_name": "DA115", "base_price": 13371},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '4"', "model_name": "SA150", "base_price": 31911},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '5"', "model_name": "DA125", "base_price": 16184},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '5"', "model_name": "SA150", "base_price": 31911},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '6"', "model_name": "DA150", "base_price": 25837},
    {"operator_for": "Ball Valve", "construct": "2 Way", "size": '6"', "model_name": "SA200", "base_price": 70602},
    # Ball Valve 3 Way
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '1/2"', "model_name": "DA55", "base_price": 3999},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '1/2"', "model_name": "SA55", "base_price": 4862},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '3/4"', "model_name": "DA55", "base_price": 3999},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '3/4"', "model_name": "SA55", "base_price": 4862},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '1"', "model_name": "DA55", "base_price": 3999},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '1"', "model_name": "SA65", "base_price": 6051},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '1 1/4"', "model_name": "DA55", "base_price": 3999},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '1 1/4"', "model_name": "SA75", "base_price": 7323},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '1 1/2"', "model_name": "DA65", "base_price": 5041},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '1 1/2"', "model_name": "SA85", "base_price": 9202},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '2"', "model_name": "DA75", "base_price": 5985},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '2"', "model_name": "SA100", "base_price": 12000},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '2 1/2"', "model_name": "DA85", "base_price": 7552},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '2 1/2"', "model_name": "SA115", "base_price": 16074},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '3"', "model_name": "DA100", "base_price": 9831},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '3"', "model_name": "SA125", "base_price": 20119},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '4"', "model_name": "DA125", "base_price": 16184},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '4"', "model_name": "SA150", "base_price": 31911},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '5"', "model_name": "DA150", "base_price": 25837},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '5"', "model_name": "SA200", "base_price": 70602},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '6"', "model_name": "DA150", "base_price": 25837},
    {"operator_for": "Ball Valve", "construct": "3 Way", "size": '6"', "model_name": "SA200", "base_price": 70602},
]

BRACKET_COUPLER_DATA = [
    {"operator": "Ball Valve", "construct": "Bracket & Coupler", "size": '1/2"', "price": 800},
    {"operator": "Ball Valve", "construct": "Bracket & Coupler", "size": '3/4"', "price": 800},
    {"operator": "Ball Valve", "construct": "Bracket & Coupler", "size": '1"', "price": 800},
    {"operator": "Ball Valve", "construct": "Bracket & Coupler", "size": '1 1/4"', "price": 1050},
    {"operator": "Ball Valve", "construct": "Bracket & Coupler", "size": '1 1/2"', "price": 1050},
    {"operator": "Ball Valve", "construct": "Bracket & Coupler", "size": '2"', "price": 1250},
    {"operator": "Ball Valve", "construct": "Bracket & Coupler", "size": '2 1/2"', "price": 1250},
    {"operator": "Ball Valve", "construct": "Bracket & Coupler", "size": '3"', "price": 1400},
    {"operator": "Ball Valve", "construct": "Bracket & Coupler", "size": '4"', "price": 1400},
    {"operator": "Ball Valve", "construct": "Bracket & Coupler", "size": '5"', "price": 1600},
    {"operator": "Ball Valve", "construct": "Bracket & Coupler", "size": '6"', "price": 1600},
]

SOV_DATA = [
    {"sr_no": 1, "type": "5X2 SOV, Namur Type, Coil Voltage- 24 VDC, Wheather Proof", "price": 1250},
    {"sr_no": 2, "type": "5X2 SOV, Namur Type, Coil Voltage- 230 VAC, Wheather Proof", "price": 1300},
    {"sr_no": 3, "type": "5X2 SOV, Non Namur Type, Coil Voltage- 24 VDC, Wheather Proof", "price": 1200},
    {"sr_no": 4, "type": "5X2 SOV, Non Type, Coil Voltage- 230 VAC, Wheather Proof", "price": 1300},
    {"sr_no": 5, "type": "3X2 SOV, Namur Type, Coil Voltage- 24 VDC, Wheather Proof", "price": 1250},
    {"sr_no": 6, "type": "3X2 SOV, Namur Type, Coil Voltage- 230 VAC, Wheather Proof", "price": 1300},
    {"sr_no": 7, "type": "3X2 SOV, Non Namur Type, Coil Voltage- 24 VDC, Wheather Proof", "price": 1200},
    {"sr_no": 8, "type": "3X2 SOV, Non Type, Coil Voltage- 230 VAC, Wheather Proof", "price": 1300},
    {"sr_no": 9, "type": "5X2 SOV, Namur Type, Coil Voltage- 24 VDC, Explosion Proof", "price": 7800},
    {"sr_no": 10, "type": "3X2 SOV, Namur Type, Coil Voltage- 24 VDC, Explosion Proof", "price": 8100},
]

LSB_DATA = [
    {"sr_no": 1, "type": "Wheather proof with Mechanical Switches", "price": 1200},
    {"sr_no": 2, "type": "Flame proof with Mechanical Switches", "price": 3500},
    {"sr_no": 3, "type": "Wheather proof with proximity Switches", "price": 8600},
    {"sr_no": 4, "type": "Flame proof with Proximity Switches", "price": 16700},
]

POSITIONER_DATA = [
    {"sr_no": 1, "type": "Pneumatic- Pneumatic Positioner, Make- Rotork", "price": 18500},
    {"sr_no": 2, "type": "Electro- Pneumatic Positioner without PTR, Make- Rotork", "price": 35000},
    {"sr_no": 3, "type": "Electro- Pneumatic Positioner without PTR, Make- Rotex", "price": 23000},
    {"sr_no": 4, "type": "Electro- Pneumatic Positioner with PTR, Make- Rotork", "price": 54000},
    {"sr_no": 5, "type": "Electro- Pneumatic Positioner with PTR, Make- Rotex", "price": 28000},
    {"sr_no": 6, "type": "SMART Positioner with HART, Make- Rotork", "price": 65000},
    {"sr_no": 7, "type": "SMART Positioner with HART, Make- Rotex", "price": 60000},
]


async def _count(session, model, client_id: str) -> int:
    r = await session.execute(
        select(func.count(model.row_id)).where(model.client_id == client_id)
    )
    return int(r.scalar() or 0)


async def seed_accessories(client_id: str = "parth_valves", force: bool = False) -> dict[str, int]:
    """Insert accessory rows only if the target table is empty for `client_id`.

    Returns a dict with row counts inserted per table.
    """
    inserted: dict[str, int] = {
        "operator": 0,
        "bracket": 0,
        "sov": 0,
        "lsb": 0,
        "positioner": 0,
    }

    async with async_session_factory() as session:
        if force:
            for model in (
                CatalogOperatorRow,
                CatalogBracketsCouplerRow,
                CatalogSovRow,
                CatalogLimitSwitchRow,
                CatalogPositionerRow,
            ):
                await session.execute(delete(model).where(model.client_id == client_id))
            await session.commit()

        # Operators
        if await _count(session, CatalogOperatorRow, client_id) == 0:
            for d in OPERATOR_DATA:
                session.add(
                    CatalogOperatorRow(
                        row_id=uuid.uuid4(),
                        client_id=client_id,
                        operator_for=d["operator_for"],
                        construct=d["construct"],
                        size_text=d["size"],
                        model_name=d["model_name"],
                        price_inr=float(d["base_price"]),
                    )
                )
                inserted["operator"] += 1

        # Brackets & couplers
        if await _count(session, CatalogBracketsCouplerRow, client_id) == 0:
            for d in BRACKET_COUPLER_DATA:
                session.add(
                    CatalogBracketsCouplerRow(
                        row_id=uuid.uuid4(),
                        client_id=client_id,
                        bracket_operator=d["operator"],
                        construct=d["construct"],
                        size_text=d["size"],
                        price_inr=float(d["price"]),
                    )
                )
                inserted["bracket"] += 1

        # SOV
        if await _count(session, CatalogSovRow, client_id) == 0:
            for d in SOV_DATA:
                session.add(
                    CatalogSovRow(
                        row_id=uuid.uuid4(),
                        client_id=client_id,
                        sr_no=float(d["sr_no"]),
                        variant_type=d["type"],
                        price_inr=float(d["price"]),
                    )
                )
                inserted["sov"] += 1

        # Limit switch box
        if await _count(session, CatalogLimitSwitchRow, client_id) == 0:
            for d in LSB_DATA:
                session.add(
                    CatalogLimitSwitchRow(
                        row_id=uuid.uuid4(),
                        client_id=client_id,
                        sr_no=float(d["sr_no"]),
                        variant_type=d["type"],
                        price_inr=float(d["price"]),
                    )
                )
                inserted["lsb"] += 1

        # Positioner
        if await _count(session, CatalogPositionerRow, client_id) == 0:
            for d in POSITIONER_DATA:
                session.add(
                    CatalogPositionerRow(
                        row_id=uuid.uuid4(),
                        client_id=client_id,
                        sr_no=float(d["sr_no"]),
                        variant_type=d["type"],
                        price_inr=float(d["price"]),
                    )
                )
                inserted["positioner"] += 1

        await session.commit()

    return inserted


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Seed valve assembly accessory tables (insert if empty)")
    parser.add_argument("--client-id", default="parth_valves")
    parser.add_argument("--force", action="store_true", help="Wipe and reseed tables")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    await init_db()
    counts = await seed_accessories(client_id=args.client_id, force=args.force)
    print(f"Seeded (inserted) — {counts}")


if __name__ == "__main__":
    asyncio.run(_main())
