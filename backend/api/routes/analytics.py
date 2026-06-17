"""Analytics API routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from controllers import analytics_controller
from core.auth_middleware import CurrentUser, get_current_user
from core.database import get_db

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/booking-target")
async def booking_target_route(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
    year: int | None = Query(None, ge=2020, le=2100),
    month: int | None = Query(None, ge=1, le=12),
):
    return await analytics_controller.handle_booking_target_tracker(
        db,
        user,
        user_id=user_id,
        year=year,
        month=month,
    )


@router.get("/kpis")
async def dashboard_kpis_route(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
    year: int | None = Query(None, ge=2020, le=2100),
    month: int | None = Query(None, ge=1, le=12),
):
    return await analytics_controller.handle_dashboard_kpis(
        db,
        user,
        user_id=user_id,
        year=year,
        month=month,
    )


@router.get("/action-queues")
async def action_queues_route(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_action_queues(
        db,
        user,
        user_id=user_id,
    )


@router.get("/sales-funnel")
async def sales_funnel_route(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
    year: int | None = Query(None, ge=2020, le=2100),
    month: int | None = Query(None, ge=1, le=12),
):
    return await analytics_controller.handle_sales_funnel(
        db,
        user,
        user_id=user_id,
        year=year,
        month=month,
    )


@router.get("/charts")
async def dashboard_charts_route(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
    year: int | None = Query(None, ge=2020, le=2100),
    month: int | None = Query(None, ge=1, le=12),
):
    return await analytics_controller.handle_dashboard_charts(
        db,
        user,
        user_id=user_id,
        year=year,
        month=month,
    )


@router.get("/pipeline-register")
async def pipeline_register_route(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_pipeline_register(
        db,
        user,
        user_id=user_id,
    )


@router.get("/pipeline-register/enquiries")
async def pipeline_month_enquiries_route(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
):
    return await analytics_controller.handle_pipeline_month_enquiries(
        db,
        user,
        user_id=user_id,
        year=year,
        month=month,
    )
