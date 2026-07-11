"""Database seeding utilities for loading product data from Excel files.

Usage:
    python db/seed.py --file ./data/butterfly_valves.xlsx \
                      --client parth_valves \
                      --category butterfly_valve \
                      --version "2025-26"

Or import seed_demo_data() for the hardcoded fallback.
"""

import argparse
import asyncio
import logging
import re
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from openpyxl import load_workbook  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from core.database import async_session_factory, init_db  # noqa: E402
from db.models import Product  # noqa: E402

logger = logging.getLogger(__name__)

DN_TO_INCH: dict[int, float] = {
    15: 0.5, 20: 0.75, 25: 1.0, 32: 1.25, 40: 1.5, 50: 2.0,
    65: 2.5, 80: 3.0, 100: 4.0, 125: 5.0, 150: 6.0, 200: 8.0,
    250: 10.0, 300: 12.0, 350: 14.0, 400: 16.0, 450: 18.0,
    500: 20.0, 600: 24.0,
}

OPERATOR_LABELS: dict[str, str] = {
    "BARE SHAFT": "Bare Shaft",
    "VALVE + DA ACTUATOR+LSB+SOV": "DA Actuator + LSB + SOV",
    "VALVE + DA ACTUATOR + LSB + SOV": "DA Actuator + LSB + SOV",
    "VALVE + SA ACTUATOR + LSB + SOV": "SA Actuator + LSB + SOV",
    "VALVE + SA ACTUATOR+LSB+SOV": "SA Actuator + LSB + SOV",
    "VALVE + DA ACTUATOR+LSB": "DA Actuator + LSB",
    "VALVE + DA ACTUATOR + LSB": "DA Actuator + LSB",
    "VALVE + SA ACTUATOR+LSB": "SA Actuator + LSB",
    "VALVE + SA ACTUATOR + LSB": "SA Actuator + LSB",
    "VALVE + DA ACTUATOR": "DA Actuator",
    "VALVE + SA ACTUATOR": "SA Actuator",
}


def _parse_dn_size(size_str: str) -> tuple[float | None, float | None]:
    """Extract mm and inch from a DN string like 'DN100'."""
    match = re.search(r"DN\s*(\d+)", str(size_str), re.IGNORECASE)
    if not match:
        return None, None
    mm = float(match.group(1))
    inch = DN_TO_INCH.get(int(mm))
    return mm, inch


def _parse_product_description(desc: str) -> dict:
    """Extract structured spec fields from the multiline product description."""
    specs: dict[str, str | None] = {
        "body": None, "seat": None, "stem": None,
        "pressure": None, "end": None, "drilling": None,
        "paint": None, "operator": None,
    }
    if not desc:
        return specs
    for line in desc.strip().split("\n"):
        line = line.strip()
        if " - " in line:
            key, _, val = line.partition(" - ")
            key = key.strip().lower()
            val = val.strip()
            if key in specs:
                specs[key] = val
    return specs


def _detect_operator(desc: str | None, col11_header: str | None) -> str:
    """Determine the operator/configuration from description or section header."""
    if col11_header:
        normalized = col11_header.strip().upper()
        for key, label in OPERATOR_LABELS.items():
            if key in normalized:
                return label
        if "POSITIONER" in normalized:
            return "DA Actuator + Positioner"
    if desc:
        specs = _parse_product_description(desc)
        if specs.get("operator"):
            op = specs["operator"].strip().upper()
            for key, label in OPERATOR_LABELS.items():
                if key in op:
                    return label
    return "Bare Shaft"


