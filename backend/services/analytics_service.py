"""Booking target and revenue analytics."""

from __future__ import annotations

import calendar
import re
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models import ClientBranch, Enquiry, PurchaseOrder, Quotation, User, UserTier
from services.enquiry_service import item_desc_short_from_enquiry
from services.fiscal_numbering import fiscal_year_code
from services.masters_service import CATEGORY_LABEL_BY_KEY, _category_label
from services.damper_schema import (
    BUTTERFLY_DAMPER_KEY,
    DISCHARGE_DAMPER_KEY,
    DIVERTER_DAMPER_KEY,
    GUILLOTINE_DAMPER_KEY,
    MULTI_LOUVER_DAMPER_KEY,
    SLIDE_GATE_DAMPER_KEY,
    damper_sheet_label,
    is_damper_catalog_key,
)
from services.quotation_service import default_validity_date, listing_fields_from_quotation
from services.quotation_service import item_desc_short_from_lines

IST = ZoneInfo("Asia/Kolkata")


def _today_ist() -> date:
    return datetime.now(IST).date()


def count_working_days(start: date, end: date) -> int:
    """Count Mon–Fri inclusive between start and end."""
    if start > end:
        return 0
    count = 0
    current = start
    while current <= end:
        if current.weekday() < 5:
            count += 1
        current += timedelta(days=1)
    return count


def _month_bounds(year: int, month: int) -> tuple[datetime, datetime, date, date]:
    month_start = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    month_end = date(year, month, last_day)
    start_dt = datetime.combine(month_start, time.min, tzinfo=IST)
    if month == 12:
        next_month_start = date(year + 1, 1, 1)
    else:
        next_month_start = date(year, month + 1, 1)
    end_dt = datetime.combine(next_month_start, time.min, tzinfo=IST)
    return start_dt, end_dt, month_start, month_end


def _prev_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _pct_change(current: float, previous: float) -> float:
    if previous > 0:
        return (current - previous) / previous * 100.0
    if current > 0:
        return 100.0
    return 0.0


async def _quote_stats(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    *,
    start_dt: datetime,
    end_dt: datetime,
) -> tuple[float, int]:
    if not user_ids:
        return 0.0, 0
    stmt = select(
        func.coalesce(func.sum(Quotation.total_amount), 0.0),
        func.count(Quotation.id),
    ).where(
        Quotation.created_at >= start_dt,
        Quotation.created_at < end_dt,
        Quotation.is_archived.is_(False),
        Quotation.created_by_user_id.in_(user_ids),
    )
    result = await db.execute(stmt)
    total, count = result.one()
    return float(total or 0.0), int(count or 0)


async def _po_stats(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    *,
    start_dt: datetime,
    end_dt: datetime,
) -> tuple[float, int]:
    if not user_ids:
        return 0.0, 0
    stmt = select(
        func.coalesce(func.sum(PurchaseOrder.total_amount), 0.0),
        func.count(PurchaseOrder.id),
    ).where(
        PurchaseOrder.created_at >= start_dt,
        PurchaseOrder.created_at < end_dt,
        PurchaseOrder.created_by_user_id.in_(user_ids),
    )
    result = await db.execute(stmt)
    total, count = result.one()
    return float(total or 0.0), int(count or 0)


async def _avg_response_hours(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    *,
    start_dt: datetime,
    end_dt: datetime,
) -> float | None:
    if not user_ids:
        return None
    stmt = select(
        func.avg(
            func.extract("epoch", Quotation.created_at - Enquiry.created_at) / 3600.0
        )
    ).select_from(Quotation).join(Enquiry, Quotation.enquiry_id == Enquiry.id).where(
        Quotation.created_at >= start_dt,
        Quotation.created_at < end_dt,
        Quotation.is_archived.is_(False),
        Enquiry.is_archived.is_(False),
        Quotation.created_by_user_id.in_(user_ids),
    )
    result = await db.execute(stmt)
    value = result.scalar()
    if value is None:
        return None
    return float(value)


async def _enquiry_count(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    *,
    start_dt: datetime,
    end_dt: datetime,
) -> int:
    if not user_ids:
        return 0
    stmt = select(func.count(Enquiry.id)).where(
        Enquiry.created_at >= start_dt,
        Enquiry.created_at < end_dt,
        Enquiry.is_archived.is_(False),
        Enquiry.created_by_user_id.in_(user_ids),
    )
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def get_sales_funnel(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    user_id: str | None = None,
    year: int | None = None,
    month: int | None = None,
) -> dict:
    today = _today_ist()
    year = year or today.year
    month = month or today.month

    user_ids, _scope_label = await _resolve_scope_user_ids(
        db, actor_tier=actor_tier, actor_id=actor_id, user_id=user_id
    )

    start_dt, end_dt, _, _ = _month_bounds(year, month)

    enquiries_count = await _enquiry_count(db, user_ids, start_dt=start_dt, end_dt=end_dt)
    quoted_total, quoted_count = await _quote_stats(db, user_ids, start_dt=start_dt, end_dt=end_dt)
    po_total, po_count = await _po_stats(db, user_ids, start_dt=start_dt, end_dt=end_dt)

    quoted_to_enquiries_pct = (
        (quoted_count / enquiries_count * 100.0) if enquiries_count > 0 else 0.0
    )
    po_to_quoted_pct = (po_count / quoted_count * 100.0) if quoted_count > 0 else 0.0

    avg_quote = (quoted_total / quoted_count) if quoted_count > 0 else 0.0
    enquiries_implied_value = enquiries_count * avg_quote if avg_quote > 0 else float(enquiries_count)

    value_scale = max(enquiries_implied_value, quoted_total, po_total, 1.0)
    enquiries_bar_pct = round(enquiries_implied_value / value_scale * 100.0, 1)
    quoted_bar_pct = round(quoted_total / value_scale * 100.0, 1)
    po_bar_pct = round(po_total / value_scale * 100.0, 1)

    month_label = date(year, month, 1).strftime("%B")

    return {
        "month_label": month_label,
        "month": month,
        "year": year,
        "enquiries": {
            "count": enquiries_count,
            "bar_width_pct": enquiries_bar_pct,
        },
        "quoted": {
            "count": quoted_count,
            "value": round(quoted_total, 2),
            "bar_width_pct": quoted_bar_pct,
            "conversion_from_enquiries_pct": round(quoted_to_enquiries_pct, 1),
        },
        "po_won": {
            "count": po_count,
            "value": round(po_total, 2),
            "bar_width_pct": po_bar_pct,
            "conversion_from_quoted_pct": round(po_to_quoted_pct, 1),
        },
    }


async def get_dashboard_kpis(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    user_id: str | None = None,
    year: int | None = None,
    month: int | None = None,
) -> dict:
    today = _today_ist()
    year = year or today.year
    month = month or today.month

    user_ids, _scope_label = await _resolve_scope_user_ids(
        db, actor_tier=actor_tier, actor_id=actor_id, user_id=user_id
    )

    start_dt, end_dt, month_start, month_end = _month_bounds(year, month)
    prev_year, prev_month = _prev_month(year, month)
    prev_start_dt, prev_end_dt, _, _ = _month_bounds(prev_year, prev_month)

    quoted_total, quoted_count = await _quote_stats(db, user_ids, start_dt=start_dt, end_dt=end_dt)
    prev_quoted_total, _prev_quoted_count = await _quote_stats(
        db, user_ids, start_dt=prev_start_dt, end_dt=prev_end_dt
    )
    quoted_mom_pct = _pct_change(quoted_total, prev_quoted_total)

    po_total, po_count = await _po_stats(db, user_ids, start_dt=start_dt, end_dt=end_dt)
    prev_po_total, _prev_po_count = await _po_stats(
        db, user_ids, start_dt=prev_start_dt, end_dt=prev_end_dt
    )

    win_rate_pct = (po_total / quoted_total * 100.0) if quoted_total > 0 else 0.0
    prev_win_rate_pct = (prev_po_total / prev_quoted_total * 100.0) if prev_quoted_total > 0 else 0.0
    win_rate_pts_change = win_rate_pct - prev_win_rate_pct

    avg_response = await _avg_response_hours(db, user_ids, start_dt=start_dt, end_dt=end_dt)

    week1_end_day = min(7, month_end.day)
    week1_start_dt = datetime.combine(month_start, time.min, tzinfo=IST)
    week1_end_dt = datetime.combine(
        date(year, month, week1_end_day) + timedelta(days=1),
        time.min,
        tzinfo=IST,
    )
    week1_avg_response = await _avg_response_hours(
        db, user_ids, start_dt=week1_start_dt, end_dt=week1_end_dt
    )

    month_label = date(year, month, 1).strftime("%B")
    compare_month_label = date(prev_year, prev_month, 1).strftime("%B")

    return {
        "month_label": month_label,
        "compare_month_label": compare_month_label,
        "quoted_value": {
            "total": round(quoted_total, 2),
            "count": quoted_count,
            "mom_pct_change": round(quoted_mom_pct, 1),
        },
        "po_received": {
            "total": round(po_total, 2),
            "count": po_count,
        },
        "win_rate": {
            "pct": round(win_rate_pct, 1),
            "pts_change": round(win_rate_pts_change, 1),
        },
        "avg_response": {
            "hours": round(avg_response, 1) if avg_response is not None else None,
            "week1_hours": round(week1_avg_response, 1) if week1_avg_response is not None else None,
        },
    }


async def _resolve_scope_user_ids(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    user_id: str | None,
) -> tuple[list[uuid.UUID], str]:
    """Return user IDs in scope and a human-readable scope label."""
    is_admin = actor_tier in (UserTier.ADMIN.value, UserTier.SUPERADMIN.value)

    if not is_admin:
        uid = uuid.UUID(actor_id)
        row = await db.execute(select(User.full_name).where(User.id == uid))
        name = row.scalar_one_or_none() or "You"
        return [uid], name

    if user_id:
        uid = uuid.UUID(user_id)
        row = await db.execute(select(User.full_name, User.is_active).where(User.id == uid))
        found = row.one_or_none()
        if not found:
            raise ValueError("User not found")
        return [uid], found[0]

    result = await db.execute(
        select(User.id).where(
            User.is_active.is_(True),
        )
    )
    ids = list(result.scalars().all())
    return ids, "Whole organization"


async def _sum_targets(db: AsyncSession, user_ids: list[uuid.UUID]) -> float:
    if not user_ids:
        return 0.0
    result = await db.execute(
        select(func.coalesce(func.sum(User.monthly_booking_target), 0.0)).where(User.id.in_(user_ids))
    )
    return float(result.scalar() or 0.0)


async def _sum_achieved(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    *,
    start_dt: datetime,
    end_dt: datetime,
) -> float:
    if not user_ids:
        return 0.0
    stmt = select(func.coalesce(func.sum(PurchaseOrder.total_amount), 0.0)).where(
        PurchaseOrder.created_at >= start_dt,
        PurchaseOrder.created_at < end_dt,
        PurchaseOrder.created_by_user_id.in_(user_ids),
    )
    result = await db.execute(stmt)
    return float(result.scalar() or 0.0)


async def get_booking_target_tracker(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    user_id: str | None = None,
    year: int | None = None,
    month: int | None = None,
) -> dict:
    today = _today_ist()
    year = year or today.year
    month = month or today.month

    user_ids, scope_label = await _resolve_scope_user_ids(
        db, actor_tier=actor_tier, actor_id=actor_id, user_id=user_id
    )

    start_dt, end_dt, month_start, month_end = _month_bounds(year, month)

    total_target = await _sum_targets(db, user_ids)
    achieved_value = await _sum_achieved(db, user_ids, start_dt=start_dt, end_dt=end_dt)

    pct_achieved = (achieved_value / total_target * 100.0) if total_target > 0 else 0.0

    working_days_total = count_working_days(month_start, month_end)
    elapsed_end = min(today, month_end)
    working_days_elapsed = count_working_days(month_start, elapsed_end) if elapsed_end >= month_start else 0
    working_days_left = count_working_days(
        max(today + timedelta(days=1), month_start),
        month_end,
    )

    expected_pace_pct = (
        (working_days_elapsed / working_days_total * 100.0) if working_days_total > 0 else 0.0
    )

    gap = max(total_target - achieved_value, 0.0)
    required_daily_pace = (gap / working_days_left) if working_days_left > 0 else gap

    month_label = date(year, month, 1).strftime("%B")

    return {
        "month_label": month_label,
        "month": month,
        "year": year,
        "scope_label": scope_label,
        "total_target": round(total_target, 2),
        "achieved_value": round(achieved_value, 2),
        "pct_achieved": round(pct_achieved, 1),
        "expected_pace_pct": round(expected_pace_pct, 1),
        "working_days_left": working_days_left,
        "working_days_total": working_days_total,
        "working_days_elapsed": working_days_elapsed,
        "required_daily_pace": round(required_daily_pace, 2),
        "is_behind_schedule": pct_achieved < expected_pace_pct,
    }


TERMINAL_ENQUIRY_STATUSES = frozenset({
    "quoted",
    "approved_sent",
    "failed",
    "parser_failed",
    "matcher_failed",
    "quote_failed",
    "email_rejected",
})

QUOTATION_CRM_LABELS = {
    "ongoing": "Ongoing",
    "po_received": "PO received",
    "lost": "Lost",
}


def _enquiry_client_name(e: Enquiry) -> str:
    branch = getattr(e, "branch", None)
    company = getattr(branch, "company", None) if branch is not None else None
    if company is not None and getattr(company, "company_name", None):
        name = str(company.company_name).strip()
        if name:
            return name
    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    for key in ("client_company", "company_name", "client_name", "organization", "org_name"):
        v = pd.get(key)
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""


def _has_client_in_parsed(e: Enquiry) -> bool:
    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    for key in ("client_company", "company_name", "client_name", "organization", "org_name"):
        v = pd.get(key)
        if v is not None and str(v).strip():
            return True
    return False


def _enquiry_subject(e: Enquiry) -> str:
    client = _enquiry_client_name(e)
    item = item_desc_short_from_enquiry(e)
    if client and item and item != "—":
        return f"{client} - {item}"
    if client:
        return client
    if item and item != "—":
        return item
    eno = (e.enquiry_number or "").strip()
    return eno or f"Enquiry {str(e.id)[:8]}"


