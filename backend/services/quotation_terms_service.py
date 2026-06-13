"""Quotation terms master list (available T&C snippets)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from db.models import QuotationTermTemplate

DEFAULT_TERM_BODIES = [
    "Any modification to agreed specifications may attract additional commercial charges.",
    "Third party inspection, if required — extra at actual and in customer's scope.",
    "Freight — included in valuation total as shown below.",
    "GST @ 18% — included in valuation total as shown below.",
    "P & F @ 3% — included in valuation total as shown below.",
    "Offer validity — 15 days from date of issue.",
    "Subject to Pune jurisdiction only.",
]


def _client_key() -> str:
    return get_settings().ACTIVE_CLIENT


async def _seed_defaults(db: AsyncSession, client_config: str) -> None:
    for i, body in enumerate(DEFAULT_TERM_BODIES):
        db.add(
            QuotationTermTemplate(
                id=uuid.uuid4(),
                client_config=client_config,
                body=body,
                sort_order=i,
            )
        )
    await db.flush()


async def list_term_templates(db: AsyncSession) -> list[dict]:
    client_config = _client_key()
    rows = (
        await db.execute(
            select(QuotationTermTemplate)
            .where(QuotationTermTemplate.client_config == client_config)
            .order_by(QuotationTermTemplate.sort_order, QuotationTermTemplate.created_at),
        )
    ).scalars().all()
    if not rows:
        await _seed_defaults(db, client_config)
        await db.commit()
        rows = (
            await db.execute(
                select(QuotationTermTemplate)
                .where(QuotationTermTemplate.client_config == client_config)
                .order_by(QuotationTermTemplate.sort_order, QuotationTermTemplate.created_at),
            )
        ).scalars().all()
    return [
        {
            "id": str(r.id),
            "body": r.body,
            "sort_order": r.sort_order,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


async def create_term_template(db: AsyncSession, body: str) -> dict:
    text = (body or "").strip()
    if not text:
        raise ValueError("Term text is required")
    if len(text) > 1500:
        raise ValueError("Term text is too long (max 1500 characters)")

    client_config = _client_key()
    max_order = (
        await db.execute(
            select(QuotationTermTemplate.sort_order)
            .where(QuotationTermTemplate.client_config == client_config)
            .order_by(QuotationTermTemplate.sort_order.desc())
            .limit(1),
        )
    ).scalar_one_or_none()
    row = QuotationTermTemplate(
        id=uuid.uuid4(),
        client_config=client_config,
        body=text,
        sort_order=int(max_order or -1) + 1,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {
        "id": str(row.id),
        "body": row.body,
        "sort_order": row.sort_order,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
