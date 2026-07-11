"""Analytics API routes."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from controllers import analytics_controller
from core.auth_middleware import CurrentUser, get_current_user, require_permission
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


@router.get("/conversion-pipeline-report")
async def conversion_pipeline_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    group_by: str = Query(
        "month",
        description="Grouping dimension: month | user | category | customer",
    ),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_conversion_pipeline_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        group_by=group_by,
    )


@router.get("/quotation-register-report")
async def quotation_register_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_quotation_register_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/win-loss-analysis-report")
async def win_loss_analysis_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_win_loss_analysis_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/sales-performance-by-user-report")
async def sales_performance_by_user_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_sales_performance_by_user_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/source-roi-report")
async def source_roi_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_source_roi_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/so-handoff-report")
async def so_handoff_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_so_handoff_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/customer-report")
async def customer_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_customer_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/reports-bundle")
async def reports_bundle_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_reports_bundle(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/response-sla-report")
async def response_sla_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    sla_target_hours: float = Query(4.0, ge=0.5, le=168, description="SLA target in hours"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_response_sla_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        sla_target_hours=sla_target_hours,
    )


@router.get("/pending-ageing-report")
async def pending_ageing_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_pending_ageing_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/lost-business-report")
async def lost_business_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_lost_business_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/avg-po-value-report")
async def avg_po_value_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_avg_po_value_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/discount-price-variance-report")
async def discount_price_variance_report_route(
    user: CurrentUser = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
    date_from: date = Query(..., description="Start date (inclusive, IST)"),
    date_to: date = Query(..., description="End date (inclusive, IST)"),
    user_id: str | None = Query(None, description="Admin only — filter to a specific user"),
):
    return await analytics_controller.handle_discount_price_variance_report(
        db,
        user,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )
