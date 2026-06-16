"""JWT auth, password hashing, login / refresh / logout."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import SUPERADMIN_PERMISSIONS
from core.config import get_settings
from core.exceptions import AuthenticationError, UserNotFoundError
from db.models import RefreshToken, User, UserPermission, UserTier

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) != 10:
        raise ValueError("Enter a valid 10-digit mobile number")
    return digits


def is_strong_password(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Minimum 8 characters"
    if not any(c.isupper() for c in password):
        return False, "Must contain uppercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Must contain a number"
    specials = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    if not any(c in specials for c in password):
        return False, "Must contain special character"
    return True, ""


def create_access_token(
    *,
    user_id: str,
    email: str,
    full_name: str,
    tier: str,
    permissions: list[str],
    job_title: str | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "email": email,
        "full_name": full_name,
        "tier": tier,
        "permissions": permissions,
        "job_title": job_title,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(64)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        # Reject explicit non-access tokens; allow missing `type` for legacy JWTs.
        t = payload.get("type")
        if t is not None and t != "access":
            raise AuthenticationError("Invalid token type")
        return payload
    except JWTError as e:
        raise AuthenticationError(f"Invalid token: {e!s}") from e


async def authenticate_user(email: str, password: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == email.lower().strip()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise AuthenticationError("Invalid email or password")
    if not user.is_active:
        raise AuthenticationError("Account is deactivated. Contact your administrator.")
    return user


async def get_user_permissions(user: User, db: AsyncSession) -> list[str]:
    if user.tier == UserTier.SUPERADMIN.value:
        return list(SUPERADMIN_PERMISSIONS)
    result = await db.execute(select(UserPermission.permission).where(UserPermission.user_id == user.id))
    return [row[0] for row in result.all()]


async def login(
    email: str,
    password: str,
    *,
    device_info: str | None,
    client_ip: str | None,
    db: AsyncSession,
) -> dict:
    user = await authenticate_user(email, password, db)
    permissions = await get_user_permissions(user, db)

    access_token = create_access_token(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        tier=user.tier,
        permissions=permissions,
        job_title=user.job_title,
    )
    raw_refresh, hashed_refresh = create_refresh_token()
    refresh = RefreshToken(
        user_id=user.id,
        token_hash=hashed_refresh,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
        device_info=device_info,
    )
    db.add(refresh)
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = client_ip
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
        "is_first_login": user.is_first_login,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "tier": user.tier,
            "job_title": user.job_title,
            "phone": (user.phone or "").strip() or None,
            "permissions": permissions,
        },
    }


async def refresh_access_token(raw_refresh_token: str, db: AsyncSession) -> dict:
    hashed = hashlib.sha256(raw_refresh_token.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == hashed,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
    )
    stored = result.scalar_one_or_none()
    if not stored:
        raise AuthenticationError("Invalid or expired refresh token")

    stored.revoked_at = now

    user_result = await db.execute(select(User).where(User.id == stored.user_id, User.is_active.is_(True)))
    user = user_result.scalar_one_or_none()
    if not user:
        raise AuthenticationError("User not found")

    permissions = await get_user_permissions(user, db)
    access_token = create_access_token(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        tier=user.tier,
        permissions=permissions,
        job_title=user.job_title,
    )
    new_raw, new_hashed = create_refresh_token()
    new_refresh = RefreshToken(
        user_id=user.id,
        token_hash=new_hashed,
        expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        device_info=stored.device_info,
    )
    db.add(new_refresh)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": new_raw,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
    }


async def logout(raw_refresh_token: str, db: AsyncSession) -> None:
    hashed = hashlib.sha256(raw_refresh_token.encode()).hexdigest()
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hashed))
    token = result.scalar_one_or_none()
    if token:
        token.revoked_at = datetime.now(timezone.utc)
        await db.commit()


async def change_password(
    user_id: str,
    old_password: str,
    new_password: str,
    db: AsyncSession,
    *,
    phone: str | None = None,
) -> None:
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFoundError("User not found")
    if not user.is_first_login:
        if not verify_password(old_password, user.hashed_password):
            raise AuthenticationError("Current password is incorrect")
    ok, msg = is_strong_password(new_password)
    if not ok:
        raise ValueError(f"Weak password: {msg}")

    needs_phone = bool(user.is_first_login) or not (user.phone or "").strip()
    if phone is not None and str(phone).strip():
        user.phone = normalize_phone(phone)
    elif needs_phone:
        raise ValueError("Phone number is required")

    user.hashed_password = hash_password(new_password)
    user.is_first_login = False
    await db.commit()