def _required_action(e: Enquiry) -> tuple[str, str]:
    status = (e.status or "").lower()
    flow = (e.flow_type or "").lower()

    # Ready (or waiting) for first quotation — most manual / approved enquiries.
    if status in ("received", "approved") or flow == "complete":
        return "Create quote", "quote_pending"

    if status == "pending_client_verification" or (e.company_id is None and not _has_client_in_parsed(e)):
        return "Identify client", "unidentified_sender"
    if flow == "product_incomplete" or status == "matcher_ready":
        return "Match incomplete", "match_incomplete"
    if flow == "ambiguous":
        return "Resolve ambiguity", "resolve_ambiguity"
    if e.missing_fields:
        return "Missing fields", "missing_fields"
    if flow in ("incomplete", "not_found") or status == "awaiting_info":
        return "Identify + spec", "identify_spec"
    return "Create quote", "quote_pending"


def _aging_days(created_at: datetime) -> int:
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=ZoneInfo("UTC"))
    created_date = created_at.astimezone(IST).date()
    return max((_today_ist() - created_date).days, 0)


def _due_meta(due: date | None, today: date) -> tuple[str, str, int]:
    """Return label, urgency tier, and sort rank (lower = more urgent)."""
    if due is None:
        return "No date set", "none", 2
    delta = (due - today).days
    if delta < 0:
        days = abs(delta)
        label = f"Overdue {days}d" if days != 1 else "Overdue 1d"
        return label, "overdue", -1000 + delta
    if delta == 0:
        return "Due today", "today", 0
    if delta <= 2:
        return f"Due in {delta}d" if delta > 0 else "Due today", "soon", delta
    return due.strftime("%d %b"), "neutral", 100 + delta


def _follow_up_due_meta(due: date | None, today: date) -> tuple[str, str, int]:
    """Follow-up reminders: expired (set new date), today, or tomorrow only."""
    if due is None:
        return "Follow-up missing — set new date", "expired", -3000
    delta = (due - today).days
    if delta < 0:
        days = abs(delta)
        if days == 1:
            label = "Expired yesterday — set new date"
        else:
            label = f"Expired {days}d ago — set new date"
        return label, "expired", -2000 + delta
    if delta == 0:
        return "Due today", "today", 0
    if delta == 1:
        return "Due tomorrow", "soon", 1
    return due.strftime("%d %b"), "neutral", 100 + delta


def _follow_up_needs_reminder(due: date | None, today: date) -> bool:
    if due is None:
        return True
    return (due - today).days <= 1


def _quotation_account_name(q: Quotation) -> str:
    return (q.client_company or q.client_name or "Unknown").strip() or "Unknown"


def _quotation_client_product(q: Quotation) -> str:
    client = (q.client_company or q.client_name or "Unknown").strip() or "Unknown"
    lines = q.line_items if isinstance(q.line_items, list) else []
    item = item_desc_short_from_lines(lines) if lines else ""
    if item and item != "—":
        return f"{client} — {item}"
    return client


