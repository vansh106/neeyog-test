"""Analytics HTTP handlers."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException

from core.auth_middleware import CurrentUser
from services import analytics_service


async def handle_booking_target_tracker(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    year: int | None,
    month: int | None,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_booking_target_tracker(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            year=year,
            month=month,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


async def handle_dashboard_kpis(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    year: int | None,
    month: int | None,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_dashboard_kpis(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            year=year,
            month=month,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


async def handle_action_queues(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_action_queues(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


async def handle_sales_funnel(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    year: int | None,
    month: int | None,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_sales_funnel(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            year=year,
            month=month,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


async def handle_dashboard_charts(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    year: int | None,
    month: int | None,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_dashboard_charts(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            year=year,
            month=month,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


async def handle_pipeline_register(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_pipeline_register(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


async def handle_pipeline_month_enquiries(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    year: int,
    month: int,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_pipeline_month_enquiries(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            year=year,
            month=month,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


async def handle_conversion_pipeline_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
    group_by: str,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_conversion_pipeline_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            group_by=group_by,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_quotation_register_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_quotation_register_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_win_loss_analysis_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_win_loss_analysis_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_sales_performance_by_user_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_sales_performance_by_user_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_source_roi_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_source_roi_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_so_handoff_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_so_handoff_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_customer_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_customer_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_response_sla_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
    sla_target_hours: float,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_response_sla_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            sla_target_hours=sla_target_hours,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_pending_ageing_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_pending_ageing_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_lost_business_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_lost_business_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_avg_po_value_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_avg_po_value_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_discount_price_variance_report(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_discount_price_variance_report(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_reports_bundle(
    db: Any,
    user: CurrentUser,
    *,
    user_id: str | None,
    date_from: date,
    date_to: date,
) -> dict:
    if user_id and user.tier not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed to view another user's analytics")

    try:
        return await analytics_service.get_reports_bundle(
            db,
            actor_tier=user.tier,
            actor_id=user.id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
