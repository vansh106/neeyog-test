"""Seed ~10 dummy packaging RFQ emails into the Email tab (enquiries).

Mirrors IndiaMart dummy leads as IMAP-style raw_input so they appear under
``GET /api/enquiries/emails/inbox``. Also soft-deactivates connected mailboxes.

Usage (from ``backend/``):
  python -m db.seed_email_dummy_enquiries
  python -m db.seed_email_dummy_enquiries --replace
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logger = logging.getLogger(__name__)

DUMMY_SEED_MARKER = "X-Seed-Id: EM-DUMMY-"
DUMMY_ID_PREFIX = "EM-DUMMY-"

# Packaging RFQs — same product mix as IndiaMart dummy leads.
DUMMY_EMAILS: list[dict[str, Any]] = [
    {
        "id": "EM-DUMMY-101",
        "from_name": "Ravi Mehta",
        "from_email": "purchase@freshbites.in",
        "subject": "Quotation request — Aluminium Foil Wrap 18MTR",
        "when": "11 Jul 2026 09:20:00 +0530",
        "body": (
            "Dear Neeyog Packaging,\n\n"
            "Need aluminium foil wrap 18MTR / 290mm for kitchen use — Qty 200 rolls. "
            "Please share rate incl GST and MOQ. Prefer STD grade.\n\n"
            "Regards,\nRavi Mehta\nFreshBites Catering Pvt Ltd\nPune"
        ),
    },
    {
        "id": "EM-DUMMY-102",
        "from_name": "Sneha Patil",
        "from_email": "sneha@cloudkitchen.co",
        "subject": "Price enquiry — Aluminium Foil Containers",
        "when": "11 Jul 2026 10:45:00 +0530",
        "body": (
            "Hi,\n\n"
            "Looking for aluminium foil containers for takeaway — mixed sizes. "
            "Monthly requirement around 5,000 pcs. Need sample pack and price list.\n\n"
            "Thanks,\nSneha Patil\nCloud Kitchen Hub, Mumbai"
        ),
    },
    {
        "id": "EM-DUMMY-103",
        "from_name": "Amit Shah",
        "from_email": "amit@royalevents.com",
        "subject": "RFQ: Premium Foil Containers for wedding catering",
        "when": "11 Jul 2026 11:30:00 +0530",
        "body": (
            "Hello,\n\n"
            "Require premium foil containers for wedding catering — Qty 2,000. "
            "Please quote premium / exclusive range with lids if available.\n\n"
            "Amit Shah\nRoyal Events & Banquets, Ahmedabad"
        ),
    },
    {
        "id": "EM-DUMMY-104",
        "from_name": "Priya Nair",
        "from_email": "priya@sweetbox.in",
        "subject": "Enquiry — Foil paper lids / Pet lids",
        "when": "11 Jul 2026 12:15:00 +0530",
        "body": (
            "Need foil paper lids and pet lids compatible with our foil containers. "
            "Qty 3,000 each. Please share matching sizes and rates.\n\n"
            "Priya Nair\nSweetBox Desserts, Bengaluru"
        ),
    },
    {
        "id": "EM-DUMMY-105",
        "from_name": "Karan Joshi",
        "from_email": "stores@cafeblend.com",
        "subject": "Quote needed — Eco Paper Cups 100ML / 150ML",
        "when": "11 Jul 2026 13:40:00 +0530",
        "body": (
            "Need eco / TNPL paper cups 100ML and 150ML for cafe chain — Qty 50 cartons. "
            "Prefer food-grade, rate incl GST.\n\n"
            "Karan Joshi\nCafe Blend Retail, Nashik"
        ),
    },
    {
        "id": "EM-DUMMY-106",
        "from_name": "Meera Iyer",
        "from_email": "meera@officepantry.in",
        "subject": "Buy enquiry — Clarro / SI tall paper cups",
        "when": "11 Jul 2026 14:55:00 +0530",
        "body": (
            "Clarro / SI tall paper cups 90ML–110ML for corporate pantry. "
            "Need leak-proof cups, monthly 10,000 pcs. Quote with GSM options.\n\n"
            "Meera Iyer\nOffice Pantry Solutions, Chennai"
        ),
    },
    {
        "id": "EM-DUMMY-107",
        "from_name": "Vikram Desai",
        "from_email": "vikram@eventfuel.in",
        "subject": "Urgent quote — Dolphin Paper Cups 200ML",
        "when": "11 Jul 2026 15:20:00 +0530",
        "body": (
            "Dolphin (DL) paper cups 200ML — Qty 20,000 for festival stall. "
            "Need urgent dispatch to Surat. Please share price and lead time.\n\n"
            "Vikram Desai\nEventFuel Hospitality"
        ),
    },
    {
        "id": "EM-DUMMY-108",
        "from_name": "Ananya Gupta",
        "from_email": "ananya@hotbrew.co",
        "subject": "Quotation — Ripple cups / Double wall cups",
        "when": "11 Jul 2026 16:05:00 +0530",
        "body": (
            "Require SI ripple cups brown and CP/SI double wall cups for hot beverages. "
            "Sizes 7OZ–8OZ. Qty 8,000. Share brown and black options with rates.\n\n"
            "Ananya Gupta\nHotBrew Coffee Co, Delhi"
        ),
    },
    {
        "id": "EM-DUMMY-109",
        "from_name": "Rohit Kulkarni",
        "from_email": "rohit@greensalad.in",
        "subject": "Price list — Kraft paper containers / salad bowls",
        "when": "12 Jul 2026 09:10:00 +0530",
        "body": (
            "Need kraft paper containers and PW salad kraft bowls with lids. "
            "Sizes 500ML–750ML — Qty 4,000. Also quote white container if cheaper.\n\n"
            "Rohit Kulkarni\nGreenSalad Cloud Kitchen, Hyderabad"
        ),
    },
    {
        "id": "EM-DUMMY-110",
        "from_name": "Neha Verma",
        "from_email": "neha@bioplate.in",
        "subject": "Wholesale enquiry — Paper plates / biodegradable plates",
        "when": "12 Jul 2026 10:35:00 +0530",
        "body": (
            "Paper plates 7–10 inch and biodegradable super bio plates/bowls. "
            "Distributor enquiry — need wholesale rates and pack sizes for Indore stock.\n\n"
            "Neha Verma\nBioPlate Traders, Indore"
        ),
    },
]


def _marker_line(seed_id: str) -> str:
    return f"{DUMMY_SEED_MARKER}{seed_id.removeprefix(DUMMY_ID_PREFIX)}"


def _build_raw_input(item: dict[str, Any]) -> str:
    return (
        f"From: {item['from_name']} <{item['from_email']}>\n"
        f"Date: {item['when']}\n"
        f"Subject: {item['subject']}\n"
        f"{_marker_line(item['id'])}\n"
        f"\n"
        f"{item['body']}\n"
    )


async def _run(*, replace: bool) -> None:
    from sqlalchemy import delete, select, update

    from core.database import async_session_factory, init_db
    from db.models import Enquiry, Mailbox, Quotation
    from services.email_inbox_filters import raw_input_is_quotation_work_related
    from services.enquiry_service import create_enquiry

    await init_db()
    async with async_session_factory() as session:
        deactivated = await session.execute(
            update(Mailbox).where(Mailbox.is_active.is_(True)).values(is_active=False)
        )
        logger.info("Deactivated %s active mailbox(es)", int(deactivated.rowcount or 0))

        if replace:
            from db.models import ProcessedEmail

            existing = (
                await session.execute(
                    select(Enquiry).where(Enquiry.raw_input.like(f"%{DUMMY_SEED_MARKER}%"))
                )
            ).scalars().all()
            ids = [e.id for e in existing]
            if ids:
                await session.execute(
                    update(ProcessedEmail)
                    .where(ProcessedEmail.enquiry_id.in_(ids))
                    .values(enquiry_id=None)
                )
                await session.execute(delete(Quotation).where(Quotation.enquiry_id.in_(ids)))
                result = await session.execute(delete(Enquiry).where(Enquiry.id.in_(ids)))
                logger.info(
                    "Removed %s existing dummy email enquiry(ies)",
                    int(result.rowcount or 0),
                )
            await session.commit()

        present_ids: set[str] = set()
        rows = (
            await session.execute(
                select(Enquiry.raw_input).where(
                    Enquiry.raw_input.like(f"%{DUMMY_SEED_MARKER}%")
                )
            )
        ).all()
        for (raw,) in rows:
            text = raw or ""
            for item in DUMMY_EMAILS:
                if _marker_line(item["id"]) in text:
                    present_ids.add(item["id"])

        inserted = 0
        for item in DUMMY_EMAILS:
            if item["id"] in present_ids:
                logger.info("Skip existing %s", item["id"])
                continue
            raw = _build_raw_input(item)
            if not raw_input_is_quotation_work_related(raw):
                logger.warning(
                    "Dummy %s would be filtered out of Email inbox — check PRODUCT_TERMS",
                    item["id"],
                )
            enquiry = await create_enquiry(raw, input_type="email", db=session)
            enquiry.created_at = datetime.now(timezone.utc) - timedelta(
                hours=len(DUMMY_EMAILS) - inserted
            )
            inserted += 1
            logger.info("  + %s  %s", item["id"], item["subject"][:60])

        await session.commit()
        logger.info("Seeded %s / %s dummy email enquiries", inserted, len(DUMMY_EMAILS))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
    parser = argparse.ArgumentParser(description="Seed dummy packaging emails for Email tab")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete existing EM-DUMMY-* email enquiries before insert",
    )
    args = parser.parse_args()
    asyncio.run(_run(replace=args.replace))


if __name__ == "__main__":
    main()