async def get_action_queues(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    user_id: str | None = None,
) -> dict:
    user_ids, _scope_label = await _resolve_scope_user_ids(
        db, actor_tier=actor_tier, actor_id=actor_id, user_id=user_id
    )
    today = _today_ist()

    has_quotation = exists(
        select(1).where(
            Quotation.enquiry_id == Enquiry.id,
            Quotation.is_archived.is_(False),
        )
    )
    enquiry_stmt = (
        select(Enquiry)
        .options(selectinload(Enquiry.branch).selectinload(ClientBranch.company))
        .where(
            ~has_quotation,
            Enquiry.is_archived.is_(False),
            Enquiry.status.notin_(list(TERMINAL_ENQUIRY_STATUSES)),
        )
    )
    if user_ids:
        enquiry_stmt = enquiry_stmt.where(Enquiry.created_by_user_id.in_(user_ids))

    enquiry_rows = list((await db.execute(enquiry_stmt)).scalars().all())
    incomplete_items: list[dict] = []
    for e in enquiry_rows:
        action_label, action_type = _required_action(e)
        aging = _aging_days(e.created_at)
        incomplete_items.append(
            {
                "enquiry_id": str(e.id),
                "subject": _enquiry_subject(e),
                "required_action": action_label,
                "action_type": action_type,
                "aging_days": aging,
            }
        )
    incomplete_items.sort(key=lambda x: (-x["aging_days"], x["subject"]))

    follow_items: list[dict] = []

    enquiry_follow_stmt = select(Enquiry).options(
        selectinload(Enquiry.branch).selectinload(ClientBranch.company)
    ).where(
        Enquiry.is_archived.is_(False),
        Enquiry.status.notin_(list(TERMINAL_ENQUIRY_STATUSES)),
        ~exists(
            select(1).where(
                Quotation.enquiry_id == Enquiry.id,
                Quotation.is_archived.is_(False),
                Quotation.status.in_(["ongoing", "hold"]),
            )
        ),
    )
    if user_ids:
        enquiry_follow_stmt = enquiry_follow_stmt.where(Enquiry.created_by_user_id.in_(user_ids))
    enquiry_follow_rows = list((await db.execute(enquiry_follow_stmt)).scalars().all())
    for e in enquiry_follow_rows:
        due = getattr(e, "next_follow_up_date", None)
        if not _follow_up_needs_reminder(due, today):
            continue
        due_label, due_urgency, due_rank = _follow_up_due_meta(due, today)
        follow_items.append(
            {
                "entity_type": "enquiry",
                "entity_id": str(e.id),
                "enquiry_id": str(e.id),
                "quotation_id": None,
                "client_product": _enquiry_subject(e),
                "deal_value": 0.0,
                "due_label": due_label,
                "due_urgency": due_urgency,
                "due_rank": due_rank,
                "next_follow_up_date": due.isoformat() if due else None,
                "status": "enquiry",
                "status_label": "Enquiry",
            }
        )

    follow_stmt = select(Quotation).where(
        Quotation.is_archived.is_(False),
        Quotation.status.in_(["ongoing", "hold"]),
    )
    if user_ids:
        follow_stmt = follow_stmt.where(Quotation.created_by_user_id.in_(user_ids))

    follow_rows = list((await db.execute(follow_stmt)).scalars().all())
    for q in follow_rows:
        due = q.next_follow_up_date
        if not _follow_up_needs_reminder(due, today):
            continue
        due_label, due_urgency, due_rank = _follow_up_due_meta(due, today)
        status_key = (q.status or "ongoing").lower()
        follow_items.append(
            {
                "entity_type": "quotation",
                "entity_id": str(q.id),
                "quotation_id": str(q.id),
                "enquiry_id": str(q.enquiry_id),
                "client_product": _quotation_client_product(q),
                "deal_value": round(float(q.total_amount or 0.0), 2),
                "due_label": due_label,
                "due_urgency": due_urgency,
                "due_rank": due_rank,
                "next_follow_up_date": due.isoformat() if due else None,
                "status": status_key,
                "status_label": QUOTATION_CRM_LABELS.get(
                    status_key, status_key.replace("_", " ").title()
                ),
            }
        )
    follow_items.sort(key=lambda x: (x["due_rank"], -x["deal_value"]))

    expired_items = [x for x in follow_items if x["due_urgency"] == "expired"]
    due_soon_items = [x for x in follow_items if x["due_urgency"] in ("today", "soon")]

    so_cutoff = datetime.now(IST) - timedelta(hours=24)
    so_stmt = select(PurchaseOrder).where(
        PurchaseOrder.so_date.is_(None),
        PurchaseOrder.created_at < so_cutoff,
    )
    if user_ids:
        so_stmt = so_stmt.where(PurchaseOrder.created_by_user_id.in_(user_ids))
    so_rows = list((await db.execute(so_stmt)).scalars().all())
    so_items: list[dict] = []
    for po in so_rows:
        created = po.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=ZoneInfo("UTC"))
        hours = max(int((datetime.now(IST) - created.astimezone(IST)).total_seconds() // 3600), 24)
        days = hours // 24
        if days <= 1:
            overdue_label = "SO date not entered (24h+)"
        else:
            overdue_label = f"SO date not entered ({days}d)"
        client = (po.client_company or po.client_name or "Unknown").strip() or "Unknown"
        so_items.append(
            {
                "po_id": str(po.id),
                "po_number": po.po_number,
                "client_name": client,
                "quote_number": po.quote_number,
                "quotation_id": str(po.quotation_id) if po.quotation_id else None,
                "total_amount": round(float(po.total_amount or 0.0), 2),
                "hours_overdue": hours,
                "due_label": overdue_label,
                "created_at": po.created_at.isoformat() if po.created_at else None,
            }
        )
    so_items.sort(key=lambda x: (-x["hours_overdue"], x["po_number"]))

    alert_accounts: dict[str, dict] = {}
    for item in follow_items:
        if item["due_urgency"] != "expired":
            continue
        account = item["client_product"].split(" — ", 1)[0]
        amount = float(item["deal_value"] or 0.0)
        if account not in alert_accounts:
            alert_accounts[account] = {
                "account_name": account,
                "expiring_value": 0.0,
                "no_follow_up_logged": False,
                "has_overdue": True,
            }
        alert_accounts[account]["expiring_value"] += amount
        if item["next_follow_up_date"] is None:
            alert_accounts[account]["no_follow_up_logged"] = True

    account_breakdown = sorted(
        [
            {
                "account_name": row["account_name"],
                "expiring_value": round(row["expiring_value"], 2),
                "no_follow_up_logged": row["no_follow_up_logged"],
                "has_overdue": row["has_overdue"],
            }
            for row in alert_accounts.values()
        ],
        key=lambda x: (-x["expiring_value"], x["account_name"]),
    )
    expired_pipeline_total = round(sum(x["deal_value"] for x in expired_items), 2)
    due_soon_pipeline_total = round(sum(x["deal_value"] for x in due_soon_items), 2)
    follow_pipeline_total = round(sum(x["deal_value"] for x in follow_items), 2)

    return {
        "incomplete_enquiries": {
            "count": len(incomplete_items),
            "items": incomplete_items,
        },
        "follow_ups_due": {
            "count": len(follow_items),
            "expired_count": len(expired_items),
            "due_soon_count": len(due_soon_items),
            "pipeline_value": follow_pipeline_total,
            "items": follow_items,
        },
        "so_dates_pending": {
            "count": len(so_items),
            "items": so_items,
        },
        "quote_expiry": {
            "has_expiring_quotes": len(expired_items) > 0 or len(due_soon_items) > 0,
            "has_expired_follow_ups": len(expired_items) > 0,
            "expired_count": len(expired_items),
            "expired_value": expired_pipeline_total,
            "due_soon_count": len(due_soon_items),
            "due_soon_value": due_soon_pipeline_total,
            "expiring_value": expired_pipeline_total or due_soon_pipeline_total,
            "timeframe_days": 1,
            "accounts": account_breakdown,
        },
    }


ENQUIRY_SOURCE_VALUES = frozenset({"email", "indiamart", "manual", "referral"})

LOST_REASON_RULES: list[tuple[str, list[str]]] = [
    ("Price", ["price", "pricing", "cost", "expensive", "costly", "budget", "cheaper", "high price"]),
    ("Delivery time", ["delivery", "lead time", "lead-time", "timeline", "dispatch", "freight"]),
    ("No response", ["no response", "ghost", "silent", "unresponsive", "did not reply", "no reply"]),
    ("Locally purchased", ["locally purchased", "local purchase", "bought locally", "local vendor"]),
    ("Specification", ["spec", "technical", "dimension", "material", "compatibility"]),
]

SOURCE_CHANNEL_LABELS = {
    "repeat": "Repeat customers",
    "email": "Direct email",
    "indiamart": "IndiaMart",
    "manual": "Manual / walk-in",
    "referral": "Referral",
    "unknown": "Other",
}

SOURCE_CHANNEL_COLORS = {
    "repeat": "#2A6B3C",
    "email": "#3B82F6",
    "indiamart": "#EA580C",
    "manual": "#7C3AED",
    "referral": "#059669",
    "unknown": "#6B7280",
}


def _enquiry_source(e: Enquiry) -> str:
    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    raw = str(pd.get("enquiry_source") or "").strip().lower()
    if raw in ENQUIRY_SOURCE_VALUES:
        return raw
    it = (e.input_type or "").strip().lower()
    if it in ("email", "email_sync"):
        return "email"
    if it == "indiamart":
        return "indiamart"
    if it in ("manual", "manual_dropdown"):
        return "manual"
    return "email"


def _categorize_lost_reason(remarks: str | None) -> str:
    text = (remarks or "").lower()
    for label, keywords in LOST_REASON_RULES:
        if any(k in text for k in keywords):
            return label
    if not text.strip():
        return "Unspecified"
    return "Other"


def _quote_product_category(q: Quotation) -> str:
    lines = q.line_items if isinstance(q.line_items, list) else []
    for line in lines:
        if not isinstance(line, dict):
            continue
        for key in ("category", "primary_category", "product_name"):
            val = str(line.get(key) or "").strip()
            if val:
                return val[:40]
    return "Others"


def _week_bounds_in_month(year: int, month: int, week_num: int) -> tuple[datetime, datetime]:
    month_start, month_end = _month_bounds(year, month)[2], _month_bounds(year, month)[3]
    start_day = (week_num - 1) * 7 + 1
    if start_day > month_end.day:
        start_day = month_end.day + 1
    end_day = min(week_num * 7, month_end.day)
    if start_day > month_end.day:
        start_dt = datetime.combine(month_end + timedelta(days=1), time.min, tzinfo=IST)
        return start_dt, start_dt
    week_start = date(year, month, start_day)
    week_end = date(year, month, end_day)
    start_dt = datetime.combine(week_start, time.min, tzinfo=IST)
    end_dt = datetime.combine(week_end + timedelta(days=1), time.min, tzinfo=IST)
    return start_dt, end_dt


def _iter_last_n_months(n: int, end_year: int, end_month: int) -> list[tuple[int, int]]:
    months: list[tuple[int, int]] = []
    y, m = end_year, end_month
    for _ in range(n):
        months.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(months))


def _normalize_category_key(raw: str) -> str:
    """Map line-item / PO category strings to stable catalog keys for analytics."""
    s = (raw or "").strip().lower()
    if not s or s in ("other", "others"):
        return "others"
    if s in CATEGORY_LABEL_BY_KEY:
        return s
    snake = re.sub(r"[\s\-]+", "_", s)
    if snake in CATEGORY_LABEL_BY_KEY:
        return snake
    if snake in ("ball_valve", "ball_valves"):
        return "legacy:ball_valve"
    if snake in ("butterfly_damper",):
        return BUTTERFLY_DAMPER_KEY
    if snake in ("multi_louver_damper", "multi_louver"):
        return MULTI_LOUVER_DAMPER_KEY
    if snake in ("slide_gate_damper", "slide_gate"):
        return SLIDE_GATE_DAMPER_KEY
    if snake in ("guillotine_damper", "guillotine", "gullotine_damper", "gullotine"):
        return GUILLOTINE_DAMPER_KEY
    if snake in ("diverter_damper", "diverter"):
        return DIVERTER_DAMPER_KEY
    if snake in ("discharge_damper", "discharge"):
        return DISCHARGE_DAMPER_KEY
    if is_damper_catalog_key(snake):
        return snake
    if snake in ("fp_damper", "dampers", "damper"):
        return "coarse:dampers"
    if snake in ("valve", "valves"):
        return "coarse:valves"
    if "hose" in snake and not snake.startswith("fp_"):
        return "coarse:hoses"
    if "damper" in snake and not snake.startswith("fp_"):
        return "coarse:dampers"
    if "fitting" in snake and not snake.startswith("fp_"):
        return "coarse:fittings"
    if snake in ("bfv", "butterfly_valve", "butterfly_valves"):
        return "butterfly_valve"
    return f"unknown:{snake}"


def _category_metric_label(key: str) -> str:
    if key == "others":
        return "Others"
    if is_damper_catalog_key(key):
        return damper_sheet_label(key)
    if key.startswith("coarse:"):
        return key.split(":", 1)[1].replace("_", " ").title()
    if key.startswith("legacy:"):
        return key.split(":", 1)[1].replace("_", " ").title()
    if key.startswith("unknown:"):
        return key.split(":", 1)[1].replace("_", " ").title()
    return _category_label(key)


def _category_abbr(label: str) -> str:
    lower = label.lower()
    if "butterfly" in lower:
        return "BFV"
    if "hose" in lower:
        return "Hoses"
    if "damper" in lower:
        return "Dampers"
    if "fitting" in lower:
        return "Fittings"
    words = [w for w in label.split() if w]
    if len(words) >= 2:
        return "".join(w[0].upper() for w in words[:3])
    return label[:4].upper() if label else "—"


def _line_amount(line: dict) -> float:
    amt = float(line.get("line_total") or line.get("total") or 0.0)
    if amt <= 0:
        unit = float(line.get("unit_price") or 0.0)
        qty = float(line.get("quantity") or 1.0)
        amt = unit * qty
    return amt


def _line_value_by_category(lines: list) -> dict[str, float]:
    out: dict[str, float] = {}
    for line in lines:
        if not isinstance(line, dict):
            continue
        raw = str(line.get("category") or line.get("primary_category") or "Others").strip() or "Others"
        key = _normalize_category_key(raw)
        out[key] = out.get(key, 0.0) + _line_amount(line)
    return out


def _quotation_value_by_category(q: Quotation) -> dict[str, float]:
    lines = q.line_items if isinstance(q.line_items, list) else []
    out = _line_value_by_category(lines)
    if not out and q.total_amount:
        out["others"] = float(q.total_amount)
    return out


def _order_value_by_category(po: PurchaseOrder) -> dict[str, float]:
    lines = po.line_items if isinstance(po.line_items, list) else []
    out = _line_value_by_category(lines)
    if not out and po.total_amount:
        key = _normalize_category_key(po.primary_category or "Others")
        out[key] = float(po.total_amount)
    return out


async def get_dashboard_charts(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    user_id: str | None = None,
    year: int | None = None,
    month: int | None = None,
) -> dict:
    today = _today_ist()
    year = year or today.year
    month = month or today.month

    user_ids, _scope_label = await _resolve_scope_user_ids(
        db, actor_tier=actor_tier, actor_id=actor_id, user_id=user_id
    )

    start_dt, end_dt, month_start, month_end = _month_bounds(year, month)
    month_label = date(year, month, 1).strftime("%B")

    # --- Lost quote reasons (MTD) ---
    lost_stmt = select(Quotation).where(
        Quotation.status == "lost",
        Quotation.is_archived.is_(False),
        Quotation.updated_at >= start_dt,
        Quotation.updated_at < end_dt,
    )
    if user_ids:
        lost_stmt = lost_stmt.where(Quotation.created_by_user_id.in_(user_ids))
    lost_rows = list((await db.execute(lost_stmt)).scalars().all())

    reason_counts: dict[str, int] = {}
    price_category_counts: dict[str, int] = {}
    for q in lost_rows:
        reason = _categorize_lost_reason(q.status_remarks)
        reason_counts[reason] = reason_counts.get(reason, 0) + 1
        if reason == "Price":
            cat = _quote_product_category(q)
            price_category_counts[cat] = price_category_counts.get(cat, 0) + 1

    lost_reasons = sorted(
        [{"reason": k, "count": v} for k, v in reason_counts.items()],
        key=lambda x: (-x["count"], x["reason"]),
    )
    lost_total = sum(r["count"] for r in lost_reasons)
    max_count = lost_reasons[0]["count"] if lost_reasons else 0

    insights: list[str] = []
    if price_category_counts:
        top_cat = max(price_category_counts.items(), key=lambda x: x[1])
        if top_cat[1] >= 2:
            insights.append(f"Price losses concentrated in {top_cat[0]}.")
    if lost_reasons and lost_reasons[0]["reason"] == "Price" and lost_total > 0:
        share = round(lost_reasons[0]["count"] / lost_total * 100)
        if share >= 40 and not insights:
            insights.append(f"Price accounts for {share}% of lost quotes this month.")

    lost_reason_items = [
        {
            "reason": r["reason"],
            "count": r["count"],
            "bar_width_pct": round(r["count"] / max_count * 100.0, 1) if max_count > 0 else 0,
            "is_top": r["count"] == max_count and max_count > 0,
        }
        for r in lost_reasons
    ]

    # --- PO won by acquisition source (MTD) ---
    po_stmt = (
        select(PurchaseOrder, Enquiry)
        .outerjoin(Quotation, PurchaseOrder.quotation_id == Quotation.id)
        .outerjoin(Enquiry, Quotation.enquiry_id == Enquiry.id)
        .where(
            PurchaseOrder.created_at >= start_dt,
            PurchaseOrder.created_at < end_dt,
        )
    )
    if user_ids:
        po_stmt = po_stmt.where(PurchaseOrder.created_by_user_id.in_(user_ids))
    po_rows = list((await db.execute(po_stmt)).all())

    client_earliest: dict[str, datetime] = {}
    hist_stmt = select(
        PurchaseOrder.client_company,
        PurchaseOrder.client_name,
        PurchaseOrder.created_at,
    )
    if user_ids:
        hist_stmt = hist_stmt.where(PurchaseOrder.created_by_user_id.in_(user_ids))
    for co, cn, created_at in (await db.execute(hist_stmt)).all():
        key = (co or cn or "").strip().lower()
        if not key or created_at is None:
            continue
        if key not in client_earliest or created_at < client_earliest[key]:
            client_earliest[key] = created_at

    channel_stats: dict[str, dict] = {}
    for po, enquiry in po_rows:
        client_key = (po.client_company or po.client_name or "").strip().lower()
        if client_key and client_key in client_earliest and client_earliest[client_key] < po.created_at:
            channel_key = "repeat"
        elif enquiry is not None:
            channel_key = _enquiry_source(enquiry)
        else:
            channel_key = "manual"
        amount = float(po.total_amount or 0.0)
        if channel_key not in channel_stats:
            channel_stats[channel_key] = {"won_value": 0.0, "po_count": 0}
        channel_stats[channel_key]["won_value"] += amount
        channel_stats[channel_key]["po_count"] += 1

    won_total = sum(s["won_value"] for s in channel_stats.values())
    source_rows = sorted(
        [
            {
                "channel_key": key,
                "channel_label": SOURCE_CHANNEL_LABELS.get(key, key.replace("_", " ").title()),
                "won_value": round(stats["won_value"], 2),
                "po_count": stats["po_count"],
                "share_pct": round(stats["won_value"] / won_total * 100.0, 1) if won_total > 0 else 0.0,
                "bar_color": SOURCE_CHANNEL_COLORS.get(key, SOURCE_CHANNEL_COLORS["unknown"]),
            }
            for key, stats in channel_stats.items()
        ],
        key=lambda x: -x["won_value"],
    )

    # --- Weekly response speed (weeks in current month) ---
    weekly_points: list[dict] = []
    best_week: int | None = None
    best_hours: float | None = None
    num_weeks = min(5, (month_end.day + 6) // 7)
    for w in range(1, num_weeks + 1):
        w_start, w_end = _week_bounds_in_month(year, month, w)
        if w_start >= w_end:
            continue
        avg_h = await _avg_response_hours(db, user_ids, start_dt=w_start, end_dt=w_end)
        if avg_h is None:
            continue
        rounded = round(avg_h, 1)
        weekly_points.append({"week_label": f"W{w}", "week": w, "avg_hours": rounded})
        if best_hours is None or rounded < best_hours:
            best_hours = rounded
            best_week = w

    for pt in weekly_points:
        pt["is_milestone"] = pt["week"] == best_week and best_hours is not None

    # --- 6-month won value trend ---
    trend_months = _iter_last_n_months(6, year, month)
    won_trend_points: list[dict] = []
    for y, m in trend_months:
        m_start, m_end, _, _ = _month_bounds(y, m)
        won_val, _ = await _po_stats(db, user_ids, start_dt=m_start, end_dt=m_end)
        won_trend_points.append(
            {
                "year": y,
                "month": m,
                "month_label": date(y, m, 1).strftime("%b"),
                "won_value": round(won_val, 2),
                "is_current": y == year and m == month,
            }
        )

    # --- Category performance matrix (current month) ---
    quoted_by_cat: dict[str, float] = {}
    quote_cat_stmt = select(Quotation).where(
        Quotation.is_archived.is_(False),
        Quotation.created_at >= start_dt,
        Quotation.created_at < end_dt,
    )
    if user_ids:
        quote_cat_stmt = quote_cat_stmt.where(Quotation.created_by_user_id.in_(user_ids))
    for q in (await db.execute(quote_cat_stmt)).scalars().all():
        for cat, amt in _quotation_value_by_category(q).items():
            quoted_by_cat[cat] = quoted_by_cat.get(cat, 0.0) + amt

    won_by_cat: dict[str, float] = {}
    po_cat_count: dict[str, int] = {}
    for po, _enq in po_rows:
        for cat, amt in _order_value_by_category(po).items():
            won_by_cat[cat] = won_by_cat.get(cat, 0.0) + amt
            po_cat_count[cat] = po_cat_count.get(cat, 0) + 1

    all_cats = set(won_by_cat) | set(quoted_by_cat)
    category_rows_raw: list[dict] = []
    for cat in all_cats:
        won = won_by_cat.get(cat, 0.0)
        quoted = quoted_by_cat.get(cat, 0.0)
        win_rate = (won / quoted * 100.0) if quoted > 0 else (100.0 if won > 0 else 0.0)
        label = _category_metric_label(cat)
        category_rows_raw.append(
            {
                "category_key": cat,
                "category_label": label,
                "category_abbr": _category_abbr(label),
                "won_value": round(won, 2),
                "quoted_value": round(quoted, 2),
                "win_rate_pct": round(win_rate, 1),
                "po_count": po_cat_count.get(cat, 0),
            }
        )

    win_rates = [r["win_rate_pct"] for r in category_rows_raw if r["quoted_value"] > 0 or r["won_value"] > 0]
    median_rate = sorted(win_rates)[len(win_rates) // 2] if win_rates else 0.0
    category_rows: list[dict] = []
    for row in category_rows_raw:
        if row["quoted_value"] <= 0 and row["won_value"] <= 0:
            tier = "neutral"
        elif row["win_rate_pct"] >= median_rate + 5:
            tier = "high"
        elif row["win_rate_pct"] <= median_rate - 5:
            tier = "low"
        else:
            tier = "medium"
        category_rows.append({**row, "win_rate_tier": tier})

    cat_insight: str | None = None
    cat_highlight: str | None = None

    return {
        "month_label": month_label,
        "lost_reasons": {
            "total": lost_total,
            "reasons": lost_reason_items,
            "insights": insights,
        },
        "won_by_source": {
            "total_won_value": round(won_total, 2),
            "sources": source_rows,
        },
        "weekly_response": {
            "weeks": weekly_points,
            "milestone_week": best_week,
            "milestone_hours": best_hours,
            "target_hours": 4.0,
        },
        "won_value_trend": {
            "months": won_trend_points,
        },
        "category_performance": {
            "categories": category_rows,
            "insight": cat_insight,
            "highlight_token": cat_highlight,
        },
    }


def _iter_fy_months_to_date(today: date) -> list[tuple[int, int, bool]]:
    """FY months from April through ``today`` (inclusive)."""
    start_year = today.year if today.month >= 4 else today.year - 1
    months: list[tuple[int, int, bool]] = []
    y, m = start_year, 4
    while True:
        if y > start_year + 1:
            break
        if y == start_year + 1 and m > 3:
            break
        if date(y, m, 1) > date(today.year, today.month, 1):
            break
        is_mtd = y == today.year and m == today.month
        months.append((y, m, is_mtd))
        if m == 12:
            y += 1
            m = 1
        else:
            m += 1
    return months


def _month_row_label(year: int, month: int, is_mtd: bool) -> str:
    abbr = date(year, month, 1).strftime("%b")
    return f"{abbr} (MTD)" if is_mtd else abbr


def _conv_pct(po_value: float, quoted_value: float) -> float:
    if quoted_value > 0:
        return po_value / quoted_value * 100.0
    return 0.0


async def get_pipeline_register(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    user_id: str | None = None,
) -> dict:
    today = _today_ist()
    user_ids, _scope = await _resolve_scope_user_ids(
        db, actor_tier=actor_tier, actor_id=actor_id, user_id=user_id
    )

    fy_code = fiscal_year_code(today)
    fy_title = f"FY {fy_code[:2]}-{fy_code[2:]}"

    rows: list[dict] = []
    totals = {
        "enquiry_count": 0,
        "quote_count": 0,
        "quoted_value": 0.0,
        "po_count": 0,
        "po_value": 0.0,
    }

    for y, m, is_mtd in _iter_fy_months_to_date(today):
        start_dt, end_dt, _, _ = _month_bounds(y, m)
        enq_count = await _enquiry_count(db, user_ids, start_dt=start_dt, end_dt=end_dt)
        quoted_total, quote_count = await _quote_stats(db, user_ids, start_dt=start_dt, end_dt=end_dt)
        po_total, po_count = await _po_stats(db, user_ids, start_dt=start_dt, end_dt=end_dt)
        conv = _conv_pct(po_total, quoted_total)

        rows.append(
            {
                "row_key": f"{y}-{m:02d}",
                "year": y,
                "month": m,
                "month_label": _month_row_label(y, m, is_mtd),
                "is_mtd": is_mtd,
                "is_total": False,
                "enquiry_count": enq_count,
                "quote_count": quote_count,
                "quoted_value": round(quoted_total, 2),
                "po_count": po_count,
                "po_value": round(po_total, 2),
                "conversion_pct": round(conv, 1),
            }
        )
        totals["enquiry_count"] += enq_count
        totals["quote_count"] += quote_count
        totals["quoted_value"] += quoted_total
        totals["po_count"] += po_count
        totals["po_value"] += po_total

    fy_conv = _conv_pct(totals["po_value"], totals["quoted_value"])
    rows.append(
        {
            "row_key": "fy-total",
            "year": None,
            "month": None,
            "month_label": "FY total",
            "is_mtd": False,
            "is_total": True,
            "enquiry_count": totals["enquiry_count"],
            "quote_count": totals["quote_count"],
            "quoted_value": round(totals["quoted_value"], 2),
            "po_count": totals["po_count"],
            "po_value": round(totals["po_value"], 2),
            "conversion_pct": round(fy_conv, 1),
        }
    )

    monthly_convs = [r["conversion_pct"] for r in rows if not r["is_total"] and r["quoted_value"] > 0]
    conv_min = min(monthly_convs) if monthly_convs else 0.0
    conv_max = max(monthly_convs) if monthly_convs else 0.0

    return {
        "fy_label": fy_title,
        "rows": rows,
        "conversion_range": {"min": conv_min, "max": conv_max},
    }


async def get_pipeline_month_enquiries(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    year: int,
    month: int,
    user_id: str | None = None,
) -> dict:
    user_ids, _scope = await _resolve_scope_user_ids(
        db, actor_tier=actor_tier, actor_id=actor_id, user_id=user_id
    )

    start_dt, end_dt, _, _ = _month_bounds(year, month)
    stmt = (
        select(Enquiry)
        .options(selectinload(Enquiry.branch).selectinload(ClientBranch.company))
        .where(Enquiry.created_at >= start_dt, Enquiry.created_at < end_dt, Enquiry.is_archived.is_(False))
        .order_by(Enquiry.created_at.desc())
    )
    if user_ids:
        stmt = stmt.where(Enquiry.created_by_user_id.in_(user_ids))

    enquiries = list((await db.execute(stmt)).scalars().all())
    enquiry_ids = [e.id for e in enquiries]
    quotes_map = await _latest_quotations_by_enquiry_ids(db, enquiry_ids)

    items: list[dict] = []
    for e in enquiries:
        q = quotes_map.get(str(e.id))
        quoted_value = float(q.total_amount) if q else None
        items.append(
            {
                "enquiry_id": str(e.id),
                "enquiry_number": e.enquiry_number,
                "subject": _enquiry_subject(e),
                "status": e.status,
                "flow_type": e.flow_type,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "quoted_value": round(quoted_value, 2) if quoted_value is not None else None,
                "quote_number": q.quote_number if q else None,
            }
        )

    return {
        "year": year,
        "month": month,
        "month_label": _month_row_label(year, month, False),
        "count": len(items),
        "items": items,
    }


async def _latest_quotations_by_enquiry_ids(
    db: AsyncSession,
    enquiry_ids: list,
) -> dict[str, Quotation]:
    if not enquiry_ids:
        return {}
    stmt = (
        select(Quotation)
        .where(Quotation.enquiry_id.in_(enquiry_ids), Quotation.is_archived.is_(False))
        .order_by(Quotation.created_at.desc())
    )
    result = await db.execute(stmt)
    out: dict[str, Quotation] = {}
    for q in result.scalars().all():
        key = str(q.enquiry_id)
        if key not in out:
            out[key] = q
    return out


CONVERSION_PIPELINE_GROUP_BY = frozenset({"month", "user", "category", "customer"})


@dataclass
class ReportScopeData:
    date_from: date
    date_to: date
    start_dt: datetime
    end_dt: datetime
    user_ids: list[uuid.UUID]
    scope_label: str
    enquiries: list[Enquiry]
    quotations: list[Quotation]
    purchase_orders: list[PurchaseOrder]
    user_names: dict[str, str]
    client_earliest_po: dict[str, datetime]
    response_hours_by_user: dict[str, float]
    team_avg_response_hours: float | None


async def _load_report_scope_data(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> ReportScopeData:
    if date_from > date_to:
        raise ValueError("date_from must be on or before date_to")

    start_dt, end_dt = _date_range_bounds(date_from, date_to)
    user_ids, scope_label = await _resolve_scope_user_ids(
        db, actor_tier=actor_tier, actor_id=actor_id, user_id=user_id
    )

    enq_stmt = (
        select(Enquiry)
        .options(
            selectinload(Enquiry.branch).selectinload(ClientBranch.company),
            selectinload(Enquiry.quotations),
        )
        .where(Enquiry.created_at >= start_dt, Enquiry.created_at < end_dt, Enquiry.is_archived.is_(False))
    )
    if user_ids:
        enq_stmt = enq_stmt.where(Enquiry.created_by_user_id.in_(user_ids))

    quote_stmt = (
        select(Quotation)
        .options(selectinload(Quotation.enquiry))
        .where(
            Quotation.is_archived.is_(False),
            Quotation.created_at >= start_dt,
            Quotation.created_at < end_dt,
        )
    )
    if user_ids:
        quote_stmt = quote_stmt.where(Quotation.created_by_user_id.in_(user_ids))

    po_stmt = (
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.quotation).selectinload(Quotation.enquiry),
        )
        .where(PurchaseOrder.created_at >= start_dt, PurchaseOrder.created_at < end_dt)
    )
    if user_ids:
        po_stmt = po_stmt.where(PurchaseOrder.created_by_user_id.in_(user_ids))

    enquiries = list((await db.execute(enq_stmt)).scalars().all())
    quotations = list((await db.execute(quote_stmt)).scalars().all())
    purchase_orders = list((await db.execute(po_stmt)).scalars().all())

    user_stmt = select(User.id, User.full_name).where(User.is_active.is_(True))
    if user_ids:
        user_stmt = user_stmt.where(User.id.in_(user_ids))
    user_names = {
        str(uid): (name or "Unknown").strip() or "Unknown"
        for uid, name in (await db.execute(user_stmt)).all()
    }

    client_earliest = await _client_earliest_po_map(db, user_ids)
    response_hours_by_user = (
        await _avg_response_hours_by_user(db, user_ids, start_dt=start_dt, end_dt=end_dt)
        if user_ids
        else {}
    )
    team_avg_response_hours = (
        await _avg_response_hours(db, user_ids, start_dt=start_dt, end_dt=end_dt) if user_ids else None
    )

    return ReportScopeData(
        date_from=date_from,
        date_to=date_to,
        start_dt=start_dt,
        end_dt=end_dt,
        user_ids=user_ids,
        scope_label=scope_label,
        enquiries=enquiries,
        quotations=quotations,
        purchase_orders=purchase_orders,
        user_names=user_names,
        client_earliest_po=client_earliest,
        response_hours_by_user=response_hours_by_user,
        team_avg_response_hours=team_avg_response_hours,
    )


def _date_range_bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    start_dt = datetime.combine(date_from, time.min, tzinfo=IST)
    end_dt = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=IST)
    return start_dt, end_dt


def _iter_months_between(start: date, end: date) -> list[tuple[int, int]]:
    months: list[tuple[int, int]] = []
    y, m = start.year, start.month
    while date(y, m, 1) <= date(end.year, end.month, 1):
        months.append((y, m))
        if m == 12:
            y += 1
            m = 1
        else:
            m += 1
    return months


def _month_group_key(created_at: datetime | None) -> tuple[str, str]:
    if created_at is None:
        return "unknown", "Unknown"
    local = created_at.astimezone(IST)
    key = f"{local.year}-{local.month:02d}"
    label = local.strftime("%b %Y")
    return key, label


def _customer_group_key(company: str | None, name: str | None) -> tuple[str, str]:
    label = (company or name or "Unknown").strip() or "Unknown"
    return label.lower(), label


def _enquiry_customer_group(e: Enquiry) -> tuple[str, str]:
    client = _enquiry_client_name(e)
    if client:
        return client.lower(), client
    return "unknown", "Unknown"


def _enquiry_primary_category_key(e: Enquiry) -> tuple[str, str]:
    mp = e.matched_products if isinstance(e.matched_products, list) else []
    for item in mp:
        if not isinstance(item, dict):
            continue
        raw = str(item.get("category") or item.get("primary_category") or "").strip()
        if raw:
            key = _normalize_category_key(raw)
            return key, _category_metric_label(key)
    pd = e.parsed_data if isinstance(e.parsed_data, dict) else {}
    line_items = pd.get("line_items")
    if isinstance(line_items, list):
        for line in line_items:
            if not isinstance(line, dict):
                continue
            raw = str(line.get("category") or line.get("primary_category") or "").strip()
            if raw:
                key = _normalize_category_key(raw)
                return key, _category_metric_label(key)
    return "others", "Others"


def _new_pipeline_bucket(label: str) -> dict:
    return {
        "group_label": label,
        "enquiry_count": 0,
        "quote_count": 0,
        "quoted_value": 0.0,
        "po_count": 0,
        "po_value": 0.0,
        "_quote_ids": set(),
        "_po_ids": set(),
    }


def _finalize_pipeline_bucket(row: dict) -> dict:
    quoted = float(row["quoted_value"])
    po_val = float(row["po_value"])
    return {
        "row_key": row["row_key"],
        "group_label": row["group_label"],
        "enquiry_count": int(row["enquiry_count"]),
        "quote_count": int(row["quote_count"]),
        "quoted_value": round(quoted, 2),
        "po_count": int(row["po_count"]),
        "po_value": round(po_val, 2),
        "conversion_pct": round(_conv_pct(po_val, quoted), 1),
        "is_total": False,
    }


async def get_conversion_pipeline_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    group_by: str,
    user_id: str | None = None,
) -> dict:
    if group_by not in CONVERSION_PIPELINE_GROUP_BY:
        raise ValueError(f"Invalid group_by: {group_by}")

    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    return _build_conversion_pipeline_report(scope, group_by)