async def _upsert_product(session: AsyncSession, product_data: dict) -> str:
    """Insert or update a product. Returns 'inserted', 'updated', or 'skipped'."""
    stmt = select(Product).where(
        Product.client_id == product_data["client_id"],
        Product.category == product_data["category"],
        Product.name == product_data["name"],
        Product.size_mm == product_data["size_mm"],
        Product.material == product_data["material"],
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        if existing.base_price != product_data["base_price"]:
            existing.base_price = product_data["base_price"]
            existing.pricelist_version = product_data["pricelist_version"]
            existing.raw_specs = product_data.get("raw_specs")
            return "updated"
        return "skipped"

    product = Product(
        id=uuid.uuid4(),
        **product_data,
    )
    session.add(product)
    return "inserted"


async def seed_from_xlsx(
    file_path: str,
    client_id: str = "parth_valves",
    category: str = "butterfly_valve",
    version: str = "2025-26",
) -> dict[str, int]:
    """Read the butterfly valve XLSX and seed the database.

    The sheet has repeating sections, each for a different operator type.
    Each section has a header row pair followed by 11 data rows (DN100-DN600).
    Each data row contains prices for SS304 (col F) and SS316 (col H).
    """
    wb = load_workbook(file_path, data_only=True)
    ws = wb[wb.sheetnames[0]]

    counts = {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}

    current_section_header: str | None = None
    current_description: str | None = None
    header_row_seen = False

    rows_to_insert: list[dict] = []

    for row in ws.iter_rows(min_row=1, max_row=ws.max_row, values_only=False):
        col_b = row[1].value if len(row) > 1 else None  # Sr No / header
        col_c = row[2].value if len(row) > 2 else None  # Product Description
        col_e = row[4].value if len(row) > 4 else None  # Size (DNxxx)
        col_f = row[5].value if len(row) > 5 else None  # SS304 sale price
        col_h = row[7].value if len(row) > 7 else None  # SS316 sale price
        col_k = row[10].value if len(row) > 10 else None  # Section header

        if col_b == "Sr No" and col_c == "Product Description":
            header_row_seen = True
            if col_k and isinstance(col_k, str):
                current_section_header = col_k.strip()
            continue

        if header_row_seen and not isinstance(col_b, (int, float)):
            if col_b is None and col_f is None:
                header_row_seen = False
            continue

        if not isinstance(col_b, (int, float)):
            continue

        if col_c and isinstance(col_c, str) and "Valve" in col_c:
            current_description = col_c

        if not col_e or not isinstance(col_e, str) or "DN" not in str(col_e).upper():
            continue

        size_mm, size_inch = _parse_dn_size(str(col_e))
        if size_mm is None:
            continue

        operator_label = _detect_operator(current_description, current_section_header)
        specs = _parse_product_description(current_description or "")

        pressure_rating = specs.get("pressure") or "PN04"
        end_type = specs.get("end") or "Wafer"

        for disc_material, price_col in [("SS304", col_f), ("SS316", col_h)]:
            if price_col is None or not isinstance(price_col, (int, float)):
                counts["errors"] += 1
                continue

            price = round(float(price_col), 2)
            if price <= 0:
                counts["errors"] += 1
                continue

            name = f"Al BFV {end_type} {operator_label} DN{int(size_mm)} {disc_material}"

            rows_to_insert.append({
                "client_id": client_id,
                "name": name,
                "category": category,
                "sub_category": f"wafer_type_{operator_label.lower().replace(' ', '_').replace('+', '')}",
                "size_inch": size_inch,
                "size_mm": size_mm,
                "pressure_rating": pressure_rating,
                "material": f"AL Body / {disc_material} Disc / EPDM Seat",
                "unit": "piece",
                "base_price": price,
                "currency": "INR",
                "pricelist_version": version,
                "is_active": True,
                "raw_specs": specs,
            })

    async with async_session_factory() as session:
        for product_data in rows_to_insert:
            try:
                action = await _upsert_product(session, product_data)
                counts[action] += 1
            except Exception as e:
                logger.warning("Failed to upsert product %s: %s", product_data.get("name"), e)
                counts["errors"] += 1
        await session.commit()

    # TODO: Generate pgvector embeddings for each product after insert.
    # For demo, keyword/exact matching is used instead.

    wb.close()
    return counts


async def seed_demo_data(client_id: str = "parth_valves") -> dict[str, int]:
    """Insert hardcoded sample butterfly valve records as a fallback."""
    demo_products = [
        ("Al BFV Wafer Bare Shaft DN25 SS304", 1.0, 25.0, 850.0),
        ("Al BFV Wafer Bare Shaft DN38 SS304", 1.5, 38.0, 1100.0),
        ("Al BFV Wafer Bare Shaft DN51 SS304", 2.0, 51.0, 1450.0),
        ("Al BFV Wafer Bare Shaft DN64 SS304", 2.5, 63.5, 1950.0),
        ("Al BFV Wafer Bare Shaft DN76 SS304", 3.0, 76.0, 2600.0),
        ("Al BFV Wafer Bare Shaft DN102 SS304", 4.0, 102.0, 3800.0),
        ("Al BFV Wafer Bare Shaft DN152 SS304", 6.0, 152.0, 6200.0),
        ("Al BFV Wafer Bare Shaft DN203 SS304", 8.0, 203.0, 9800.0),
    ]

    counts = {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}

    async with async_session_factory() as session:
        for name, size_inch, size_mm, price in demo_products:
            product_data = {
                "client_id": client_id,
                "name": name,
                "category": "butterfly_valve",
                "sub_category": "wafer_type_bare_shaft",
                "size_inch": size_inch,
                "size_mm": size_mm,
                "pressure_rating": "PN04",
                "material": "AL Body / SS304 Disc / EPDM Seat",
                "unit": "piece",
                "base_price": price,
                "currency": "INR",
                "pricelist_version": "demo",
                "is_active": True,
                "raw_specs": {"source": "demo_fallback"},
            }
            try:
                action = await _upsert_product(session, product_data)
                counts[action] += 1
            except Exception as e:
                logger.warning("Failed to upsert demo product %s: %s", name, e)
                counts["errors"] += 1
        await session.commit()

    return counts


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Seed product data from XLSX")
    parser.add_argument("--file", type=str, help="Path to XLSX file")
    parser.add_argument("--client", type=str, default="parth_valves")
    parser.add_argument("--category", type=str, default="butterfly_valve")
    parser.add_argument("--version", type=str, default="2025-26")
    parser.add_argument("--demo", action="store_true", help="Seed demo data only")
    args = parser.parse_args()

    await init_db()

    if args.demo or not args.file:
        print("Seeding demo data...")
        counts = await seed_demo_data(client_id=args.client)
    else:
        xlsx_path = Path(args.file)
        if not xlsx_path.exists():
            print(f"File not found: {xlsx_path}")
            return
        print(f"Seeding from {xlsx_path}...")
        counts = await seed_from_xlsx(
            file_path=str(xlsx_path),
            client_id=args.client,
            category=args.category,
            version=args.version,
        )

    print(
        f"Seeded {counts['inserted']} products, "
        f"updated {counts['updated']}, "
        f"skipped {counts['skipped']} (unchanged), "
        f"errors {counts['errors']} (empty price/bad data)"
    )


if __name__ == "__main__":
    asyncio.run(_main())
