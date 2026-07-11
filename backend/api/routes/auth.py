"""Authentication routes."""

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from controllers import auth_controller
from controllers.auth_controller import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
)
from core.auth_middleware import CurrentUser, get_current_user
from core.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login_route(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    return await auth_controller.handle_login(body, request, response, db)


@router.post("/refresh")
async def refresh_route(
    body: RefreshRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    return await auth_controller.handle_refresh(body, response, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_route(
    body: LogoutRequest,
    response: Response,
    _user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await auth_controller.handle_logout(body, response, db)


@router.get("/me")
async def me_route(
    current: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await auth_controller.handle_me(current.id, db)


@router.post("/change-password")
async def change_password_route(
    body: ChangePasswordRequest,
    current: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await auth_controller.handle_change_password(current.id, body, db)
