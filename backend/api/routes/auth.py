from fastapi import APIRouter, Depends, Request, Response
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
    res = await auth_controller.handle_login(body, request, db)
    max_age = int(auth_controller.auth_service.settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)
    response.set_cookie(
        "refresh_token",
        res["refresh_token"],
        max_age=max_age,
        **auth_controller.cookie_kwargs(),
    )
    return res


@router.post("/refresh")
async def refresh_route(
    body: RefreshRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    res = await auth_controller.handle_refresh(body, request, db)
    max_age = int(auth_controller.auth_service.settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)
    response.set_cookie(
        "refresh_token",
        res["refresh_token"],
        max_age=max_age,
        **auth_controller.cookie_kwargs(),
    )
    return res


@router.post("/logout", status_code=204)
async def logout_route(
    body: LogoutRequest,
    response: Response,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await auth_controller.handle_logout(body, current_user, db)
    response.delete_cookie("refresh_token", path="/")
    return None


@router.get("/me")
async def me_route(current_user: CurrentUser = Depends(get_current_user)):
    return auth_controller.handle_me(current_user)


@router.post("/change-password")
async def change_password_route(
    body: ChangePasswordRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await auth_controller.handle_change_password(body, current_user, db)

