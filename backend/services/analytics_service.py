"""Booking target and revenue analytics."""

from __future__ import annotations

import calendar
import re
import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models import ClientBranch, Enquiry, PurchaseOrder, Quotation, User, UserTier
from services.enquiry_service import item_desc_short_from_enquiry
from services.fiscal_numbering import fiscal_year_code
from services.masters_service import CATEGORY_LABEL_BY_KEY, _category_label
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
    "hold": "Hold",
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
    if delta <= 3:
        return f"Due in {delta}d", "soon", delta
    return due.strftime("%d %b"), "neutral", 100 + delta


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

    follow_stmt = select(Quotation).where(
        Quotation.is_archived.is_(False),
        Quotation.status.in_(["ongoing", "hold"]),
        or_(
            Quotation.next_follow_up_date.is_(None),
            Quotation.next_follow_up_date <= today + timedelta(days=3),
        ),
    )
    if user_ids:
        follow_stmt = follow_stmt.where(Quotation.created_by_user_id.in_(user_ids))

    follow_rows = list((await db.execute(follow_stmt)).scalars().all())
    follow_items: list[dict] = []
    for q in follow_rows:
        due_label, due_urgency, due_rank = _due_meta(q.next_follow_up_date, today)
        status_key = (q.status or "ongoing").lower()
        follow_items.append(
            {
                "quotation_id": str(q.id),
                "enquiry_id": str(q.enquiry_id),
                "client_product": _quotation_client_product(q),
                "deal_value": round(float(q.total_amount or 0.0), 2),
                "due_label": due_label,
                "due_urgency": due_urgency,
                "due_rank": due_rank,
                "status": status_key,
                "status_label": QUOTATION_CRM_LABELS.get(status_key, status_key.replace("_", " ").title()),
            }
        )
    follow_items.sort(key=lambda x: (x["due_rank"], -x["deal_value"]))

    expiry_end = today + timedelta(days=7)
    expiry_stmt = select(Quotation).where(
        Quotation.is_archived.is_(False),
        Quotation.status == "ongoing",
        Quotation.validity_date.isnot(None),
        Quotation.validity_date >= today,
        Quotation.validity_date <= expiry_end,
    )
    if user_ids:
        expiry_stmt = expiry_stmt.where(Quotation.created_by_user_id.in_(user_ids))

    expiry_rows = list((await db.execute(expiry_stmt)).scalars().all())
    accounts: dict[str, dict] = {}
    for q in expiry_rows:
        account = _quotation_account_name(q)
        amount = float(q.total_amount or 0.0)
        no_follow_up = q.next_follow_up_date is None
        if account not in accounts:
            accounts[account] = {
                "account_name": account,
                "expiring_value": 0.0,
                "no_follow_up_logged": False,
            }
        accounts[account]["expiring_value"] += amount
        if no_follow_up:
            accounts[account]["no_follow_up_logged"] = True

    account_breakdown = sorted(
        [
            {
                "account_name": row["account_name"],
                "expiring_value": round(row["expiring_value"], 2),
                "no_follow_up_logged": row["no_follow_up_logged"],
            }
            for row in accounts.values()
        ],
        key=lambda x: -x["expiring_value"],
    )
    expiring_total = round(sum(a["expiring_value"] for a in account_breakdown), 2)

    follow_pipeline_total = round(sum(x["deal_value"] for x in follow_items), 2)

    return {
        "incomplete_enquiries": {
            "count": len(incomplete_items),
            "items": incomplete_items,
        },
        "follow_ups_due": {
            "count": len(follow_items),
            "pipeline_value": follow_pipeline_total,
            "items": follow_items,
        },
        "quote_expiry": {
            "has_expiring_quotes": expiring_total > 0,
            "expiring_value": expiring_total,
            "timeframe_days": 7,
            "accounts": account_breakdown,
        },
    }


ENQUIRY_SOURCE_VALUES = frozenset({"email", "indiamart", "manual", "referral"})

LOST_REASON_RULES: list[tuple[str, list[str]]] = [
    ("Price", ["price", "pricing", "cost", "expensive", "costly", "budget", "cheaper"]),
    ("Delivery time", ["delivery", "lead time", "lead-time", "timeline", "dispatch", "freight"]),
    ("No response", ["no response", "ghost", "silent", "unresponsive", "did not reply", "no reply"]),
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
        .where(Enquiry.created_at >= start_dt, Enquiry.created_at < end_dt)
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
