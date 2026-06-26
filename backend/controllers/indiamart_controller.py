"""IndiaMart HTTP handlers."""

from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.enquiry_controller import ManualEnquiryCreateRequest
from core.auth_middleware import CurrentUser
from services import indiamart_service

logger = logging.getLogger(__name__)


async def handle_list_queries(
    db: AsyncSession,
    *,
    include_archived: bool = False,
    auto_sync: bool = True,
) -> dict:
    return await indiamart_service.list_queries(
        db,
        include_archived=include_archived,
        auto_sync=auto_sync,
    )


async def handle_sync_now(db: AsyncSession) -> dict:
    return await indiamart_service.sync_indiamart_leads(db, force=True)


async def handle_get_prefill(query_id: str, db: AsyncSession) -> dict:
    try:
        qid = uuid.UUID(query_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid query id") from exc

    q = await indiamart_service.get_query(db, qid)
    if q is None:
        raise HTTPException(status_code=404, detail="IndiaMart query not found")
    return indiamart_service.build_prefill(q)


async def handle_pickup_query(
    query_id: str,
    body: ManualEnquiryCreateRequest,
    db: AsyncSession,
    user: CurrentUser,
) -> dict:
    try:
        qid = uuid.UUID(query_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid query id") from exc

    picker_name = (user.full_name or user.email or "").strip()
    try:
        result = await indiamart_service.pickup_query(
            db,
            qid,
            body.model_dump(by_alias=True),
            picked_up_by_user_id=uuid.UUID(user.id),
            picked_up_by_name=picker_name,
        )
    except ValueError as exc:
        msg = str(exc)
        status = 409 if "already been picked up" in msg.lower() else 400
        raise HTTPException(status_code=status, detail=msg) from exc

    logger.info(
        "IndiaMart query %s picked up by %s -> enquiry %s",
        query_id,
        user.email,
        result.get("enquiry_id"),
    )
    return result


async def handle_archive_query(query_id: str, db: AsyncSession, user: CurrentUser) -> dict:
    try:
        qid = uuid.UUID(query_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid query id") from exc

    try:
        q = await indiamart_service.archive_query(db, qid)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    logger.info("IndiaMart query %s archived by %s", q.unique_query_id, user.email)
    return {"id": str(q.id), "is_archived": True}