def _build_conversion_pipeline_report(scope: ReportScopeData, group_by: str) -> dict:
    date_from = scope.date_from
    date_to = scope.date_to
    scope_label = scope.scope_label
    user_names = scope.user_names
    enquiries = scope.enquiries
    quotes = scope.quotations
    pos = scope.purchase_orders

    buckets: dict[str, dict] = {}

    def ensure_bucket(key: str, label: str) -> dict:
        if key not in buckets:
            buckets[key] = {**_new_pipeline_bucket(label), "row_key": key}
        return buckets[key]

    if group_by == "month":
        for y, m in _iter_months_between(date_from, date_to):
            key = f"{y}-{m:02d}"
            label = date(y, m, 1).strftime("%b %Y")
            ensure_bucket(key, label)

    if group_by == "user":
        for uid, name in user_names.items():
            user_names.setdefault(uid, name)
        ensure_bucket("unassigned", "Unassigned")

    for e in enquiries:
        if group_by == "month":
            key, label = _month_group_key(e.created_at)
        elif group_by == "user":
            uid = e.created_by_user_id
            if uid is None:
                key, label = "unassigned", "Unassigned"
            else:
                key = str(uid)
                label = user_names.get(key) or (e.created_by_name or "Unknown")
        elif group_by == "category":
            key, label = _enquiry_primary_category_key(e)
        else:
            key, label = _enquiry_customer_group(e)
        bucket = ensure_bucket(key, label)
        bucket["enquiry_count"] += 1

    for q in quotes:
        if group_by == "category":
            cat_amounts = _quotation_value_by_category(q)
            if not cat_amounts and q.total_amount:
                cat_amounts = {"others": float(q.total_amount)}
            for cat, amt in cat_amounts.items():
                bucket = ensure_bucket(cat, _category_metric_label(cat))
                bucket["quoted_value"] += amt
                if q.id not in bucket["_quote_ids"]:
                    bucket["_quote_ids"].add(q.id)
                    bucket["quote_count"] += 1
            continue

        if group_by == "month":
            key, label = _month_group_key(q.created_at)
        elif group_by == "user":
            uid = q.created_by_user_id
            if uid is None:
                key, label = "unassigned", "Unassigned"
            else:
                key = str(uid)
                label = user_names.get(key) or (q.created_by_name or "Unknown")
        else:
            key, label = _customer_group_key(q.client_company, q.client_name)
        bucket = ensure_bucket(key, label)
        bucket["quote_count"] += 1
        bucket["quoted_value"] += float(q.total_amount or 0.0)

    for po in pos:
        if group_by == "category":
            cat_amounts = _order_value_by_category(po)
            if not cat_amounts and po.total_amount:
                cat_amounts = {_normalize_category_key(po.primary_category or "Others"): float(po.total_amount)}
            for cat, amt in cat_amounts.items():
                bucket = ensure_bucket(cat, _category_metric_label(cat))
                bucket["po_value"] += amt
                if po.id not in bucket["_po_ids"]:
                    bucket["_po_ids"].add(po.id)
                    bucket["po_count"] += 1
            continue

        if group_by == "month":
            key, label = _month_group_key(po.created_at)
        elif group_by == "user":
            uid = po.created_by_user_id
            if uid is None:
                key, label = "unassigned", "Unassigned"
            else:
                key = str(uid)
                label = user_names.get(key) or (po.created_by_name or "Unknown")
        else:
            key, label = _customer_group_key(po.client_company, po.client_name)
        bucket = ensure_bucket(key, label)
        bucket["po_count"] += 1
        bucket["po_value"] += float(po.total_amount or 0.0)

    rows_raw = list(buckets.values())
    if group_by == "month":
        rows_raw.sort(key=lambda r: r["row_key"])
    elif group_by == "user":
        rows_raw.sort(key=lambda r: (-r["quoted_value"], r["group_label"].lower()))
    elif group_by == "category":
        rows_raw.sort(key=lambda r: (-r["quoted_value"], r["group_label"].lower()))
    else:
        rows_raw.sort(key=lambda r: (-r["po_value"], r["group_label"].lower()))

    rows = [_finalize_pipeline_bucket(r) for r in rows_raw]

    totals = {
        "enquiry_count": sum(r["enquiry_count"] for r in rows),
        "quote_count": sum(r["quote_count"] for r in rows),
        "quoted_value": round(sum(r["quoted_value"] for r in rows), 2),
        "po_count": sum(r["po_count"] for r in rows),
        "po_value": round(sum(r["po_value"] for r in rows), 2),
    }
    totals["conversion_pct"] = round(_conv_pct(totals["po_value"], totals["quoted_value"]), 1)

    group_labels = {
        "month": "Month",
        "user": "Salesperson",
        "category": "Category",
        "customer": "Customer",
    }

    return {
        "report_title": "Conversion / Pipeline Report",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "group_by": group_by,
        "group_by_label": group_labels[group_by],
        "scope_label": scope_label,
        "record_count": len(rows),
        "conversion_threshold_pct": 30.0,
        "rows": rows,
        "totals": {
            "row_key": "totals",
            "group_label": "Total",
            "is_total": True,
            **totals,
        },
    }


