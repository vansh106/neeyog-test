"""Client identification service.

All ERP integration points are intentionally isolated behind TODO blocks.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ClientRecord


# ── Dummy clients for MVP dropdown ──────────────────────────
# TODO: Replace with real ERP client lookup when ERP integration is ready.
DUMMY_CLIENTS: list[dict] = [
    {
        "id": "dummy-001",
        "company_name": "Bharat Industrial Supplies",
        "contact_name": "Ramesh Joshi",
        "email": "ramesh@bharatind.com",
        "phone": "9823001001",
        "city": "Pune",
        "erp_code": "FC0101",
        "is_erp_synced": True,
    },
    {
        "id": "dummy-002",
        "company_name": "Nashik Engineering Works",
        "contact_name": "Sunita Patil",
        "email": "sunita@nashikeng.in",
        "phone": "9765400200",
        "city": "Nashik",
        "erp_code": "FC0202",
        "is_erp_synced": True,
    },
    {
        "id": "dummy-003",
        "company_name": "Maharashtra Process Equipment",
        "contact_name": "Vijay Kulkarni",
        "email": "vijay@mpequip.com",
        "phone": "9712300303",
        "city": "Mumbai",
        "erp_code": "FC0303",
        "is_erp_synced": True,
    },
    {
        "id": "dummy-004",
        "company_name": "Aurangabad Fluid Systems",
        "contact_name": "Pradeep Shinde",
        "email": "pradeep@afsystems.in",
        "phone": "9823400404",
        "city": "Aurangabad",
        "erp_code": "FC0404",
        "is_erp_synced": True,
    },
]


@dataclass
class DummyClient:
    id: str
    company_name: str
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    erp_code: str | None = None
    is_erp_synced: bool = False


def _clean_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


async def lookup_client(
    company_name: str | None,
    email: str | None,
    phone: str | None,
    db: AsyncSession,
) -> ClientRecord | None:
    """Search our internal `client_records` table.

    Order: email → phone → fuzzy company name.

    TODO: When ERP integration is ready, also query the ERP client master here and merge results:
      _lookup_erp_client(email, phone, company_name) -> erp_code|None
    """
    if not any([company_name, email, phone]):
        return None

    conditions = []
    if email:
        conditions.append(ClientRecord.email == email.lower().strip())
    if phone:
        clean = _clean_phone(phone)
        if clean:
            conditions.append(ClientRecord.phone.like(f"%{clean}"))

    if conditions:
        result = await db.execute(select(ClientRecord).where(or_(*conditions)).limit(1))
        found = result.scalar_one_or_none()
        if found:
            return found

    if company_name and len(company_name) > 3:
        needle = company_name.lower().strip()[:20]
        result = await db.execute(
            select(ClientRecord).where(func.lower(ClientRecord.company_name).contains(needle)).limit(1)
        )
        return result.scalar_one_or_none()

    return None


async def create_client_record(extracted: dict, source: str, db: AsyncSession) -> ClientRecord:
    """Create a new client record in our DB.

    `erp_code` is None until ERP confirms the client.

    TODO: After creation, optionally trigger async ERP sync:
      _sync_new_client_to_erp(client_record)
    """
    client = ClientRecord(
        company_name=extracted.get("company_name") or "Unknown",
        contact_name=extracted.get("contact_name"),
        email=(extracted.get("email") or "").lower().strip() or None,
        phone=extracted.get("phone"),
        city=extracted.get("city"),
        country=extracted.get("country") or "India",
        erp_code=None,
        is_erp_synced=False,
        source=source,
        enquiry_count=1,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


async def get_client_by_id(client_id: str, db: AsyncSession) -> ClientRecord | DummyClient | None:
    """Fetch client by our internal UUID (or dummy id for MVP)."""
    if client_id.startswith("dummy-"):
        for d in DUMMY_CLIENTS:
            if d["id"] == client_id:
                return DummyClient(**d)
        return None

    result = await db.execute(select(ClientRecord).where(ClientRecord.id == uuid.UUID(client_id)))
    return result.scalar_one_or_none()


async def increment_enquiry_count(client_id: str, db: AsyncSession) -> None:
    if client_id.startswith("dummy-"):
        return
    client = await get_client_by_id(client_id, db)
    if isinstance(client, ClientRecord):
        client.enquiry_count += 1
        await db.commit()


def get_dummy_clients() -> list[dict]:
    """Client list for dropdown.

    TODO: Replace with real ERP client search when ERP integration is ready.
    """
    return DUMMY_CLIENTS

