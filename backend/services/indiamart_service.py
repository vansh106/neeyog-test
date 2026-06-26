"""IndiaMart Lead Manager Pull API (v2) — delta sync and query storage."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from db.models import IndiaMartQuery, IndiaMartSyncState

logger = logging.getLogger(__name__)

API_URL = "https://mapi.indiamart.com/wservce/crm/crmListing/v2/"
MIN_SYNC_INTERVAL = timedelta(minutes=5)

QUERY_TYPE_LABELS = {
    "W": "Direct Enquiry",
    "B": "Buy Lead",
    "P": "PNS Call",
    "BIZ": "Catalog View",
    "WA": "WhatsApp Enquiry",
}

DUMMY_UNIQUE_ID_PREFIX = "IM-DUMMY-"

DUMMY_LEADS: list[dict[str, Any]] = [
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-001",
        "QUERY_TYPE": "W",
        "QUERY_TIME": "24-Jun-2025 10:15:00",
        "SENDER_NAME": "Rajesh Kumar",
        "SENDER_EMAIL": "rajesh.kumar@shivamengg.com",
        "SENDER_MOBILE": "9876543210",
        "GLUSR_USR_COMPANY_NAME": "Shivam Engineering Works",
        "SENDER_CITY": "Mumbai",
        "SENDER_STATE": "Maharashtra",
        "SENDER_ADDRESS": "Andheri East, Mumbai",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Butterfly Valve 4 inch",
        "QUERY_MESSAGE": (
            "We require SS304 butterfly valve 4 inch, PN16, lever operated — Qty 6. "
            "Please share best price and delivery time to Mumbai."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-002",
        "QUERY_TYPE": "B",
        "QUERY_TIME": "24-Jun-2025 11:42:00",
        "SENDER_NAME": "Priya Sharma",
        "SENDER_EMAIL": "priya@chemflow.in",
        "SENDER_MOBILE": "9123456780",
        "GLUSR_USR_COMPANY_NAME": "ChemFlow Process Industries",
        "SENDER_CITY": "Vadodara",
        "SENDER_STATE": "Gujarat",
        "SENDER_ADDRESS": "GIDC Estate, Vadodara",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Diaphragm Valve TC End",
        "QUERY_MESSAGE": (
            "Looking for manual diaphragm valve TC end 2 inch for pharma line. "
            "Need quotation for 10 nos with material test certificate."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-003",
        "QUERY_TYPE": "W",
        "QUERY_TIME": "24-Jun-2025 14:05:00",
        "SENDER_NAME": "Amit Patel",
        "SENDER_MOBILE": "9988776655",
        "GLUSR_USR_COMPANY_NAME": "Patel Valve Traders",
        "SENDER_CITY": "Ahmedabad",
        "SENDER_STATE": "Gujarat",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Ball Valve Flanged",
        "QUERY_MESSAGE": (
            "Need flanged ball valve 3 inch Class 150, WCB body, SS trim — Qty 4. "
            "Urgent requirement for stock."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-004",
        "QUERY_TYPE": "P",
        "QUERY_TIME": "24-Jun-2025 15:30:00",
        "SENDER_NAME": "Suresh Menon",
        "SENDER_EMAIL": "suresh.m@keralapipes.com",
        "SENDER_MOBILE": "9847012345",
        "GLUSR_USR_COMPANY_NAME": "Kerala Pipes & Fittings",
        "SENDER_CITY": "Kochi",
        "SENDER_STATE": "Kerala",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Gate Valve 6 inch",
        "QUERY_MESSAGE": (
            "Caller enquired about cast steel gate valve 6 inch 300# for water pipeline project. "
            "Please call back with price."
        ),
    },
    {
        "UNIQUE_QUERY_ID": "IM-DUMMY-005",
        "QUERY_TYPE": "WA",
        "QUERY_TIME": "24-Jun-2025 16:18:00",
        "SENDER_NAME": "Neha Desai",
        "SENDER_EMAIL": "neha.desai@textilevalves.com",
        "SENDER_MOBILE": "9765432109",
        "GLUSR_USR_COMPANY_NAME": "Desai Textile Equipments",
        "SENDER_CITY": "Surat",
        "SENDER_STATE": "Gujarat",
        "SENDER_ADDRESS": "Ring Road, Surat",
        "SENDER_COUNTRY_ISO": "IN",
        "QUERY_PRODUCT_NAME": "Needle Valve",
        "QUERY_MESSAGE": (
            "WhatsApp enquiry: SS needle valve 1/2 inch NPT — Qty 20. "
            "Also need hose fittings if available."
        ),
    },
]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_query_time(raw: str | None) -> datetime | None:
    if not raw or not str(raw).strip():
        return None
    text = str(raw).strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%d-%b-%Y %H:%M:%S",
        "%d-%b-%Y%H:%M:%S",
        "%d-%m-%Y%H:%M:%S",
        "%d-%m-%Y %H:%M:%S",
    ):
        try:
            dt = datetime.strptime(text, fmt)
            return dt.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
        except ValueError:
            continue
    try:
        normalized = text.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
        return dt
    except ValueError:
        return None


def _query_time_for_display(q: IndiaMartQuery) -> datetime | None:
    if q.query_time is not None:
        return q.query_time
    if isinstance(q.raw_payload, dict):
        parsed = _parse_query_time(q.raw_payload.get("QUERY_TIME"))
        if parsed is not None:
            return parsed
    return q.created_at


async def _backfill_missing_query_times(db: AsyncSession) -> int:
    """Persist query_time parsed from raw_payload for rows synced before date parser fix."""
    result = await db.execute(select(IndiaMartQuery).where(IndiaMartQuery.query_time.is_(None)))
    updated = 0
    for q in result.scalars():
        if not isinstance(q.raw_payload, dict):
            continue
        parsed = _parse_query_time(q.raw_payload.get("QUERY_TIME"))
        if parsed is None:
            continue
        q.query_time = parsed
        updated += 1
    if updated:
        await db.flush()
    return updated


def _lead_to_row(lead: dict[str, Any]) -> dict[str, Any]:
    uid = str(lead.get("UNIQUE_QUERY_ID") or "").strip()
    if not uid:
        raise ValueError("Lead missing UNIQUE_QUERY_ID")

    company = (
        lead.get("GLUSR_USR_COMPANY_NAME")
        or lead.get("SENDER_COMPANY")
        or lead.get("COMPANY_NAME")
        or ""
    )
    return {
        "unique_query_id": uid,
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


async def _get_sync_state(db: AsyncSession) -> IndiaMartSyncState:
    row = await db.get(IndiaMartSyncState, 1)
    if row is None:
        row = IndiaMartSyncState(id=1)
        db.add(row)
        await db.flush()
    return row


def _can_sync_now(state: IndiaMartSyncState) -> bool:
    if state.last_sync_at is None:
        return True
    last = state.last_sync_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return _utcnow() - last >= MIN_SYNC_INTERVAL


async def _fetch_api_leads() -> tuple[list[dict[str, Any]], str]:
    settings = get_settings()
    key = (settings.indiamart_crm_key or "").strip()
    if not key:
        return [], "no_api_key"

    params = {"glusr_crm_key": key}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(API_URL, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("IndiaMart API request failed: %s", exc)
        return [], f"error:{exc}"

    status = str(payload.get("STATUS") or "").upper()
    if status != "SUCCESS":
        msg = str(payload.get("MESSAGE") or payload.get("message") or "API failure")
        return [], f"api_failure:{msg}"

    leads = payload.get("RESPONSE") or []
    if not isinstance(leads, list):
        return [], "invalid_response"
    return [x for x in leads if isinstance(x, dict)], "ok"


async def _purge_dummy_leads(db: AsyncSession) -> int:
    """Remove seeded demo rows once a real API key is configured."""
    result = await db.execute(
        delete(IndiaMartQuery).where(IndiaMartQuery.unique_query_id.like(f"{DUMMY_UNIQUE_ID_PREFIX}%"))
    )
    return int(result.rowcount or 0)


async def _upsert_leads(db: AsyncSession, leads: list[dict[str, Any]]) -> int:
    if not leads:
        return 0

    uids = []
    parsed: list[dict[str, Any]] = []
    for lead in leads:
        try:
            row = _lead_to_row(lead)
            uids.append(row["unique_query_id"])
            parsed.append(row)
        except ValueError:
            continue

    if not parsed:
        return 0

    existing = await db.execute(
        select(IndiaMartQuery.unique_query_id).where(IndiaMartQuery.unique_query_id.in_(uids))
    )
    known = {r[0] for r in existing.all()}
    inserted = 0
    for row in parsed:
        if row["unique_query_id"] in known:
            continue
        db.add(IndiaMartQuery(id=uuid.uuid4(), **row))
        inserted += 1
    return inserted


async def sync_indiamart_leads(db: AsyncSession, *, force: bool = False) -> dict[str, Any]:
    """Delta sync — only new ``UNIQUE_QUERY_ID`` rows are inserted."""
    settings = get_settings()
    if not settings.indiamart_sync_enabled:
        return {"skipped": True, "reason": "disabled", "inserted": 0}

    state = await _get_sync_state(db)
    if not force and not _can_sync_now(state):
        return {
            "skipped": True,
            "reason": "rate_limited",
            "inserted": 0,
            "last_sync_at": state.last_sync_at.isoformat() if state.last_sync_at else None,
        }

    key = (settings.indiamart_crm_key or "").strip()
    use_dummy = settings.indiamart_use_dummy_data and not key

    if use_dummy:
        count_before = (
            await db.execute(select(IndiaMartQuery.id).limit(1))
        ).scalar_one_or_none()
        leads = DUMMY_LEADS if count_before is None else []
        status_msg = "dummy_seed" if leads else "dummy_no_new"
    else:
        leads, status_msg = await _fetch_api_leads()
        if status_msg == "ok" and leads:
            purged = await _purge_dummy_leads(db)
            if purged:
                logger.info("Purged %s IndiaMart dummy lead(s) after live sync", purged)

    inserted = await _upsert_leads(db, leads)
    await _backfill_missing_query_times(db)
    state.last_sync_at = _utcnow()
    state.last_sync_status = "ok" if inserted or status_msg in ("ok", "dummy_no_new") else "warning"
    state.last_sync_message = status_msg if inserted == 0 else f"{status_msg}; inserted={inserted}"
    await db.commit()

    return {
        "skipped": False,
        "inserted": inserted,
        "status": state.last_sync_status,
        "message": state.last_sync_message,
        "last_sync_at": state.last_sync_at.isoformat(),
        "using_dummy": use_dummy,
    }


def _serialize_query(q: IndiaMartQuery) -> dict[str, Any]:
    qtype = (q.query_type or "").strip()
    is_picked = q.enquiry_id is not None
    display_time = _query_time_for_display(q)
    return {
        "id": str(q.id),
        "unique_query_id": q.unique_query_id,
        "query_type": q.query_type,
        "query_type_label": QUERY_TYPE_LABELS.get(qtype, qtype or "Lead"),
        "query_time": display_time.isoformat() if display_time else None,
        "sender_name": q.sender_name,
        "sender_email": q.sender_email,
        "sender_mobile": q.sender_mobile,
        "sender_company": q.sender_company,
        "sender_city": q.sender_city,
        "sender_state": q.sender_state,
        "sender_address": q.sender_address,
        "sender_country_iso": q.sender_country_iso,
        "query_message": q.query_message,
        "query_product_name": q.query_product_name,
        "enquiry_id": str(q.enquiry_id) if q.enquiry_id else None,
        "enquiry_number": (q.enquiry_number or "").strip() or None,
        "is_picked_up": is_picked,
        "can_pickup": _can_pickup(q),
        "picked_up_by_user_id": str(q.picked_up_by_user_id) if q.picked_up_by_user_id else None,
        "picked_up_by_name": q.picked_up_by_name,
        "picked_up_at": q.picked_up_at.isoformat() if q.picked_up_at else None,
        "is_archived": bool(q.is_archived),
        "created_at": q.created_at.isoformat() if q.created_at else None,
    }


def _can_pickup(q: IndiaMartQuery) -> bool:
    if q.is_archived:
        return False
    return q.enquiry_id is None


def _format_source_message(q: IndiaMartQuery) -> str:
    lines = [f"IndiaMart Lead — {q.unique_query_id}"]
    if (q.query_product_name or "").strip():
        lines.append(f"Product: {q.query_product_name.strip()}")
    buyer_parts = [p for p in [(q.sender_name or "").strip(), (q.sender_company or "").strip()] if p]
    if buyer_parts:
        lines.append(f"Buyer: {' / '.join(buyer_parts)}")
    if (q.sender_mobile or "").strip() or (q.sender_email or "").strip():
        contact = " · ".join(p for p in [(q.sender_mobile or "").strip(), (q.sender_email or "").strip()] if p)
        lines.append(f"Contact: {contact}")
    loc = ", ".join(p for p in [(q.sender_city or "").strip(), (q.sender_state or "").strip()] if p)
    if loc:
        lines.append(f"Location: {loc}")
    lines.append("")
    lines.append((q.query_message or "").strip() or "(No message body)")
    return "\n".join(lines).strip()


async def list_queries(
    db: AsyncSession,
    *,
    include_archived: bool = False,
    auto_sync: bool = True,
) -> dict[str, Any]:
    if auto_sync:
        await sync_indiamart_leads(db)

    await _backfill_missing_query_times(db)
    await db.commit()

    stmt = select(IndiaMartQuery).order_by(
        IndiaMartQuery.query_time.desc().nullslast(),
        IndiaMartQuery.created_at.desc(),
    )
    if not include_archived:
        stmt = stmt.where(IndiaMartQuery.is_archived.is_(False))

    rows = (await db.execute(stmt)).scalars().all()
    state = await _get_sync_state(db)
    settings = get_settings()

    return {
        "queries": [_serialize_query(q) for q in rows],
        "total": len(rows),
        "last_sync_at": state.last_sync_at.isoformat() if state.last_sync_at else None,
        "last_sync_status": state.last_sync_status,
        "last_sync_message": state.last_sync_message,
        "using_dummy_data": settings.indiamart_use_dummy_data and not (settings.indiamart_crm_key or "").strip(),
    }


async def get_query(db: AsyncSession, query_id: uuid.UUID) -> IndiaMartQuery | None:
    return await db.get(IndiaMartQuery, query_id)


def build_prefill(q: IndiaMartQuery) -> dict[str, Any]:
    company = (q.sender_company or "").strip()
    if not company and (q.sender_name or "").strip():
        company = f"{q.sender_name.strip()} (IndiaMart)"

    product_line = (q.query_product_name or "").strip()
    message = (q.query_message or "").strip()
    notes_parts = ["--- IndiaMart lead ---"]
    if product_line:
        notes_parts.append(f"Product: {product_line}")
    if message:
        notes_parts.append("")
        notes_parts.append(message)
    notes_parts.append("")
    notes_parts.append(f"IndiaMart Query ID: {q.unique_query_id}")
    notes = "\n".join(notes_parts).strip()

    return {
        "query_id": str(q.id),
        "unique_query_id": q.unique_query_id,
        "source": "indiamart",
        "notes": notes,
        "can_create_inquiry": _can_pickup(q),
        "can_pickup": _can_pickup(q),
        "is_picked_up": q.enquiry_id is not None,
        "linked_enquiry_id": str(q.enquiry_id) if q.enquiry_id else None,
        "client_hint": {
            "mode": "new",
            "newClient": {
                "company_name": company,
                "branch_name": "Head Office",
                "contact_name": (q.sender_name or "").strip() or "IndiaMart Buyer",
                "phone": (q.sender_mobile or "").strip(),
                "email": (q.sender_email or "").strip(),
                "city": (q.sender_city or "").strip(),
                "state": (q.sender_state or "").strip(),
                "address_line1": (q.sender_address or "").strip(),
            },
        },
    }


async def pickup_query(
    db: AsyncSession,
    query_id: uuid.UUID,
    body: dict,
    *,
    picked_up_by_user_id: uuid.UUID,
    picked_up_by_name: str,
) -> dict[str, Any]:
    """Claim a lead, create an enquiry with the IndiaMart source message, and lock the row."""
    from services.enquiry_service import EnquiryParseError, create_indiamart_pickup_enquiry

    stmt = select(IndiaMartQuery).where(IndiaMartQuery.id == query_id).with_for_update()
    result = await db.execute(stmt)
    q = result.scalar_one_or_none()
    if q is None:
        raise ValueError("IndiaMart query not found")
    if q.is_archived:
        raise ValueError("This IndiaMart query is archived")
    if q.enquiry_id is not None:
        raise ValueError("This query has already been picked up")

    source_message = _format_source_message(q)
    body = {**body, "source": "indiamart", "notes": (body.get("notes") or "").strip()}

    try:
        enquiry_result = await create_indiamart_pickup_enquiry(
            body,
            db,
            source_message=source_message,
            indiamart_query_id=str(q.id),
            indiamart_unique_query_id=q.unique_query_id,
            created_by_user_id=picked_up_by_user_id,
            created_by_name=picked_up_by_name,
        )
    except EnquiryParseError as exc:
        raise ValueError(str(exc)) from exc

    enquiry_id = uuid.UUID(enquiry_result["enquiry_id"])
    enquiry_no = (enquiry_result.get("enquiry_number") or "").strip() or None

    q.enquiry_id = enquiry_id
    q.enquiry_number = enquiry_no
    q.picked_up_by_user_id = picked_up_by_user_id
    q.picked_up_by_name = (picked_up_by_name or "").strip()[:255] or None
    q.picked_up_at = _utcnow()
    await db.commit()
    await db.refresh(q)

    return {
        "query": _serialize_query(q),
        "enquiry_id": str(enquiry_id),
        "enquiry_number": enquiry_no,
    }


async def link_enquiry(
    db: AsyncSession,
    *,
    query_id: uuid.UUID,
    enquiry_id: uuid.UUID,
) -> IndiaMartQuery:
    q = await db.get(IndiaMartQuery, query_id)
    if q is None:
        raise ValueError("IndiaMart query not found")
    if not _can_pickup(q):
        raise ValueError("This IndiaMart query has already been picked up")
    q.enquiry_id = enquiry_id
    q.is_archived = False
    await db.commit()
    await db.refresh(q)
    return q


async def archive_query(db: AsyncSession, query_id: uuid.UUID) -> IndiaMartQuery:
    q = await db.get(IndiaMartQuery, query_id)
    if q is None:
        raise ValueError("IndiaMart query not found")
    q.is_archived = True
    q.enquiry_id = None
    q.enquiry_number = None
    q.picked_up_by_user_id = None
    q.picked_up_by_name = None
    q.picked_up_at = None
    await db.commit()
    await db.refresh(q)
    return q
