"""Analytics HTTP handlers."""

from __future__ import annotations

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
