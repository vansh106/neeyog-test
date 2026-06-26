"""User management HTTP handlers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel, field_validator

from config.permissions import PERMISSION_GROUPS, PERMISSION_PRESETS, Permission
from core.auth_middleware import CurrentUser
from core.exceptions import AuthorizationError, UserNotFoundError
from services import user_management_service

logger = logging.getLogger(__name__)


class MailboxAccessIn(BaseModel):
    mailbox_id: str
    can_view: bool = True
    can_process: bool = True
    can_trigger_sync: bool = False


class CreateUserRequest(BaseModel):
    email: str
    full_name: str
    job_title: str | None = None
    tier: str = "member"
    permissions: list[str] = []
    mailbox_access: list[MailboxAccessIn] = []

    @field_validator("tier")
    @classmethod
    def validate_tier(cls, v: str) -> str:
        if v not in ("member", "admin", "indiamart"):
            raise ValueError("Tier must be 'member', 'admin', or 'indiamart'")
        return v

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v: list[str]) -> list[str]:
        valid = {p.value for p in Permission}
        for perm in v:
            if perm not in valid:
                raise ValueError(f"Invalid permission: {perm}")
        return v


class UpdatePermissionsRequest(BaseModel):
    permissions: list[str]

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v: list[str]) -> list[str]:
        valid = {p.value for p in Permission}
        for perm in v:
            if perm not in valid:
                raise ValueError(f"Invalid permission: {perm}")
        return v


class UpdateMailboxAccessRequest(BaseModel):
    access: list[MailboxAccessIn]


class UpdateMonthlyBookingTargetRequest(BaseModel):
    monthly_booking_target: float

    @field_validator("monthly_booking_target")
    @classmethod
    def validate_target(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Monthly booking target must be zero or positive")
        return v


def permission_groups_dict() -> dict[str, list[str]]:
    return {k: [p.value for p in v] for k, v in PERMISSION_GROUPS.items()}


def permission_presets_dict() -> dict[str, list[str]]:
    return {k: [p.value for p in v] for k, v in PERMISSION_PRESETS.items()}


async def handle_list_users(db: Any, include_inactive: bool) -> list[dict]:
    return await user_management_service.list_users(db, include_inactive=include_inactive)


async def handle_get_user(user_id: str, db: Any) -> dict:
    try:
        return await user_management_service.get_user(user_id, db)
    except UserNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


async def handle_create_user(body: CreateUserRequest, actor: CurrentUser, db: Any) -> dict:
    try:
        mailbox_payload = [a.model_dump() for a in body.mailbox_access]
        user, temp = await user_management_service.create_user(
            full_name=body.full_name,
            email=body.email,
            job_title=body.job_title,
            tier=body.tier,
            permissions=body.permissions,
            mailbox_access=mailbox_payload,
            created_by_id=actor.id,
            db=db,
        )
        return {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "tier": user.tier,
                "job_title": user.job_title,
            },
            "temp_password": temp,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_update_mailbox_access(
    user_id: str,
    body: UpdateMailboxAccessRequest,
    actor: CurrentUser,
    db: Any,
) -> dict:
    if user_id == actor.id:
        raise HTTPException(status_code=400, detail="Use another admin to change your mailbox access")
    try:
        await user_management_service.update_user_mailbox_access(
            user_id,
            [a.model_dump() for a in body.access],
            actor.id,
            db,
        )
        return await user_management_service.get_user(user_id, db)
    except UserNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except AuthorizationError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_update_permissions(
    user_id: str,
    body: UpdatePermissionsRequest,
    actor: CurrentUser,
    db: Any,
) -> dict:
    if user_id == actor.id:
        raise HTTPException(status_code=400, detail="Cannot edit your own permissions here")
    try:
        await user_management_service.update_user_permissions(
            user_id, body.permissions, actor.id, db
        )
        return await user_management_service.get_user(user_id, db)
    except UserNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except AuthorizationError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_update_monthly_booking_target(
    user_id: str,
    body: UpdateMonthlyBookingTargetRequest,
    actor: CurrentUser,
    db: Any,
) -> dict:
    try:
        await user_management_service.update_monthly_booking_target(
            user_id,
            body.monthly_booking_target,
            actor.id,
            db,
        )
        return await user_management_service.get_user(user_id, db)
    except UserNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except AuthorizationError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_deactivate(user_id: str, db: Any) -> None:
    try:
        await user_management_service.deactivate_user(user_id, "", db)
    except UserNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except AuthorizationError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e


async def handle_reactivate(user_id: str, db: Any) -> None:
    try:
        await user_management_service.reactivate_user(user_id, db)
    except UserNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


async def handle_reset_password(user_id: str, db: Any) -> dict:
    try:
        temp = await user_management_service.reset_user_password(user_id, db)
        return {"message": "Password reset", "temp_password": temp}
    except UserNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
