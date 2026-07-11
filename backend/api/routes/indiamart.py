"""IndiaMart lead listing and pickup routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.enquiry_controller import ManualEnquiryCreateRequest
from controllers import indiamart_controller
from core.auth_middleware import CurrentUser, get_current_user
from core.database import get_db

router = APIRouter(prefix="/api/indiamart", tags=["indiamart"])


@router.get("/queries")
async def list_indiamart_queries(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[CurrentUser, Depends(get_current_user)],
    include_archived: bool = Query(False),
):
    return await indiamart_controller.handle_list_queries(
        db,
        include_archived=include_archived,
    )


@router.get("/queries/{query_id}/prefill")
async def get_indiamart_prefill(
    query_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[CurrentUser, Depends(get_current_user)],
):
    return await indiamart_controller.handle_get_prefill(query_id, db)


@router.post("/queries/{query_id}/pickup")
async def pickup_indiamart_query(
    query_id: str,
    body: ManualEnquiryCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
):
    return await indiamart_controller.handle_pickup_query(query_id, body, db, user)


@router.post("/queries/{query_id}/archive")
async def archive_indiamart_query(
    query_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
):
    return await indiamart_controller.handle_archive_query(query_id, db, user)