REGISTER_DISPLAY_STATUSES = frozenset({"open", "won", "lost", "expired", "expiring_soon"})


def _quotation_register_display_status(q: Quotation, today: date) -> tuple[str, bool]:
    """Return register display status key and whether expiry is within 7 days (open quotes)."""
    crm = (q.status or "ongoing").lower()
    if crm == "po_received":
        return "won", False
    if crm == "lost":
        return "lost", False

    validity = q.validity_date
    if validity is None:
        validity = default_validity_date(q.created_at, q.validity_days)

    if crm in ("ongoing", "hold") and validity is not None:
        if validity < today:
            return "expired", False
        days_left = (validity - today).days
        if days_left <= 7:
            return "expiring_soon", True
    return "open", False


def _quotation_register_customer(q: Quotation) -> str:
    return (q.client_company or q.client_name or "Unknown").strip() or "Unknown"


def _quotation_register_product(listing: dict) -> str:
    item = str(listing.get("item_desc_short") or "").strip()
    category = str(listing.get("category_label") or listing.get("primary_category") or "").strip()
    if item and item != "—" and category and category.lower() not in item.lower():
        return f"{category} · {item}"
    if item and item != "—":
        return item
    return category or "—"


async def get_quotation_register_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> dict:
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    return _build_quotation_register_report(scope)


def _build_quotation_register_report(scope: ReportScopeData) -> dict:
    date_from = scope.date_from
    date_to = scope.date_to
    scope_label = scope.scope_label
    quotes = sorted(scope.quotations, key=lambda q: q.created_at or datetime.min, reverse=True)
    today = _today_ist()

    rows: list[dict] = []
    for q in quotes:
        listing = listing_fields_from_quotation(q)
        display_status, expiry_warning = _quotation_register_display_status(q, today)
        validity = q.validity_date
        if validity is None:
            validity = default_validity_date(q.created_at, q.validity_days)

        created_local = q.created_at.astimezone(IST) if q.created_at else None
        rows.append(
            {
                "quotation_id": str(q.id),
                "quote_ref": q.quote_number,
                "date_raised": created_local.date().isoformat() if created_local else None,
                "customer_name": _quotation_register_customer(q),
                "product": _quotation_register_product(listing),
                "category": listing.get("category_label") or listing.get("primary_category") or "—",
                "quoted_value": round(float(q.total_amount or 0.0), 2),
                "display_status": display_status,
                "crm_status": (q.status or "ongoing").lower(),
                "salesperson": (q.created_by_name or "Unassigned").strip() or "Unassigned",
                "salesperson_id": str(q.created_by_user_id) if q.created_by_user_id else None,
                "expiry_date": validity.isoformat() if validity else None,
                "expiry_warning": expiry_warning,
            }
        )

    total_value = round(sum(r["quoted_value"] for r in rows), 2)
    owners = sorted(
        {
            (r["salesperson_id"], r["salesperson"])
            for r in rows
            if r["salesperson_id"] or r["salesperson"]
        },
        key=lambda x: x[1].lower(),
    )

    return {
        "report_title": "Quotation Register",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "scope_label": scope_label,
        "record_count": len(rows),
        "total_quoted_value": total_value,
        "salespeople": [{"id": oid, "name": name} for oid, name in owners if oid],
        "rows": rows,
    }


def _quotation_loss_remarks(q: Quotation) -> str | None:
    if q.status_remarks and str(q.status_remarks).strip():
        return str(q.status_remarks).strip()
    lines = q.line_items if isinstance(q.line_items, list) else []
    for li in lines:
        if not isinstance(li, dict):
            continue
        if str(li.get("crm_status") or "").lower() == "lost":
            r = li.get("crm_status_remarks")
            if r and str(r).strip():
                return str(r).strip()
    return None


def _lost_reason_category_options() -> list[str]:
    labels = [label for label, _keywords in LOST_REASON_RULES]
    return labels + ["Unspecified", "Other"]


async def get_win_loss_analysis_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> dict:
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    return _build_win_loss_analysis_report(scope)


def _build_win_loss_analysis_report(scope: ReportScopeData) -> dict:
    date_from = scope.date_from
    date_to = scope.date_to
    scope_label = scope.scope_label
    quotes = [
        q
        for q in scope.quotations
        if (q.status or "").lower() in ("po_received", "lost")
    ]
    quotes.sort(key=lambda q: float(q.total_amount or 0.0), reverse=True)

    rows: list[dict] = []
    for q in quotes:
        listing = listing_fields_from_quotation(q)
        outcome = "won" if (q.status or "").lower() == "po_received" else "lost"
        raw_remarks = _quotation_loss_remarks(q) if outcome == "lost" else None
        loss_reason = _categorize_lost_reason(raw_remarks) if outcome == "lost" else None

        rows.append(
            {
                "quotation_id": str(q.id),
                "quote_ref": q.quote_number,
                "customer_name": _quotation_register_customer(q),
                "product": _quotation_register_product(listing),
                "category": listing.get("category_label") or listing.get("primary_category") or "Others",
                "quoted_value": round(float(q.total_amount or 0.0), 2),
                "outcome": outcome,
                "loss_reason": loss_reason,
                "loss_reason_raw": raw_remarks,
                "salesperson": (q.created_by_name or "Unassigned").strip() or "Unassigned",
                "salesperson_id": str(q.created_by_user_id) if q.created_by_user_id else None,
            }
        )

    won_rows = [r for r in rows if r["outcome"] == "won"]
    lost_rows = [r for r in rows if r["outcome"] == "lost"]

    total_quoted_value = round(sum(r["quoted_value"] for r in rows), 2)
    total_won_value = round(sum(r["quoted_value"] for r in won_rows), 2)
    total_lost_value = round(sum(r["quoted_value"] for r in lost_rows), 2)

    win_rate_value_pct = (
        round(total_won_value / total_quoted_value * 100.0, 1) if total_quoted_value > 0 else 0.0
    )
    win_rate_count_pct = round(len(won_rows) / len(rows) * 100.0, 1) if rows else 0.0

    reason_counts: dict[str, int] = {}
    for r in lost_rows:
        reason = r["loss_reason"] or "Unspecified"
        reason_counts[reason] = reason_counts.get(reason, 0) + 1

    sorted_reasons = sorted(reason_counts.items(), key=lambda x: (-x[1], x[0]))
    top_loss_reason = sorted_reasons[0][0] if sorted_reasons else None
    top_loss_reason_count = sorted_reasons[0][1] if sorted_reasons else 0
    max_reason_count = sorted_reasons[0][1] if sorted_reasons else 0

    loss_reason_breakdown = [
        {
            "reason": reason,
            "count": count,
            "is_top": count == max_reason_count and max_reason_count > 0,
            "bar_width_pct": round(count / max_reason_count * 100.0, 1) if max_reason_count > 0 else 0.0,
        }
        for reason, count in sorted_reasons
    ]

    categories = sorted({str(r["category"]) for r in rows if r.get("category")}, key=str.lower)
    owners = sorted(
        {(r["salesperson_id"], r["salesperson"]) for r in rows},
        key=lambda x: x[1].lower(),
    )

    return {
        "report_title": "Win/Loss Analysis Report",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "scope_label": scope_label,
        "record_count": len(rows),
        "loss_reason_categories": _lost_reason_category_options(),
        "categories": categories,
        "salespeople": [{"id": oid, "name": name} for oid, name in owners if oid],
        "summary": {
            "total_quoted_value": total_quoted_value,
            "total_won_value": total_won_value,
            "total_lost_value": total_lost_value,
            "total_quoted_count": len(rows),
            "total_won_count": len(won_rows),
            "total_lost_count": len(lost_rows),
            "win_rate_value_pct": win_rate_value_pct,
            "win_rate_count_pct": win_rate_count_pct,
            "top_loss_reason": top_loss_reason,
            "top_loss_reason_count": top_loss_reason_count,
        },
        "loss_reason_breakdown": {
            "total": len(lost_rows),
            "reasons": loss_reason_breakdown,
            "insights": [],
        },
        "rows": rows,
    }


def _new_sales_user_bucket(user_id: str, name: str) -> dict:
    return {
        "user_id": user_id,
        "salesperson_name": name,
        "enquiry_count": 0,
        "quote_count": 0,
        "quoted_value": 0.0,
        "po_count": 0,
        "won_value": 0.0,
        "win_rate_pct": 0.0,
        "avg_response_hours": None,
    }


def _finalize_sales_user_row(row: dict) -> dict:
    quoted = float(row["quoted_value"])
    won = float(row["won_value"])
    avg_h = row.get("avg_response_hours")
    return {
        "user_id": row["user_id"],
        "salesperson_name": row["salesperson_name"],
        "enquiry_count": int(row["enquiry_count"]),
        "quote_count": int(row["quote_count"]),
        "quoted_value": round(quoted, 2),
        "po_count": int(row["po_count"]),
        "won_value": round(won, 2),
        "win_rate_pct": round(_conv_pct(won, quoted), 1),
        "avg_response_hours": round(float(avg_h), 1) if avg_h is not None else None,
    }


async def _avg_response_hours_by_user(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    *,
    start_dt: datetime,
    end_dt: datetime,
) -> dict[str, float]:
    if not user_ids:
        return {}
    stmt = (
        select(
            Quotation.created_by_user_id,
            func.avg(
                func.extract("epoch", Quotation.created_at - Enquiry.created_at) / 3600.0
            ),
        )
        .select_from(Quotation)
        .join(Enquiry, Quotation.enquiry_id == Enquiry.id)
        .where(
            Quotation.created_at >= start_dt,
            Quotation.created_at < end_dt,
            Quotation.is_archived.is_(False),
            Enquiry.is_archived.is_(False),
            Quotation.created_by_user_id.in_(user_ids),
        )
        .group_by(Quotation.created_by_user_id)
    )
    out: dict[str, float] = {}
    for uid, avg_h in (await db.execute(stmt)).all():
        if uid is not None and avg_h is not None:
            out[str(uid)] = float(avg_h)
    return out


async def get_sales_performance_by_user_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> dict:
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    return _build_sales_performance_by_user_report(scope)


def _build_sales_performance_by_user_report(scope: ReportScopeData) -> dict:
    date_from = scope.date_from
    date_to = scope.date_to
    scope_label = scope.scope_label
    user_ids = scope.user_ids
    users_map = scope.user_names

    if not user_ids:
        empty = _finalize_sales_user_row({**_new_sales_user_bucket("totals", "Team total")})
        empty["salesperson_name"] = "Team total"
        return {
            "report_title": "Sales Performance by User",
            "generated_at": datetime.now(IST).isoformat(),
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "scope_label": scope_label,
            "record_count": 0,
            "rows": [],
            "totals": empty,
        }

    buckets: dict[str, dict] = {
        uid: _new_sales_user_bucket(uid, users_map.get(uid, "Unknown")) for uid in users_map
    }
    unassigned_key = "unassigned"
    buckets.setdefault(unassigned_key, _new_sales_user_bucket(unassigned_key, "Unassigned"))

    def bucket_for(uid: uuid.UUID | None) -> dict:
        if uid is None:
            return buckets[unassigned_key]
        key = str(uid)
        if key not in buckets:
            buckets[key] = _new_sales_user_bucket(key, users_map.get(key, "Unknown"))
        return buckets[key]

    for e in scope.enquiries:
        bucket_for(e.created_by_user_id)["enquiry_count"] += 1

    for q in scope.quotations:
        b = bucket_for(q.created_by_user_id)
        b["quote_count"] += 1
        b["quoted_value"] += float(q.total_amount or 0.0)

    for po in scope.purchase_orders:
        b = bucket_for(po.created_by_user_id)
        b["po_count"] += 1
        b["won_value"] += float(po.total_amount or 0.0)

    for uid, avg_h in scope.response_hours_by_user.items():
        if uid in buckets:
            buckets[uid]["avg_response_hours"] = avg_h

    rows_raw = [
        b for b in buckets.values()
        if b["enquiry_count"] or b["quote_count"] or b["po_count"]
    ]
    rows_raw.sort(key=lambda r: (-r["won_value"], r["salesperson_name"].lower()))
    rows = [_finalize_sales_user_row(r) for r in rows_raw]

    totals_raw = {
        **_new_sales_user_bucket("totals", "Team total"),
        "enquiry_count": sum(r["enquiry_count"] for r in rows),
        "quote_count": sum(r["quote_count"] for r in rows),
        "quoted_value": sum(r["quoted_value"] for r in rows),
        "po_count": sum(r["po_count"] for r in rows),
        "won_value": sum(r["won_value"] for r in rows),
        "avg_response_hours": scope.team_avg_response_hours,
    }
    totals = _finalize_sales_user_row(totals_raw)
    totals["salesperson_name"] = "Team total"

    return {
        "report_title": "Sales Performance by User",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "scope_label": scope_label,
        "record_count": len(rows),
        "rows": rows,
        "totals": totals,
    }


def _new_source_bucket(source_key: str) -> dict:
    label = SOURCE_CHANNEL_LABELS.get(source_key, source_key.replace("_", " ").title())
    return {
        "source_key": source_key,
        "source_label": label,
        "enquiry_count": 0,
        "quote_count": 0,
        "quoted_value": 0.0,
        "po_count": 0,
        "won_value": 0.0,
        "win_rate_pct": 0.0,
        "revenue_share_pct": 0.0,
        "bar_color": SOURCE_CHANNEL_COLORS.get(source_key, SOURCE_CHANNEL_COLORS["unknown"]),
    }


def _finalize_source_row(row: dict, total_won: float) -> dict:
    quoted = float(row["quoted_value"])
    won = float(row["won_value"])
    return {
        "source_key": row["source_key"],
        "source_label": row["source_label"],
        "enquiry_count": int(row["enquiry_count"]),
        "quote_count": int(row["quote_count"]),
        "quoted_value": round(quoted, 2),
        "po_count": int(row["po_count"]),
        "won_value": round(won, 2),
        "win_rate_pct": round(_conv_pct(won, quoted), 1),
        "revenue_share_pct": round(won / total_won * 100.0, 1) if total_won > 0 else 0.0,
        "bar_color": row["bar_color"],
    }


