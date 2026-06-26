"""FastAPI dependencies: JWT user + permission checks."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config.permissions import Permission
from core.exceptions import AuthenticationError
from services.auth_service import decode_access_token

security = HTTPBearer()


class CurrentUser:
    """Built from JWT payload (no DB read per request)."""

    def __init__(self, payload: dict):
        self.id: str = str(payload["sub"])
        self.email: str = str(payload["email"])
        self.full_name: str = str(payload.get("full_name", ""))
        self.tier: str = str(payload.get("tier", "member"))
        self.job_title: str | None = payload.get("job_title")
        self.permissions: list[str] = list(payload.get("permissions", []))

    def has_permission(self, permission: Permission) -> bool:
        if self.tier == "superadmin":
            return True
        return permission.value in self.permissions

    def has_any(self, *permissions: Permission) -> bool:
        return any(self.has_permission(p) for p in permissions)

    def has_all(self, *permissions: Permission) -> bool:
        return all(self.has_permission(p) for p in permissions)

    @property
    def is_admin_or_above(self) -> bool:
        return self.tier in ("admin", "superadmin")

    @property
    def can_access_indiamart(self) -> bool:
        return self.tier in ("admin", "superadmin", "indiamart")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> CurrentUser:
    try:
        payload = decode_access_token(credentials.credentials)
        return CurrentUser(payload)
    except AuthenticationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


def require_permission(*permissions: Permission):
    """User must have ALL listed permissions (or be superadmin)."""

    async def checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        for perm in permissions:
            if not current_user.has_permission(perm):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "insufficient_permissions",
                        "required": perm.value,
                        "message": "You don't have permission to perform this action.",
                    },
                )
        return current_user

    return checker


def require_any_permission(*permissions: Permission):
    """User must have at least one of the listed permissions (or be superadmin)."""

    async def checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.has_any(*permissions):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "insufficient_permissions",
                "required_any": [p.value for p in permissions],
                "message": "You don't have permission to perform this action.",
            },
        )

    return checker


def require_admin_permissions(*permissions: Permission):
    """Admin or superadmin tier AND all listed permissions."""

    async def checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not current_user.is_admin_or_above:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
        for perm in permissions:
            if not current_user.has_permission(perm):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "insufficient_permissions",
                        "required": perm.value,
                        "message": "You don't have permission to perform this action.",
                    },
                )
        return current_user

    return checker


def require_indiamart_access():
    """Admin, superadmin, or dedicated IndiaMart account tier."""

    async def checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not current_user.can_access_indiamart:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="IndiaMart access required",
            )
        return current_user

    return checker
