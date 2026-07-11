"""Seed ~10 dummy IndiaMart queries covering Packaging masters sheets.

Products mirror sidebar categories under Aluminium Foil and Paper Products.

Usage (from ``backend/``):
  python -m db.seed_indiamart_dummy_queries
  python -m db.seed_indiamart_dummy_queries --replace
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logger = logging.getLogger(__name__)

DUMMY_UNIQUE_ID_PREFIX = "IM-DUMMY-"

# IndiaMart-shaped payloads — one lead per distinct masters product kind.
DUMMY_LEADS: list[dict[str, Any]] = [
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-101",
        "QUERY_TYPE": "W",
        "QUERY_TIME": "09-Jul-2026 09:20:00",
        "SENDER_NAME": "Ravi Mehta",
        "SENDER_EMAIL": "purchase@freshbites.in",
        "SENDER_MOBILE": "9876501101",
        "GLUSR_USR_COMPANY_NAME": "FreshBites Catering Pvt Ltd",
        "SENDER_CITY": "Pune",
        "SENDER_STATE": "Maharashtra",
        "SENDER_ADDRESS": "Baner Road, Pune",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Aluminium Foil Wrap 18MTR",
        "QUERY_MESSAGE": (
            "Need aluminium foil wrap 18MTR / 290mm for kitchen use — Qty 200 rolls. "
            "Please share rate incl GST and MOQ. Prefer STD grade."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-102",
        "QUERY_TYPE": "B",
        "QUERY_TIME": "09-Jul-2026 10:45:00",
        "SENDER_NAME": "Sneha Patil",
        "SENDER_EMAIL": "sneha@cloudkitchen.co",
        "SENDER_MOBILE": "9876501102",
        "GLUSR_USR_COMPANY_NAME": "Cloud Kitchen Hub",
        "SENDER_CITY": "Mumbai",
        "SENDER_STATE": "Maharashtra",
        "SENDER_ADDRESS": "Andheri East",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Aluminium Foil Container",
        "QUERY_MESSAGE": (
            "Looking for aluminium foil containers for takeaway — mixed sizes. "
            "Monthly requirement around 5,000 pcs. Need sample pack and price list."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-103",
        "QUERY_TYPE": "W",
        "QUERY_TIME": "09-Jul-2026 11:30:00",
        "SENDER_NAME": "Amit Shah",
        "SENDER_EMAIL": "amit@royalevents.com",
        "SENDER_MOBILE": "9876501103",
        "GLUSR_USR_COMPANY_NAME": "Royal Events & Banquets",
        "SENDER_CITY": "Ahmedabad",
        "SENDER_STATE": "Gujarat",
        "SENDER_ADDRESS": "SG Highway",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Premium Foil Container",
        "QUERY_MESSAGE": (
            "Require premium foil containers for wedding catering — Qty 2,000. "
            "Please quote premium / exclusive range with lids if available."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-104",
        "QUERY_TYPE": "WA",
        "QUERY_TIME": "09-Jul-2026 12:15:00",
        "SENDER_NAME": "Priya Nair",
        "SENDER_EMAIL": "priya@sweetbox.in",
        "SENDER_MOBILE": "9876501104",
        "GLUSR_USR_COMPANY_NAME": "SweetBox Desserts",
        "SENDER_CITY": "Bengaluru",
        "SENDER_STATE": "Karnataka",
        "SENDER_ADDRESS": "Whitefield",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Foil Paper Lids / Pet Lid",
        "QUERY_MESSAGE": (
            "WhatsApp enquiry: need foil paper lids and pet lids compatible with our foil containers. "
            "Qty 3,000 each. Share matching sizes."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-105",
        "QUERY_TYPE": "W",
        "QUERY_TIME": "09-Jul-2026 13:40:00",
        "SENDER_NAME": "Karan Joshi",
        "SENDER_EMAIL": "stores@cafeblend.com",
        "SENDER_MOBILE": "9876501105",
        "GLUSR_USR_COMPANY_NAME": "Cafe Blend Retail",
        "SENDER_CITY": "Nashik",
        "SENDER_STATE": "Maharashtra",
        "SENDER_ADDRESS": "College Road",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Eco Paper Cups 100ML / 150ML",
        "QUERY_MESSAGE": (
            "Need eco / TNPL paper cups 100ML and 150ML for cafe chain — Qty 50 cartons. "
            "Prefer food-grade, rate incl GST."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-106",
        "QUERY_TYPE": "B",
        "QUERY_TIME": "09-Jul-2026 14:55:00",
        "SENDER_NAME": "Meera Iyer",
        "SENDER_EMAIL": "meera@officepantry.in",
        "SENDER_MOBILE": "9876501106",
        "GLUSR_USR_COMPANY_NAME": "Office Pantry Solutions",
        "SENDER_CITY": "Chennai",
        "SENDER_STATE": "Tamil Nadu",
        "SENDER_ADDRESS": "OMR",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Clarro Paper Cups Tall",
        "QUERY_MESSAGE": (
            "Buy lead: Clarro / SI tall paper cups 90ML–110ML for corporate pantry. "
            "Need leak-proof cups, monthly 10,000 pcs. Quote with GSM options."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-107",
        "QUERY_TYPE": "P",
        "QUERY_TIME": "09-Jul-2026 15:20:00",
        "SENDER_NAME": "Vikram Desai",
        "SENDER_EMAIL": "vikram@eventfuel.in",
        "SENDER_MOBILE": "9876501107",
        "GLUSR_USR_COMPANY_NAME": "EventFuel Hospitality",
        "SENDER_CITY": "Surat",
        "SENDER_STATE": "Gujarat",
        "SENDER_ADDRESS": "Ring Road",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Dolphin Paper Cups 200ML",
        "QUERY_MESSAGE": (
            "PNS call follow-up: Dolphin (DL) paper cups 200ML — Qty 20,000 for festival stall. "
            "Need urgent dispatch to Surat."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-108",
        "QUERY_TYPE": "W",
        "QUERY_TIME": "09-Jul-2026 16:05:00",
        "SENDER_NAME": "Ananya Gupta",
        "SENDER_EMAIL": "ananya@hotbrew.co",
        "SENDER_MOBILE": "9876501108",
        "GLUSR_USR_COMPANY_NAME": "HotBrew Coffee Co",
        "SENDER_CITY": "Delhi",
        "SENDER_STATE": "Delhi",
        "SENDER_ADDRESS": "Connaught Place",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Ripple Cups Brown / Double Wall",
        "QUERY_MESSAGE": (
            "Require SI ripple cups brown and CP/SI double wall cups for hot beverages. "
            "Sizes 7OZ–8OZ. Qty 8,000. Share brown and black options."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-109",
        "QUERY_TYPE": "WA",
        "QUERY_TIME": "10-Jul-2026 09:10:00",
        "SENDER_NAME": "Rohit Kulkarni",
        "SENDER_EMAIL": "rohit@greensalad.in",
        "SENDER_MOBILE": "9876501109",
        "GLUSR_USR_COMPANY_NAME": "GreenSalad Cloud Kitchen",
        "SENDER_CITY": "Hyderabad",
        "SENDER_STATE": "Telangana",
        "SENDER_ADDRESS": "Gachibowli",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Paper Container Kraft / Salad Bowl",
        "QUERY_MESSAGE": (
            "WhatsApp: kraft paper containers and PW salad kraft bowls with lids. "
            "Need 500ML–750ML — Qty 4,000. Also quote white container if cheaper."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-110",
        "QUERY_TYPE": "B",
        "QUERY_TIME": "10-Jul-2026 10:35:00",
        "SENDER_NAME": "Neha Verma",
        "SENDER_EMAIL": "neha@bioplate.in",
        "SENDER_MOBILE": "9876501110",
        "GLUSR_USR_COMPANY_NAME": "BioPlate Traders",
        "SENDER_CITY": "Indore",
        "SENDER_STATE": "Madhya Pradesh",
        "SENDER_ADDRESS": "Vijay Nagar",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Paper Plates / Biodegradable Super Paper",
        "QUERY_MESSAGE": (
            "Buy lead: paper plates 7–10 inch and biodegradable super bio plates/bowls. "
            "Distributor enquiry — need wholesale rates and pack sizes for Indore stock."
        ),
    },
]


def _parse_query_time(raw: str | None) -> datetime | None:
    if not raw or not str(raw).strip():
        return None
    text = str(raw).strip()
    ist = timezone(timedelta(hours=5, minutes=30))
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%d-%b-%Y %H:%M:%S",
        "%d-%b-%Y%H:%M:%S",
        "%d-%m-%Y %H:%M:%S",
    ):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=ist)
        except ValueError:
            continue
    return None


def _lead_to_row(lead: dict[str, Any]) -> dict[str, Any]:
    company = (
        lead.get("GLUSR_USR_COMPANY_NAME")
        or lead.get("SENDER_COMPANY")
        or lead.get("COMPANY_NAME")
        or ""
    )
    return {
        "unique_query_id": str(lead["UNIQUE_QUERY_ID"]).strip(),
        "query_type": str(lead.get("QUERY_TYPE") or "").strip() or None,
        "query_time": _parse_query_time(lead.get("QUERY_TIME")),
        "sender_name": str(lead.get("SENDER_NAME") or "").strip() or None,
        "sender_email": str(lead.get("SENDER_EMAIL") or "").strip() or None,
        "sender_mobile": str(lead.get("SENDER_MOBILE") or "").strip() or None,
        "sender_company": str(company).strip() or None,
        "sender_city": str(lead.get("SENDER_CITY") or "").strip() or None,
        "sender_state": str(lead.get("SENDER_STATE") or "").strip() or None,
        "sender_address": str(lead.get("SENDER_ADDRESS") or "").strip() or None,
        "sender_country_iso": str(lead.get("SENDER_COUNTRY_ISO") or "").strip() or None,
        "query_message": str(lead.get("QUERY_MESSAGE") or "").strip() or None,
        "query_product_name": str(lead.get("QUERY_PRODUCT_NAME") or "").strip() or None,
        "raw_payload": lead,
    }


async def _run(*, replace: bool) -> None:
    from sqlalchemy import delete, select

    from core.database import async_session_factory, init_db
    from db.models import IndiaMartQuery, IndiaMartSyncState

    await init_db()
    async with async_session_factory() as session:
        if replace:
            result = await session.execute(
                delete(IndiaMartQuery).where(
                    IndiaMartQuery.unique_query_id.like(f"{DUMMY_UNIQUE_ID_PREFIX}%")
                )
            )
            logger.info("Removed %s existing dummy lead(s)", int(result.rowcount or 0))

        uids = [str(lead["UNIQUE_QUERY_ID"]) for lead in DUMMY_LEADS]
        existing = {
            r[0]
            for r in (
                await session.execute(
                    select(IndiaMartQuery.unique_query_id).where(
                        IndiaMartQuery.unique_query_id.in_(uids)
                    )
                )
            ).all()
        }

        inserted = 0
        for lead in DUMMY_LEADS:
            row = _lead_to_row(lead)
            if row["unique_query_id"] in existing:
                logger.info("Skip existing %s", row["unique_query_id"])
                continue
            session.add(IndiaMartQuery(id=uuid.uuid4(), **row))
            inserted += 1
            logger.info(
                "  + %s [%s] %s",
                row["unique_query_id"],
                row["query_type"],
                row["query_product_name"],
            )

        state = await session.get(IndiaMartSyncState, 1)
        if state is None:
            state = IndiaMartSyncState(id=1)
            session.add(state)
        state.last_sync_at = datetime.now(timezone.utc)
        state.last_sync_status = "ok"
        state.last_sync_message = f"dummy_seed; inserted={inserted}"

        await session.commit()
        logger.info("Seeded %s / %s dummy IndiaMart queries", inserted, len(DUMMY_LEADS))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
    parser = argparse.ArgumentParser(description="Seed dummy IndiaMart packaging queries")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete existing IM-DUMMY-* rows before insert",
    )
    args = parser.parse_args()
    asyncio.run(_run(replace=args.replace))


if __name__ == "__main__":
    main()