async def _client_earliest_po_map(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
) -> dict[str, datetime]:
    client_key = func.lower(
        func.trim(func.coalesce(PurchaseOrder.client_company, PurchaseOrder.client_name, ""))
    )
    stmt = (
        select(client_key, func.min(PurchaseOrder.created_at))
        .where(client_key != "")
        .group_by(client_key)
    )
    if user_ids:
        stmt = stmt.where(PurchaseOrder.created_by_user_id.in_(user_ids))
    client_earliest: dict[str, datetime] = {}
    for key, earliest in (await db.execute(stmt)).all():
        if key and earliest is not None:
            client_earliest[str(key)] = earliest
    return client_earliest


def _po_source_channel(
    po: PurchaseOrder,
    enquiry: Enquiry | None,
    client_earliest: dict[str, datetime],
) -> str:
    client_key = (po.client_company or po.client_name or "").strip().lower()
    if client_key and client_key in client_earliest and client_earliest[client_key] < po.created_at:
        return "repeat"
    if enquiry is not None:
        return _enquiry_source(enquiry)
    return "manual"


async def get_source_roi_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> dict:
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    return _build_source_roi_report(scope)


def _build_source_roi_report(scope: ReportScopeData) -> dict:
    date_from = scope.date_from
    date_to = scope.date_to
    scope_label = scope.scope_label
    client_earliest = scope.client_earliest_po
    buckets: dict[str, dict] = {}

    def ensure_source(key: str) -> dict:
        if key not in buckets:
            buckets[key] = _new_source_bucket(key)
        return buckets[key]

    for e in scope.enquiries:
        ensure_source(_enquiry_source(e))["enquiry_count"] += 1

    for q in scope.quotations:
        enquiry = q.enquiry
        src = _enquiry_source(enquiry) if enquiry is not None else "manual"
        b = ensure_source(src)
        b["quote_count"] += 1
        b["quoted_value"] += float(q.total_amount or 0.0)

    for po in scope.purchase_orders:
        enquiry = po.quotation.enquiry if po.quotation is not None else None
        b = ensure_source(_po_source_channel(po, enquiry, client_earliest))
        b["po_count"] += 1
        b["won_value"] += float(po.total_amount or 0.0)

    total_won = sum(b["won_value"] for b in buckets.values())
    rows_raw = sorted(buckets.values(), key=lambda r: (-r["won_value"], r["source_label"]))
    rows = [_finalize_source_row(r, total_won) for r in rows_raw]

    eligible = [r for r in rows if r["quoted_value"] > 0 or r["won_value"] > 0]
    if eligible:
        best = max(eligible, key=lambda r: r["win_rate_pct"])
        worst = min(eligible, key=lambda r: r["win_rate_pct"])
        for r in rows:
            r["is_highest_win_rate"] = (
                r["source_key"] == best["source_key"] and best["win_rate_pct"] != worst["win_rate_pct"]
            )
            r["is_lowest_win_rate"] = (
                r["source_key"] == worst["source_key"] and best["win_rate_pct"] != worst["win_rate_pct"]
            )
    else:
        for r in rows:
            r["is_highest_win_rate"] = False
            r["is_lowest_win_rate"] = False

    total_quoted = sum(r["quoted_value"] for r in rows)
    totals = _finalize_source_row(
        {
            **_new_source_bucket("totals"),
            "source_key": "totals",
            "source_label": "All sources",
            "enquiry_count": sum(r["enquiry_count"] for r in rows),
            "quote_count": sum(r["quote_count"] for r in rows),
            "quoted_value": total_quoted,
            "po_count": sum(r["po_count"] for r in rows),
            "won_value": total_won,
            "bar_color": SOURCE_CHANNEL_COLORS["unknown"],
        },
        total_won,
    )
    totals["source_label"] = "All sources"
    totals["is_highest_win_rate"] = False
    totals["is_lowest_win_rate"] = False

    return {
        "report_title": "Source ROI Report",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "scope_label": scope_label,
        "record_count": len(rows),
        "rows": rows,
        "totals": totals,
    }


SO_HANDOFF_OVERDUE_DAYS = 7

CUSTOMER_TIER_THRESHOLDS_INR: list[tuple[str, str, float]] = [
    ("top", "Top", 500_000.0),
    ("mid", "Mid", 100_000.0),
    ("low", "Low", 0.0),
]


def _customer_key_label(company: str | None, name: str | None) -> tuple[str, str]:
    label = (company or name or "Unknown").strip() or "Unknown"
    return label.lower(), label


def _customer_tier(po_value: float) -> tuple[str, str]:
    for key, label, minimum in CUSTOMER_TIER_THRESHOLDS_INR:
        if po_value >= minimum:
            return key, label
    return "low", "Low"


async def get_so_handoff_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> dict:
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    return _build_so_handoff_report(scope)


def _build_so_handoff_report(scope: ReportScopeData) -> dict:
    date_from = scope.date_from
    date_to = scope.date_to
    scope_label = scope.scope_label
    today = _today_ist()
    pos = sorted(
        scope.purchase_orders,
        key=lambda po: po.created_at or datetime.min,
        reverse=True,
    )
    rows: list[dict] = []
    handoff_days: list[int] = []

    for po in pos:
        po_local = po.created_at.astimezone(IST) if po.created_at else None
        po_date = po_local.date() if po_local else None
        so_created = bool((po.so_number or "").strip())
        so_creation_date: date | None = None
        days_to_handoff: int | None = None

        if so_created and po.updated_at and po_date:
            so_local = po.updated_at.astimezone(IST)
            so_creation_date = so_local.date()
            days_to_handoff = max((so_creation_date - po_date).days, 0)
            handoff_days.append(days_to_handoff)

        po_age_days = (today - po_date).days if po_date else 0
        handoff_overdue = not so_created and po_age_days > SO_HANDOFF_OVERDUE_DAYS

        rows.append(
            {
                "po_id": str(po.id),
                "po_reference": po.po_number,
                "customer_name": (po.client_company or po.client_name or "Unknown").strip() or "Unknown",
                "po_value": round(float(po.total_amount or 0.0), 2),
                "po_date": po_date.isoformat() if po_date else None,
                "so_created": so_created,
                "so_number": (po.so_number or "").strip() or None,
                "so_creation_date": so_creation_date.isoformat() if so_creation_date else None,
                "days_to_handoff": days_to_handoff,
                "handoff_owner": (po.created_by_name or "Unassigned").strip() or "Unassigned",
                "handoff_owner_id": str(po.created_by_user_id) if po.created_by_user_id else None,
                "po_age_days": po_age_days,
                "handoff_overdue": handoff_overdue,
            }
        )

    total_pos = len(rows)
    so_created_count = sum(1 for r in rows if r["so_created"])
    pct_so_created = round(so_created_count / total_pos * 100.0, 1) if total_pos > 0 else 0.0
    avg_days = round(sum(handoff_days) / len(handoff_days), 1) if handoff_days else None

    owners = sorted(
        {(r["handoff_owner_id"], r["handoff_owner"]) for r in rows},
        key=lambda x: x[1].lower(),
    )

    return {
        "report_title": "SO Conversion / ERP Handoff Report",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "scope_label": scope_label,
        "record_count": total_pos,
        "handoff_overdue_days": SO_HANDOFF_OVERDUE_DAYS,
        "summary": {
            "total_pos": total_pos,
            "so_created_count": so_created_count,
            "pct_so_created": pct_so_created,
            "avg_days_to_handoff": avg_days,
        },
        "handoff_owners": [{"id": oid, "name": name} for oid, name in owners if oid],
        "rows": rows,
    }


def _new_customer_bucket(key: str, label: str) -> dict:
    return {
        "customer_key": key,
        "customer_name": label,
        "enquiry_count": 0,
        "quote_count": 0,
        "quoted_value": 0.0,
        "po_count": 0,
        "po_value": 0.0,
        "win_rate_pct": 0.0,
        "last_activity_date": None,
        "primary_source_key": "unknown",
        "primary_source_label": SOURCE_CHANNEL_LABELS.get("unknown", "Other"),
        "primary_category": "Others",
        "customer_tier": "low",
        "customer_tier_label": "Low",
        "_source_counts": {},
        "_category_values": {},
        "_activity_dates": [],
    }


def _finalize_customer_row(row: dict) -> dict:
    quoted = float(row["quoted_value"])
    po_val = float(row["po_value"])
    tier_key, tier_label = _customer_tier(po_val)

    source_counts: dict[str, int] = row.pop("_source_counts", {})
    top_source = max(source_counts.items(), key=lambda x: (x[1], x[0]))[0] if source_counts else "unknown"

    category_values: dict[str, float] = row.pop("_category_values", {})
    top_category = (
        max(category_values.items(), key=lambda x: (x[1], x[0]))[0] if category_values else "Others"
    )

    activity_dates: list[date] = row.pop("_activity_dates", [])
    last_activity = max(activity_dates).isoformat() if activity_dates else None

    return {
        "customer_key": row["customer_key"],
        "customer_name": row["customer_name"],
        "enquiry_count": int(row["enquiry_count"]),
        "quote_count": int(row["quote_count"]),
        "quoted_value": round(quoted, 2),
        "po_count": int(row["po_count"]),
        "po_value": round(po_val, 2),
        "win_rate_pct": round(_conv_pct(po_val, quoted), 1),
        "last_activity_date": last_activity,
        "primary_source_key": top_source,
        "primary_source_label": SOURCE_CHANNEL_LABELS.get(
            top_source, top_source.replace("_", " ").title()
        ),
        "primary_category": top_category,
        "customer_tier": tier_key,
        "customer_tier_label": tier_label,
    }


async def get_customer_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> dict:
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    return _build_customer_report(scope)


def _build_customer_report(scope: ReportScopeData) -> dict:
    date_from = scope.date_from
    date_to = scope.date_to
    scope_label = scope.scope_label

    buckets: dict[str, dict] = {}

    def ensure_customer(company: str | None, name: str | None) -> dict:
        key, label = _customer_key_label(company, name)
        if key not in buckets:
            buckets[key] = _new_customer_bucket(key, label)
        return buckets[key]

    def touch_activity(bucket: dict, created_at: datetime | None) -> None:
        if created_at is None:
            return
        bucket["_activity_dates"].append(created_at.astimezone(IST).date())

    for e in scope.enquiries:
        client = _enquiry_client_name(e)
        b = ensure_customer(client, client)
        b["enquiry_count"] += 1
        touch_activity(b, e.created_at)
        src = _enquiry_source(e)
        b["_source_counts"][src] = b["_source_counts"].get(src, 0) + 1

    for q in scope.quotations:
        b = ensure_customer(q.client_company, q.client_name)
        b["quote_count"] += 1
        b["quoted_value"] += float(q.total_amount or 0.0)
        touch_activity(b, q.created_at)
        listing = listing_fields_from_quotation(q)
        cat = listing.get("category_label") or listing.get("primary_category") or "Others"
        b["_category_values"][str(cat)] = b["_category_values"].get(str(cat), 0.0) + float(q.total_amount or 0.0)

    for po in scope.purchase_orders:
        b = ensure_customer(po.client_company, po.client_name)
        b["po_count"] += 1
        amt = float(po.total_amount or 0.0)
        b["po_value"] += amt
        touch_activity(b, po.created_at)
        cat = po.primary_category or "Others"
        b["_category_values"][cat] = b["_category_values"].get(cat, 0.0) + amt

    rows_raw = sorted(buckets.values(), key=lambda r: (-r["po_value"], r["customer_name"].lower()))
    rows = [_finalize_customer_row(dict(r)) for r in rows_raw]

    total_po_value = sum(r["po_value"] for r in rows)
    total_quoted = sum(r["quoted_value"] for r in rows)
    win_rates = [r["win_rate_pct"] for r in rows if r["quoted_value"] > 0]
    avg_win_rate = round(sum(win_rates) / len(win_rates), 1) if win_rates else 0.0

    source_channels = sorted(
        {r["primary_source_key"] for r in rows},
        key=lambda k: SOURCE_CHANNEL_LABELS.get(k, k),
    )

    totals = {
        "customer_key": "totals",
        "customer_name": "All customers",
        "enquiry_count": sum(r["enquiry_count"] for r in rows),
        "quote_count": sum(r["quote_count"] for r in rows),
        "quoted_value": round(total_quoted, 2),
        "po_count": sum(r["po_count"] for r in rows),
        "po_value": round(total_po_value, 2),
        "win_rate_pct": round(_conv_pct(total_po_value, total_quoted), 1),
        "last_activity_date": None,
        "primary_source_key": "",
        "primary_source_label": "",
        "primary_category": "",
        "customer_tier": "",
        "customer_tier_label": "",
        "customer_count": len(rows),
        "avg_win_rate_pct": avg_win_rate,
    }

    return {
        "report_title": "Customer Report",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "scope_label": scope_label,
        "record_count": len(rows),
        "tier_thresholds_inr": [
            {"tier": k, "label": lbl, "min_po_value": min_v}
            for k, lbl, min_v in CUSTOMER_TIER_THRESHOLDS_INR
        ],
        "source_channels": [
            {"key": k, "label": SOURCE_CHANNEL_LABELS.get(k, k.replace("_", " ").title())}
            for k in source_channels
        ],
        "rows": rows,
        "totals": totals,
    }


DEFAULT_SLA_TARGET_HOURS = 4.0
SLA_TARGET_HOUR_OPTIONS: tuple[float, ...] = (4.0, 8.0)


def _first_quotation_for_enquiry(enquiry: Enquiry) -> Quotation | None:
    quotes = [
        q
        for q in (enquiry.quotations or [])
        if not q.is_archived and q.created_at is not None
    ]
    if not quotes:
        return None
    return min(quotes, key=lambda q: q.created_at)


def _sla_weekly_trend(rows: list[dict]) -> list[dict]:
    buckets: dict[str, list[float]] = defaultdict(list)
    labels: dict[str, str] = {}
    for row in rows:
        received = datetime.fromisoformat(row["received_at"])
        if received.tzinfo is None:
            received = received.replace(tzinfo=IST)
        week_start = received.date() - timedelta(days=received.weekday())
        key = week_start.isoformat()
        labels[key] = week_start.strftime("%d %b")
        buckets[key].append(float(row["response_hours"]))

    best_week: str | None = None
    best_hours: float | None = None
    weeks: list[dict] = []
    for key in sorted(buckets.keys()):
        vals = buckets[key]
        avg = round(sum(vals) / len(vals), 1)
        weeks.append(
            {
                "week_label": labels[key],
                "week_start": key,
                "avg_hours": avg,
                "enquiry_count": len(vals),
            }
        )
        if best_hours is None or avg < best_hours:
            best_hours = avg
            best_week = key

    for pt in weeks:
        pt["is_milestone"] = pt["week_start"] == best_week and best_hours is not None
    return weeks


