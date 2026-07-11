"""IndiaMart lead listing and pickup — sync is configured separately per deployment."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import IndiaMartQuery, IndiaMartSyncState

logger = logging.getLogger(__name__)

QUERY_TYPE_LABELS = {
    "W": "Direct Enquiry",
    "B": "Buy Lead",
    "P": "PNS Call",
    "BIZ": "Catalog View",
    "WA": "WhatsApp Enquiry",
}


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
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        normalized = text.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
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


async def _get_sync_state(db: AsyncSession) -> IndiaMartSyncState | None:
    return await db.get(IndiaMartSyncState, 1)


def _serialize_query(q: IndiaMartQuery) -> dict[str, Any]:
    qtype = (q.query_type or "").strip()
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
        "is_picked_up": q.enquiry_id is not None,
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
) -> dict[str, Any]:
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

    return {
        "queries": [_serialize_query(q) for q in rows],
        "total": len(rows),
        "last_sync_at": state.last_sync_at.isoformat() if state and state.last_sync_at else None,
        "last_sync_status": state.last_sync_status if state else None,
        "last_sync_message": state.last_sync_message if state else None,
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
