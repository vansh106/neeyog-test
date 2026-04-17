from __future__ import annotations

from fastapi import HTTPException, Request, status
from pydantic import BaseModel, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_middleware import CurrentUser
from core.exceptions import AuthenticationError
from services import auth_service


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
    def validate_new(self):
        ok, msg = auth_service.is_strong_password(self.new_password)
        if not ok:
            raise ValueError(msg)
        return self


def cookie_kwargs() -> dict:
    # Keep refresh token in httpOnly cookie too.
    # For local dev over http, secure=False.
    return {
        "httponly": True,
        "samesite": "lax",
        "secure": False,
        "path": "/",
    }


async def handle_login(body: LoginRequest, request: Request, db: AsyncSession) -> dict:
    device_info = request.headers.get("user-agent")
    try:
        return await auth_service.login(body.email, body.password, device_info, db)
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e


async def handle_refresh(body: RefreshRequest, request: Request, db: AsyncSession) -> dict:
    try:
        return await auth_service.refresh_access_token(body.refresh_token, db)
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e


async def handle_logout(body: LogoutRequest, current_user: CurrentUser, db: AsyncSession) -> None:
    await auth_service.logout(body.refresh_token, db)


def handle_me(current_user: CurrentUser) -> dict:
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "tier": current_user.tier,
        "job_title": current_user.job_title,
        "permissions": current_user.permissions,
    }


async def handle_change_password(body: ChangePasswordRequest, current_user: CurrentUser, db: AsyncSession) -> dict:
    await auth_service.change_password(current_user.id, body.old_password, body.new_password, db)
    return {"message": "Password changed"}