def _build_response_sla_report(
    scope: ReportScopeData,
    *,
    sla_target_hours: float = DEFAULT_SLA_TARGET_HOURS,
) -> dict:
    date_from = scope.date_from
    date_to = scope.date_to
    scope_label = scope.scope_label
    target = float(sla_target_hours)

    rows: list[dict] = []
    for enquiry in scope.enquiries:
        first_quote = _first_quotation_for_enquiry(enquiry)
        if first_quote is None or enquiry.created_at is None or first_quote.created_at is None:
            continue

        received = enquiry.created_at.astimezone(IST)
        quoted_at = first_quote.created_at.astimezone(IST)
        response_hours = max((quoted_at - received).total_seconds() / 3600.0, 0.0)
        _cat_key, cat_label = _enquiry_primary_category_key(enquiry)
        client = _enquiry_client_name(enquiry) or "Unknown"
        sla_met = response_hours <= target

        rows.append(
            {
                "enquiry_id": str(enquiry.id),
                "enquiry_ref": enquiry.enquiry_number or str(enquiry.id)[:8],
                "customer_name": client,
                "category_key": _cat_key,
                "category": cat_label,
                "received_at": received.isoformat(),
                "quote_sent_at": quoted_at.isoformat(),
                "response_hours": round(response_hours, 1),
                "sla_met": sla_met,
                "salesperson": (first_quote.created_by_name or "Unassigned").strip() or "Unassigned",
                "salesperson_id": (
                    str(first_quote.created_by_user_id) if first_quote.created_by_user_id else None
                ),
            }
        )

    rows.sort(key=lambda r: r["response_hours"], reverse=True)

    total = len(rows)
    met_count = sum(1 for r in rows if r["sla_met"])
    avg_h = sum(r["response_hours"] for r in rows) / total if total else 0.0
    worst_h = max((r["response_hours"] for r in rows), default=0.0)
    weekly = _sla_weekly_trend(rows)

    categories = sorted({str(r["category"]) for r in rows if r.get("category")}, key=str.lower)
    owners = sorted(
        {(r["salesperson_id"], r["salesperson"]) for r in rows},
        key=lambda x: x[1].lower(),
    )

    return {
        "report_title": "Response Time / SLA Report",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "scope_label": scope_label,
        "record_count": total,
        "default_sla_target_hours": DEFAULT_SLA_TARGET_HOURS,
        "sla_target_hours": target,
        "sla_target_options": list(SLA_TARGET_HOUR_OPTIONS),
        "categories": categories,
        "salespeople": [{"id": oid, "name": name} for oid, name in owners if oid],
        "summary": {
            "total_enquiries": total,
            "sla_met_count": met_count,
            "sla_met_pct": round(met_count / total * 100.0, 1) if total else 0.0,
            "avg_response_hours": round(avg_h, 1) if total else None,
            "worst_response_hours": round(worst_h, 1) if total else None,
        },
        "weekly_trend": {
            "weeks": weekly,
            "target_hours": target,
            "milestone_week": next((w["week_label"] for w in weekly if w.get("is_milestone")), None),
            "milestone_hours": next((w["avg_hours"] for w in weekly if w.get("is_milestone")), None),
        },
        "rows": rows,
    }


async def get_response_sla_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
    sla_target_hours: float = DEFAULT_SLA_TARGET_HOURS,
) -> dict:
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    return _build_response_sla_report(scope, sla_target_hours=sla_target_hours)


AGEING_BUCKET_ORDER: tuple[tuple[str, str, int, int | None], ...] = (
    ("critical", "45+ days", 45, None),
    ("red", "22–45 days", 22, 44),
    ("amber", "8–21 days", 8, 21),
    ("green", "<7 days", 0, 7),
)


def _ageing_bucket(age_days: int) -> tuple[str, str]:
    if age_days >= 45:
        return "critical", "45+ days"
    if age_days >= 22:
        return "red", "22–45 days"
    if age_days >= 8:
        return "amber", "8–21 days"
    return "green", "<7 days"


def _last_activity_date(*candidates: datetime | None) -> date | None:
    valid = [c.astimezone(IST).date() for c in candidates if c is not None]
    return max(valid) if valid else None


def _age_days_as_of(last_activity: date | None, created: date | None, as_of: date) -> int:
    anchor = last_activity or created
    if anchor is None:
        return 0
    return max((as_of - anchor).days, 0)


def _next_action_meta(due: date | None, as_of: date) -> tuple[str | None, str]:
    if due is None:
        return None, "none"
    if due < as_of:
        return due.isoformat(), "overdue"
    if (due - as_of).days <= 7:
        return due.isoformat(), "upcoming"
    return due.isoformat(), "neutral"


async def _load_open_pipeline_items(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    *,
    as_of_date: date,
) -> tuple[list[Enquiry], list[Quotation]]:
    as_of_end = datetime.combine(as_of_date + timedelta(days=1), time.min, tzinfo=IST)
    has_quotation = exists(
        select(1).where(
            Quotation.enquiry_id == Enquiry.id,
            Quotation.is_archived.is_(False),
        )
    )
    enq_stmt = (
        select(Enquiry)
        .options(selectinload(Enquiry.branch).selectinload(ClientBranch.company))
        .where(
            ~has_quotation,
            Enquiry.is_archived.is_(False),
            Enquiry.status.notin_(list(TERMINAL_ENQUIRY_STATUSES)),
            Enquiry.created_at < as_of_end,
        )
    )
    if user_ids:
        enq_stmt = enq_stmt.where(Enquiry.created_by_user_id.in_(user_ids))

    quote_stmt = (
        select(Quotation)
        .options(selectinload(Quotation.enquiry))
        .where(
            Quotation.is_archived.is_(False),
            Quotation.status.in_(["ongoing", "hold"]),
            Quotation.created_at < as_of_end,
        )
    )
    if user_ids:
        quote_stmt = quote_stmt.where(Quotation.created_by_user_id.in_(user_ids))

    enquiries = list((await db.execute(enq_stmt)).scalars().all())
    quotations = list((await db.execute(quote_stmt)).scalars().all())
    return enquiries, quotations


async def _load_lost_quotes_in_range(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    *,
    date_from: date,
    date_to: date,
) -> list[Quotation]:
    start_dt, end_dt = _date_range_bounds(date_from, date_to)
    stmt = (
        select(Quotation)
        .where(
            Quotation.is_archived.is_(False),
            Quotation.status == "lost",
            Quotation.updated_at >= start_dt,
            Quotation.updated_at < end_dt,
        )
        .order_by(Quotation.total_amount.desc())
    )
    if user_ids:
        stmt = stmt.where(Quotation.created_by_user_id.in_(user_ids))
    return list((await db.execute(stmt)).scalars().all())


def _enquiry_product_label(e: Enquiry) -> str:
    item = item_desc_short_from_enquiry(e)
    _cat_key, cat_label = _enquiry_primary_category_key(e)
    if item and item != "—" and cat_label.lower() not in item.lower():
        return f"{cat_label} · {item}"
    if item and item != "—":
        return item
    return cat_label


def _stage_lost_at(q: Quotation) -> tuple[str, str]:
    lines = q.line_items if isinstance(q.line_items, list) else []
    had_hold = any(
        isinstance(li, dict) and str(li.get("crm_status") or "").lower() == "hold"
        for li in lines
    )
    remarks = (q.status_remarks or "").lower()
    if had_hold or "negotiat" in remarks or "hold" in remarks:
        return "negotiation", "Negotiation"
    return "quoted", "Quoted"


def _extract_competitor(remarks: str | None) -> str | None:
    if not remarks or not str(remarks).strip():
        return None
    text = str(remarks).strip()
    lower = text.lower()
    for prefix in ("lost to ", "competitor: ", "competitor ", "awarded to ", "went with "):
        if prefix in lower:
            idx = lower.index(prefix)
            snippet = text[idx + len(prefix) :].split(".")[0].split(",")[0].strip()
            if snippet:
                return snippet[:120]
    if "competitor" in lower:
        return None
    return None


def _build_pending_ageing_report(
    scope: ReportScopeData,
    open_enquiries: list[Enquiry],
    open_quotes: list[Quotation],
) -> dict:
    date_from = scope.date_from
    date_to = scope.date_to
    scope_label = scope.scope_label
    as_of = date_to

    rows: list[dict] = []

    for e in open_enquiries:
        created_local = e.created_at.astimezone(IST) if e.created_at else None
        created_d = created_local.date() if created_local else None
        if created_d is None or created_d < date_from or created_d > date_to:
            continue
        last_act = _last_activity_date(e.updated_at, e.created_at)
        age = _age_days_as_of(last_act, created_d, as_of)
        bucket_key, bucket_label = _ageing_bucket(age)
        due_iso, due_urgency = _next_action_meta(getattr(e, "next_follow_up_date", None), as_of)
        rows.append(
            {
                "item_id": str(e.id),
                "item_type": "enquiry",
                "reference": e.enquiry_number or str(e.id)[:8],
                "customer_name": _enquiry_client_name(e) or "Unknown",
                "product": _enquiry_product_label(e),
                "category": _enquiry_primary_category_key(e)[1],
                "quoted_value": 0.0,
                "stage_key": "enquiry",
                "stage_label": "Enquiry",
                "created_date": created_d.isoformat(),
                "last_activity_date": last_act.isoformat() if last_act else None,
                "age_days": age,
                "ageing_bucket_key": bucket_key,
                "ageing_bucket_label": bucket_label,
                "salesperson": (e.created_by_name or "Unassigned").strip() or "Unassigned",
                "salesperson_id": str(e.created_by_user_id) if e.created_by_user_id else None,
                "next_action_due": due_iso,
                "next_action_urgency": due_urgency,
            }
        )

    for q in open_quotes:
        created_local = q.created_at.astimezone(IST) if q.created_at else None
        created_d = created_local.date() if created_local else None
        if created_d is None or created_d < date_from or created_d > date_to:
            continue
        last_act = _last_activity_date(q.updated_at, q.created_at)
        age = _age_days_as_of(last_act, created_d, as_of)
        bucket_key, bucket_label = _ageing_bucket(age)
        due_iso, due_urgency = _next_action_meta(q.next_follow_up_date, as_of)
        listing = listing_fields_from_quotation(q)
        status_key = (q.status or "ongoing").lower()
        if status_key == "hold":
            stage_key, stage_label = "negotiation", "Negotiation"
        else:
            stage_key, stage_label = "quoted", "Quoted"
        rows.append(
            {
                "item_id": str(q.id),
                "item_type": "quotation",
                "reference": q.quote_number,
                "customer_name": _quotation_register_customer(q),
                "product": _quotation_register_product(listing),
                "category": listing.get("category_label") or listing.get("primary_category") or "Others",
                "quoted_value": round(float(q.total_amount or 0.0), 2),
                "stage_key": stage_key,
                "stage_label": stage_label,
                "created_date": created_d.isoformat(),
                "last_activity_date": last_act.isoformat() if last_act else None,
                "age_days": age,
                "ageing_bucket_key": bucket_key,
                "ageing_bucket_label": bucket_label,
                "salesperson": (q.created_by_name or "Unassigned").strip() or "Unassigned",
                "salesperson_id": str(q.created_by_user_id) if q.created_by_user_id else None,
                "next_action_due": due_iso,
                "next_action_urgency": due_urgency,
            }
        )

    bucket_order = {key: idx for idx, (key, *_rest) in enumerate(AGEING_BUCKET_ORDER)}
    rows.sort(
        key=lambda r: (
            bucket_order.get(r["ageing_bucket_key"], 99),
            -r["age_days"],
            -r["quoted_value"],
        )
    )

    total_value = round(sum(r["quoted_value"] for r in rows), 2)
    avg_age = round(sum(r["age_days"] for r in rows) / len(rows), 1) if rows else 0.0

    bucket_summaries = []
    for key, label, _min_d, _max_d in AGEING_BUCKET_ORDER:
        bucket_rows = [r for r in rows if r["ageing_bucket_key"] == key]
        bucket_summaries.append(
            {
                "bucket_key": key,
                "bucket_label": label,
                "count": len(bucket_rows),
                "total_value": round(sum(r["quoted_value"] for r in bucket_rows), 2),
            }
        )

    categories = sorted({str(r["category"]) for r in rows}, key=str.lower)
    stages = sorted({r["stage_key"] for r in rows}, key=lambda k: {"enquiry": 0, "quoted": 1, "negotiation": 2}.get(k, 9))
    owners = sorted(
        {(r["salesperson_id"], r["salesperson"]) for r in rows},
        key=lambda x: x[1].lower(),
    )

    return {
        "report_title": "Pending & Ageing Report",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "as_of_date": as_of.isoformat(),
        "scope_label": scope_label,
        "record_count": len(rows),
        "ageing_buckets": [{"key": k, "label": lbl} for k, lbl, _, _ in AGEING_BUCKET_ORDER],
        "bucket_summaries": bucket_summaries,
        "categories": categories,
        "stages": [
            {"key": "enquiry", "label": "Enquiry"},
            {"key": "quoted", "label": "Quoted"},
            {"key": "negotiation", "label": "Negotiation"},
        ],
        "salespeople": [{"id": oid, "name": name} for oid, name in owners if oid],
        "summary": {
            "total_open_value": total_value,
            "item_count": len(rows),
            "avg_age_days": avg_age,
        },
        "rows": rows,
    }


