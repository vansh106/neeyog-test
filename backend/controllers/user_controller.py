from __future__ import annotations

from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import Permission
from core.auth_middleware import CurrentUser
from core.exceptions import AuthorizationError, UserNotFoundError
from services import user_management_service


class CreateUserRequest(BaseModel):
    email: str
    full_name: str
    job_title: str | None = None
    tier: str = "member"
    permissions: list[str] = []

    @field_validator("tier")
    @classmethod
    def validate_tier(cls, v: str):
        if v not in ["member", "admin"]:
            raise ValueError("Tier must be 'member' or 'admin'")
        return v

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v: list[str]):
        valid = {p.value for p in Permission}
        for perm in v:
            if perm not in valid:
                raise ValueError(f"Invalid permission: {perm}")
        return v


class UpdatePermissionsRequest(BaseModel):
    permissions: list[str]

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v: list[str]):
        valid = {p.value for p in Permission}
        for perm in v:
            if perm not in valid:
                raise ValueError(f"Invalid permission: {perm}")
        return v


async def handle_create_user(body: CreateUserRequest, current_user: CurrentUser, db: AsyncSession) -> dict:
    user, temp_password = await user_management_service.create_user(
        full_name=body.full_name,
        email=body.email,
        job_title=body.job_title,
        tier=body.tier,
        permissions=body.permissions,
        created_by_id=current_user.id,
        db=db,
    )
    return {"user": await user_management_service.get_user(str(user.id), db), "temp_password": temp_password}


async def handle_update_permissions(
    user_id: str,
    body: UpdatePermissionsRequest,
    current_user: CurrentUser,
    db: AsyncSession,
) -> dict:
    await user_management_service.update_user_permissions(
        target_user_id=user_id,
        new_permissions=body.permissions,
        updated_by_id=current_user.id,
        db=db,
    )
    return await user_management_service.get_user(user_id, db)


async def handle_deactivate_user(user_id: str, current_user: CurrentUser, db: AsyncSession) -> dict:
    await user_management_service.deactivate_user(user_id, current_user.id, db)
    return {"message": "User deactivated"}


async def handle_reactivate_user(user_id: str, current_user: CurrentUser, db: AsyncSession) -> dict:
    await user_management_service.reactivate_user(user_id, db)
    return {"message": "User reactivated"}


async def handle_reset_password(user_id: str, current_user: CurrentUser, db: AsyncSession) -> dict:
    temp_password = await user_management_service.reset_user_password(user_id, current_user.id, db)
    return {"message": "Password reset", "temp_password": temp_password}


async def handle_list_users(db: AsyncSession) -> list[dict]:
    return await user_management_service.list_users(db)


async def handle_get_user(user_id: str, db: AsyncSession) -> dict:
    return await user_management_service.get_user(user_id, db)

