"""Admin user management."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from controllers import user_controller
from controllers.user_controller import (
    CreateUserRequest,
    UpdateMailboxAccessRequest,
    UpdatePermissionsRequest,
)
from core.auth_middleware import CurrentUser, get_current_user, require_admin_permissions
from core.database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])


class ResetPasswordResponse(BaseModel):
    message: str
    temp_password: str


@router.get("/permission-groups")
async def permission_groups_route(_: CurrentUser = Depends(get_current_user)):
    return user_controller.permission_groups_dict()


@router.get("/permission-presets")
async def permission_presets_route(_: CurrentUser = Depends(get_current_user)):
    return user_controller.permission_presets_dict()


@router.get("/")
async def list_users_route(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin_permissions(Permission.USERS_VIEW)),
):
    return await user_controller.handle_list_users(db, include_inactive)


@router.get("/{user_id}")
async def get_user_route(
    user_id: str,
    _: CurrentUser = Depends(require_admin_permissions(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    return await user_controller.handle_get_user(user_id, db)


@router.post("/")
async def create_user_route(
    body: CreateUserRequest,
    actor: CurrentUser = Depends(require_admin_permissions(Permission.USERS_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    return await user_controller.handle_create_user(body, actor, db)


@router.patch("/{user_id}/permissions")
async def patch_permissions_route(
    user_id: str,
    body: UpdatePermissionsRequest,
    actor: CurrentUser = Depends(require_admin_permissions(Permission.USERS_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    return await user_controller.handle_update_permissions(user_id, body, actor, db)


@router.patch("/{user_id}/mailbox-access")
async def patch_mailbox_access_route(
    user_id: str,
    body: UpdateMailboxAccessRequest,
    actor: CurrentUser = Depends(require_admin_permissions(Permission.USERS_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    return await user_controller.handle_update_mailbox_access(user_id, body, actor, db)


@router.patch("/{user_id}/deactivate", status_code=204)
async def deactivate_route(
    user_id: str,
    _: CurrentUser = Depends(require_admin_permissions(Permission.USERS_DEACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    await user_controller.handle_deactivate(user_id, db)


@router.patch("/{user_id}/reactivate", status_code=204)
async def reactivate_route(
    user_id: str,
    _: CurrentUser = Depends(require_admin_permissions(Permission.USERS_DEACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    await user_controller.handle_reactivate(user_id, db)


@router.post("/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_password_route(
    user_id: str,
    _: CurrentUser = Depends(require_admin_permissions(Permission.USERS_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    return await user_controller.handle_reset_password(user_id, db)