def _build_lost_business_report(
    scope: ReportScopeData,
    lost_quotes: list[Quotation],
) -> dict:
    date_from = scope.date_from
    date_to = scope.date_to
    scope_label = scope.scope_label

    rows: list[dict] = []
    for q in lost_quotes:
        listing = listing_fields_from_quotation(q)
        raw_remarks = _quotation_loss_remarks(q)
        loss_reason = _categorize_lost_reason(raw_remarks)
        stage_key, stage_label = _stage_lost_at(q)
        loss_local = q.updated_at.astimezone(IST) if q.updated_at else None
        loss_date = loss_local.date() if loss_local else None
        competitor = _extract_competitor(raw_remarks)

        rows.append(
            {
                "quotation_id": str(q.id),
                "quote_ref": q.quote_number,
                "customer_name": _quotation_register_customer(q),
                "product": _quotation_register_product(listing),
                "category": listing.get("category_label") or listing.get("primary_category") or "Others",
                "quoted_value": round(float(q.total_amount or 0.0), 2),
                "loss_date": loss_date.isoformat() if loss_date else None,
                "loss_reason": loss_reason,
                "loss_reason_raw": raw_remarks,
                "competitor": competitor,
                "salesperson": (q.created_by_name or "Unassigned").strip() or "Unassigned",
                "salesperson_id": str(q.created_by_user_id) if q.created_by_user_id else None,
                "stage_lost_at_key": stage_key,
                "stage_lost_at_label": stage_label,
                "notes": raw_remarks,
            }
        )

    rows.sort(key=lambda r: r["quoted_value"], reverse=True)

    total_lost_value = round(sum(r["quoted_value"] for r in rows), 2)
    reason_counts: dict[str, int] = {}
    reason_values: dict[str, float] = {}
    for r in rows:
        reason = r["loss_reason"] or "Unspecified"
        reason_counts[reason] = reason_counts.get(reason, 0) + 1
        reason_values[reason] = reason_values.get(reason, 0.0) + r["quoted_value"]

    sorted_reasons = sorted(reason_counts.items(), key=lambda x: (-x[1], x[0]))
    top_by_count = sorted_reasons[0] if sorted_reasons else (None, 0)
    top_by_value = (
        max(reason_values.items(), key=lambda x: (x[1], x[0])) if reason_values else (None, 0.0)
    )
    max_count = sorted_reasons[0][1] if sorted_reasons else 0

    loss_reason_breakdown = [
        {
            "reason": reason,
            "count": count,
            "is_top": count == max_count and max_count > 0,
            "bar_width_pct": round(count / max_count * 100.0, 1) if max_count > 0 else 0.0,
        }
        for reason, count in sorted_reasons
    ]

    insights: list[str] = []
    if top_by_count[0] == "Price" and top_by_count[1] > 0 and len(rows) > 0:
        share = round(top_by_count[1] / len(rows) * 100)
        insights.append(f"Price accounted for {share}% of losses in this period.")

    categories = sorted({str(r["category"]) for r in rows}, key=str.lower)
    owners = sorted({(r["salesperson_id"], r["salesperson"]) for r in rows}, key=lambda x: x[1].lower())
    stages = sorted({r["stage_lost_at_key"] for r in rows})

    return {
        "report_title": "Lost Business Report",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "scope_label": scope_label,
        "record_count": len(rows),
        "loss_reason_categories": _lost_reason_category_options(),
        "categories": categories,
        "stages_lost_at": [
            {"key": k, "label": l}
            for k, l in [("quoted", "Quoted"), ("negotiation", "Negotiation")]
            if k in stages or not stages
        ],
        "salespeople": [{"id": oid, "name": name} for oid, name in owners if oid],
        "summary": {
            "total_lost_value": total_lost_value,
            "loss_count": len(rows),
            "avg_deal_size_lost": round(total_lost_value / len(rows), 2) if rows else 0.0,
            "top_loss_reason": top_by_count[0],
            "top_loss_reason_count": top_by_count[1],
            "top_loss_reason_by_value": top_by_value[0],
            "top_loss_reason_value": round(float(top_by_value[1]), 2),
        },
        "loss_reason_breakdown": {
            "total": len(rows),
            "reasons": loss_reason_breakdown,
            "insights": insights,
        },
        "rows": rows,
    }


async def get_pending_ageing_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> dict:
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    open_enquiries, open_quotes = await _load_open_pipeline_items(
        db, scope.user_ids, as_of_date=date_to
    )
    return _build_pending_ageing_report(scope, open_enquiries, open_quotes)


async def get_lost_business_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> dict:
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    lost_quotes = await _load_lost_quotes_in_range(
        db, scope.user_ids, date_from=date_from, date_to=date_to
    )
    return _build_lost_business_report(scope, lost_quotes)


AVG_PO_VALUE_DIMENSIONS = ("customer", "product", "category")

DISCOUNT_ACCEPTABLE_MAX_PCT = 5.0
DISCOUNT_MODERATE_MAX_PCT = 15.0
DISCOUNT_APPROVAL_THRESHOLD_PCT = 10.0


def _po_customer_label(po: PurchaseOrder) -> str:
    _, label = _customer_key_label(po.client_company, po.client_name)
    return label


def _po_product_label(po: PurchaseOrder) -> str:
    short = (po.item_desc_short or "").strip()
    if short and short != "—":
        return short
    lines = po.line_items if isinstance(po.line_items, list) else []
    if lines and isinstance(lines[0], dict):
        from services.quotation_service import item_desc_short_from_lines

        return item_desc_short_from_lines(lines[:1]) or "—"
    return "—"


def _po_masters_category(po: PurchaseOrder) -> str:
    from masters.listing_category import listing_fields_from_lines

    lines = po.line_items if isinstance(po.line_items, list) else []
    masters = listing_fields_from_lines(lines, primary_fallback=po.primary_category or "Others")
    return str(masters.get("category_label") or po.primary_category or "Others")


def _aggregate_avg_po_dimension(
    pos: list[PurchaseOrder],
    *,
    key_fn,
) -> list[dict]:
    buckets: dict[str, list[float]] = defaultdict(list)
    for po in pos:
        amt = float(po.total_amount or 0.0)
        if amt <= 0:
            continue
        name = key_fn(po)
        buckets[name].append(amt)

    rows: list[dict] = []
    for name, amounts in buckets.items():
        if not amounts:
            continue
        total = sum(amounts)
        count = len(amounts)
        avg = total / count
        min_v = min(amounts)
        max_v = max(amounts)
        rows.append(
            {
                "dimension_name": name,
                "po_count": count,
                "total_po_value": round(total, 2),
                "avg_po_value": round(avg, 2),
                "min_po_value": round(min_v, 2),
                "max_po_value": round(max_v, 2),
                "value_range": round(max_v - min_v, 2),
            }
        )

    rows.sort(key=lambda r: (-r["avg_po_value"], r["dimension_name"].lower()))
    if not rows:
        return rows

    overall_avg = sum(r["total_po_value"] for r in rows) / sum(r["po_count"] for r in rows)
    max_avg = max(r["avg_po_value"] for r in rows)
    for row in rows:
        row["avg_bar_pct"] = round(row["avg_po_value"] / max_avg * 100.0, 1) if max_avg > 0 else 0.0
        if row["po_count"] >= 2 and overall_avg > 0:
            if row["avg_po_value"] > overall_avg * 1.5:
                row["outlier"] = "high"
            elif row["avg_po_value"] < overall_avg * 0.5:
                row["outlier"] = "low"
            else:
                row["outlier"] = None
        else:
            row["outlier"] = None
    return rows


def _avg_po_dimension_summary(rows: list[dict]) -> dict:
    total_count = sum(r["po_count"] for r in rows)
    total_value = sum(r["total_po_value"] for r in rows)
    return {
        "overall_avg_po_value": round(total_value / total_count, 2) if total_count > 0 else 0.0,
        "total_po_count": total_count,
        "total_won_value": round(total_value, 2),
    }


def _build_avg_po_value_report(scope: ReportScopeData) -> dict:
    pos = [po for po in scope.purchase_orders if float(po.total_amount or 0.0) > 0]
    dimensions: dict[str, dict] = {}
    for dim in AVG_PO_VALUE_DIMENSIONS:
        if dim == "customer":
            key_fn = _po_customer_label
        elif dim == "product":
            key_fn = _po_product_label
        else:
            key_fn = _po_masters_category
        rows = _aggregate_avg_po_dimension(pos, key_fn=key_fn)
        dimensions[dim] = {
            "rows": rows,
            "summary": _avg_po_dimension_summary(rows),
        }

    return {
        "report_title": "Avg PO Value Report",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": scope.date_from.isoformat(),
        "date_to": scope.date_to.isoformat(),
        "scope_label": scope.scope_label,
        "record_count": len(pos),
        "dimensions": dimensions,
    }


def _line_list_total(lines: list) -> float:
    total = 0.0
    for li in lines:
        if not isinstance(li, dict) or bool(li.get("price_tbd")):
            continue
        base = li.get("base_unit_price")
        if base is None:
            base = li.get("unit_price")
        try:
            unit = float(base or 0)
            qty = float(li.get("quantity") or 1)
        except (TypeError, ValueError):
            continue
        if unit > 0:
            total += unit * qty
    return round(total, 2)


def _discount_pct(list_price: float, quoted_price: float) -> float:
    if list_price <= 0:
        return 0.0
    return round(max(0.0, (list_price - quoted_price) / list_price * 100.0), 2)


def _variance_pct(quoted_price: float, final_price: float) -> float:
    if quoted_price <= 0:
        return 0.0
    return round((quoted_price - final_price) / quoted_price * 100.0, 2)


def _discount_band_key(pct: float) -> str:
    if pct <= 0:
        return "none"
    if pct <= DISCOUNT_ACCEPTABLE_MAX_PCT:
        return "low"
    if pct <= DISCOUNT_MODERATE_MAX_PCT:
        return "medium"
    return "high"


def _discount_approval_status(discount_pct: float, *, has_po: bool) -> str:
    if discount_pct <= DISCOUNT_APPROVAL_THRESHOLD_PCT:
        return "not_required"
    if has_po:
        return "approved"
    return "pending"


def _build_discount_price_variance_report(scope: ReportScopeData) -> dict:
    rows: list[dict] = []
    categories: set[str] = set()
    owners: set[tuple[str | None, str]] = set()

    for po in scope.purchase_orders:
        po_total = float(po.total_amount or 0.0)
        if po_total <= 0:
            continue

        quotation = po.quotation
        po_lines = po.line_items if isinstance(po.line_items, list) else []
        list_total = _line_list_total(po_lines)
        quoted_total = po_total

        if quotation is not None:
            quote_lines = quotation.line_items if isinstance(quotation.line_items, list) else []
            quote_list = _line_list_total(quote_lines)
            if quote_list > 0:
                list_total = quote_list
            quoted_total = float(quotation.total_amount or 0.0) or _line_list_total(quote_lines)

        if list_total <= 0:
            list_total = quoted_total

        discount_pct = _discount_pct(list_total, quoted_total)
        variance_pct = _variance_pct(quoted_total, po_total)
        category = _po_masters_category(po)
        product = _po_product_label(po)
        salesperson = (po.created_by_name or "Unassigned").strip() or "Unassigned"
        salesperson_id = str(po.created_by_user_id) if po.created_by_user_id else None
        categories.add(category)
        owners.add((salesperson_id, salesperson))

        quote_ref = po.quote_number or (quotation.quote_number if quotation else None) or "—"
        discount_value = round(max(0.0, list_total - quoted_total), 2)

        rows.append(
            {
                "po_id": str(po.id),
                "quotation_id": str(po.quotation_id) if po.quotation_id else None,
                "reference": po.po_number,
                "quote_ref": quote_ref,
                "customer_name": _po_customer_label(po),
                "product": product,
                "category": category,
                "list_price": round(list_total, 2),
                "quoted_price": round(quoted_total, 2),
                "final_po_price": round(po_total, 2),
                "discount_pct": discount_pct,
                "discount_value": discount_value,
                "variance_pct": variance_pct,
                "discount_band": _discount_band_key(discount_pct),
                "approval_status": _discount_approval_status(discount_pct, has_po=True),
                "salesperson": salesperson,
                "salesperson_id": salesperson_id,
            }
        )

    rows.sort(key=lambda r: (-r["discount_pct"], -r["final_po_price"]))

    discounted = [r for r in rows if r["discount_pct"] > 0]
    total_discount_value = round(sum(r["discount_value"] for r in discounted), 2)
    avg_discount = (
        round(sum(r["discount_pct"] for r in discounted) / len(discounted), 2) if discounted else 0.0
    )

    return {
        "report_title": "Discount / Price Variance Report",
        "generated_at": datetime.now(IST).isoformat(),
        "date_from": scope.date_from.isoformat(),
        "date_to": scope.date_to.isoformat(),
        "scope_label": scope.scope_label,
        "record_count": len(rows),
        "discount_thresholds": {
            "acceptable_max_pct": DISCOUNT_ACCEPTABLE_MAX_PCT,
            "moderate_max_pct": DISCOUNT_MODERATE_MAX_PCT,
            "approval_threshold_pct": DISCOUNT_APPROVAL_THRESHOLD_PCT,
        },
        "categories": sorted(categories, key=str.lower),
        "salespeople": [{"id": oid, "name": name} for oid, name in sorted(owners, key=lambda x: x[1].lower()) if oid],
        "summary": {
            "avg_discount_pct": avg_discount,
            "total_discount_value": total_discount_value,
            "discounted_deal_count": len(discounted),
        },
        "rows": rows,
    }


async def get_avg_po_value_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> dict:
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    return _build_avg_po_value_report(scope)


async def get_discount_price_variance_report(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> dict:
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    return _build_discount_price_variance_report(scope)


async def get_reports_bundle(
    db: AsyncSession,
    *,
    actor_tier: str,
    actor_id: str,
    date_from: date,
    date_to: date,
    user_id: str | None = None,
) -> dict:
    """Load enquiries, quotations, and POs once; build all tab reports in-process."""
    scope = await _load_report_scope_data(
        db,
        actor_tier=actor_tier,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    open_enquiries, open_quotes = await _load_open_pipeline_items(
        db, scope.user_ids, as_of_date=date_to
    )
    lost_quotes = await _load_lost_quotes_in_range(
        db, scope.user_ids, date_from=date_from, date_to=date_to
    )
    generated_at = datetime.now(IST).isoformat()
    return {
        "generated_at": generated_at,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "scope_label": scope.scope_label,
        "conversion_pipeline": {
            group_by: _build_conversion_pipeline_report(scope, group_by)
            for group_by in sorted(CONVERSION_PIPELINE_GROUP_BY)
        },
        "quotation_register": _build_quotation_register_report(scope),
        "win_loss_analysis": _build_win_loss_analysis_report(scope),
        "sales_performance_by_user": _build_sales_performance_by_user_report(scope),
        "source_roi": _build_source_roi_report(scope),
        "so_handoff": _build_so_handoff_report(scope),
        "customer": _build_customer_report(scope),
        "response_sla": _build_response_sla_report(scope),
        "pending_ageing": _build_pending_ageing_report(scope, open_enquiries, open_quotes),
        "lost_business": _build_lost_business_report(scope, lost_quotes),
        "avg_po_value": _build_avg_po_value_report(scope),
        "discount_price_variance": _build_discount_price_variance_report(scope),
    }
