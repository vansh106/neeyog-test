"""Financial-year document numbers (India FY Apr–Mar).

* Fiscal code ``2627`` = FY 2026-27 (Apr 2026 – Mar 2027).
* Enquiry: ``262700001`` … ``262799999`` (9 chars).
* Quotation: ``QUO`` + same fiscal code + 5 digits → ``QUO262700001``.
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime, timezone

from sqlalchemy import Integer, cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Enquiry, PurchaseOrder, Quotation


def fiscal_year_code(d: date | datetime) -> str:
    """Return 4-char FY label, e.g. 2026-07-01 → ``2627`` (FY 2026-27)."""
    if isinstance(d, datetime):
        d = d.date()
    y, m = d.year, d.month
    if m >= 4:
        y1, y2 = y, y + 1
    else:
        y1, y2 = y - 1, y
    return f"{y1 % 100:02d}{y2 % 100:02d}"


def _advisory_lock_key(label: str) -> int:
    h = hashlib.sha256(label.encode()).digest()
    n = int.from_bytes(h[:4], "big") or 1
    return n % 2_147_483_646


async def _transaction_serial_lock(db: AsyncSession, label: str) -> None:
    bind = db.get_bind()
    if bind is None or getattr(bind.dialect, "name", None) != "postgresql":
        return
    await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _advisory_lock_key(label)})


async def allocate_enquiry_number(db: AsyncSession) -> str:
    """Next enquiry number for current FY (``262700001`` style)."""
    fy = fiscal_year_code(datetime.now(timezone.utc))
    await _transaction_serial_lock(db, f"enquiry_serial:{fy}")
    ser_col = cast(func.substr(Enquiry.enquiry_number, 5, 5), Integer)
    res = await db.execute(
        select(func.max(ser_col)).where(
            Enquiry.enquiry_number.isnot(None),
            func.length(Enquiry.enquiry_number) == 9,
            func.substr(Enquiry.enquiry_number, 1, 4) == fy,
        )
    )
    mx = res.scalar_one_or_none()
    nxt = (int(mx) if mx is not None else 0) + 1
    if nxt > 99_999:
        raise ValueError(f"Enquiry serial exhausted for FY {fy} (max 99999)")
    return f"{fy}{nxt:05d}"


async def allocate_quote_number(db: AsyncSession) -> str:
    """Next quotation number: ``QUO`` + FY + 5-digit serial."""
    fy = fiscal_year_code(datetime.now(timezone.utc))
    prefix = f"QUO{fy}"
    await _transaction_serial_lock(db, f"quote_serial:{fy}")
    ser_col = cast(func.substr(Quotation.quote_number, 8, 5), Integer)
    res = await db.execute(
        select(func.max(ser_col)).where(
            Quotation.quote_number.like(f"{prefix}%"),
            func.length(Quotation.quote_number) == 12,
        )
    )
    mx = res.scalar_one_or_none()
    nxt = (int(mx) if mx is not None else 0) + 1
    if nxt > 99_999:
        raise ValueError(f"Quotation serial exhausted for FY {fy} (max 99999)")
    return f"{prefix}{nxt:05d}"


async def allocate_po_number(db: AsyncSession) -> str:
    """Next purchase order number: ``PO-4410`` style (global serial)."""
    await _transaction_serial_lock(db, "po_serial:global")
    ser_col = cast(func.substr(PurchaseOrder.po_number, 4), Integer)
    res = await db.execute(
        select(func.max(ser_col)).where(
            PurchaseOrder.po_number.like("PO-%"),
            func.length(PurchaseOrder.po_number) >= 5,
        )
    )
    mx = res.scalar_one_or_none()
    nxt = (int(mx) if mx is not None else 4409) + 1
    if nxt > 999_999:
        raise ValueError("Purchase order serial exhausted (max 999999)")
    return f"PO-{nxt}"
