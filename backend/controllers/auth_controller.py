"""Auth HTTP handlers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AuthenticationError, UserNotFoundError
from core.config import get_settings
from services import auth_service

logger = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @model_validator(mode="after")
    def validate_new(self) -> ChangePasswordRequest:
        ok, msg = auth_service.is_strong_password(self.new_password)
        if not ok:
            raise ValueError(msg)
        return self


async def handle_login(body: LoginRequest, request: Request, response: Response, db: AsyncSession) -> dict:
    try:
        ua = request.headers.get("user-agent", "")[:500]
        client = request.client.host if request.client else None
        data = await auth_service.login(
            body.email,
            body.password,
            device_info=ua or None,
            client_ip=client,
            db=db,
        )
        s = get_settings()
        response.set_cookie(
            key="refresh_token",
            value=data["refresh_token"],
            httponly=True,
            samesite="lax",
            max_age=s.refresh_token_expire_days * 86400,
            path="/",
        )
        return data
    except AuthenticationError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e


async def handle_refresh(body: RefreshRequest, response: Response, db: AsyncSession) -> dict:
    try:
        data = await auth_service.refresh_access_token(body.refresh_token, db)
        s = get_settings()
        response.set_cookie(
            key="refresh_token",
            value=data["refresh_token"],
            httponly=True,
            samesite="lax",
            max_age=s.refresh_token_expire_days * 86400,
            path="/",
        )
        return data
    except AuthenticationError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e


async def handle_logout(
    body: LogoutRequest,
    response: Response,
    db: AsyncSession,
) -> None:
    await auth_service.logout(body.refresh_token, db)
    response.delete_cookie("refresh_token", path="/")


async def handle_me(current: Any) -> dict:
    return {
        "id": current.id,
        "email": current.email,
        "full_name": current.full_name,
        "tier": current.tier,
        "job_title": current.job_title,
        "permissions": current.permissions,
    }


async def handle_change_password(
    user_id: str,
    body: ChangePasswordRequest,
    db: AsyncSession,
) -> dict:
    try:
        await auth_service.change_password(user_id, body.old_password, body.new_password, db)
        return {"message": "Password changed"}
    except AuthenticationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except UserNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
