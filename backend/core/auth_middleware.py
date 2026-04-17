from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config.permissions import Permission
from services.auth_service import decode_access_token

security = HTTPBearer()


class CurrentUser:
    def __init__(self, payload: dict):
        self.id: str = payload["sub"]
        self.email: str = payload["email"]
        self.full_name: str = payload["full_name"]
        self.tier: str = payload["tier"]
        self.job_title: str | None = payload.get("job_title")
        self.permissions: list[str] = payload.get("permissions", [])

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
        return self.tier in ["admin", "superadmin"]


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    try:
        payload = decode_access_token(credentials.credentials)
        return CurrentUser(payload)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_permission(*permissions: Permission):
    async def checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        for perm in permissions:
            if not current_user.has_permission(perm):
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "insufficient_permissions",
                        "required": perm.value,
                        "message": "You don't have permission to perform this action.",
                    },
                )
        return current_user

    return checker


def require_admin():
    async def checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not current_user.is_admin_or_above:
            raise HTTPException(status_code=403, detail="Admin access required")
        return current_user

    return checker

