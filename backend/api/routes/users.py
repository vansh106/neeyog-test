from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import PERMISSION_GROUPS, PERMISSION_PRESETS, Permission
from controllers import user_controller
from controllers.user_controller import CreateUserRequest, UpdatePermissionsRequest
from core.auth_middleware import CurrentUser, get_current_user, require_admin, require_permission
from core.database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/")
async def list_users_route(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin()),
    current_user: CurrentUser = Depends(require_permission(Permission.USERS_VIEW)),
):
    return await user_controller.handle_list_users(db)


@router.post("/")
async def create_user_route(
    body: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin()),
    current_user: CurrentUser = Depends(require_permission(Permission.USERS_CREATE)),
):
    return await user_controller.handle_create_user(body, current_user, db)


@router.get("/permission-groups")
async def permission_groups_route(
    _user: CurrentUser = Depends(get_current_user),
):
    return {k: [p.value for p in v] for k, v in PERMISSION_GROUPS.items()}


@router.get("/permission-presets")
async def permission_presets_route(
    _user: CurrentUser = Depends(get_current_user),
):
    return {k: [p.value for p in v] for k, v in PERMISSION_PRESETS.items()}


@router.get("/{user_id}")
async def get_user_route(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin()),
    current_user: CurrentUser = Depends(require_permission(Permission.USERS_VIEW)),
):
    return await user_controller.handle_get_user(user_id, db)


@router.patch("/{user_id}/permissions")
async def update_permissions_route(
    user_id: str,
    body: UpdatePermissionsRequest,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin()),
    current_user: CurrentUser = Depends(require_permission(Permission.USERS_EDIT)),
):
    return await user_controller.handle_update_permissions(user_id, body, current_user, db)


@router.patch("/{user_id}/deactivate")
async def deactivate_route(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin()),
    current_user: CurrentUser = Depends(require_permission(Permission.USERS_DEACTIVATE)),
):
    return await user_controller.handle_deactivate_user(user_id, current_user, db)


@router.patch("/{user_id}/reactivate")
async def reactivate_route(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin()),
    current_user: CurrentUser = Depends(require_permission(Permission.USERS_DEACTIVATE)),
):
    return await user_controller.handle_reactivate_user(user_id, current_user, db)


@router.post("/{user_id}/reset-password")
async def reset_password_route(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin()),
    current_user: CurrentUser = Depends(require_permission(Permission.USERS_EDIT)),
):
    return await user_controller.handle_reset_password(user_id, current_user, db)

