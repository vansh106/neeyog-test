from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config.permissions import SUPERADMIN_PERMISSIONS
from core.config import get_settings
from core.exceptions import AuthenticationError, AuthorizationError, UserNotFoundError
from db.models import RefreshToken, User, UserPermission

logger = logging.getLogger(__name__)
settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def is_strong_password(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Minimum 8 characters"
    if not any(c.isupper() for c in password):
        return False, "Must contain uppercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Must contain a number"
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        return False, "Must contain special character"
    return True, ""


def create_access_token(
    user_id: str,
    email: str,
    full_name: str,
    tier: str,
    job_title: str | None,
    permissions: list[str],
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "full_name": full_name,
        "tier": tier,
        "job_title": job_title,
        "permissions": permissions,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(64)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise AuthenticationError("Invalid token type")
        return payload
    except JWTError as e:
        raise AuthenticationError(f"Invalid token: {str(e)}")


def _norm_email(value: str) -> str:
    return value.strip().lower()


async def authenticate_user(email: str, password: str, db: AsyncSession) -> User:
    em = _norm_email(email)
    pwd = password.strip()
    result = await db.execute(select(User).where(func.lower(func.trim(User.email)) == em))
    user = result.scalar_one_or_none()

    if not user:
        raise AuthenticationError("Invalid email or password")
    try:
        pw_ok = verify_password(pwd, user.hashed_password)
    except ValueError:
        pw_ok = False
    if not pw_ok:
        raise AuthenticationError("Invalid email or password")

    if not user.is_active:
        raise AuthenticationError("Account is deactivated. Contact your administrator.")

    return user


async def get_user_permissions(user: User, db: AsyncSession) -> list[str]:
    if user.tier == "superadmin":
        return SUPERADMIN_PERMISSIONS
    result = await db.execute(
        select(UserPermission.permission).where(UserPermission.user_id == user.id)
    )
    return [row[0] for row in result.all()]


async def login(
    email: str,
    password: str,
    device_info: str | None,
    db: AsyncSession,
) -> dict:
    user = await authenticate_user(email, password, db)
    permissions = await get_user_permissions(user, db)

    access_token = create_access_token(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        tier=user.tier,
        job_title=user.job_title,
        permissions=permissions,
    )

    raw_refresh, hashed_refresh = create_refresh_token()
    refresh = RefreshToken(
        user_id=user.id,
        token_hash=hashed_refresh,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        device_info=device_info,
    )
    db.add(refresh)

    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = None
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "is_first_login": bool(user.is_first_login),
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "tier": user.tier,
            "job_title": user.job_title,
            "permissions": permissions,
        },
    }


async def refresh_access_token(raw_refresh_token: str, db: AsyncSession) -> dict:
    hashed = hashlib.sha256(raw_refresh_token.encode()).hexdigest()
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == hashed,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    stored = result.scalar_one_or_none()
    if not stored:
        raise AuthenticationError("Invalid or expired refresh token")

    stored.revoked_at = datetime.now(timezone.utc)

    user_result = await db.execute(
        select(User).where(User.id == stored.user_id, User.is_active == True)  # noqa: E712
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise AuthenticationError("User not found")

    permissions = await get_user_permissions(user, db)
    access_token = create_access_token(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        tier=user.tier,
        job_title=user.job_title,
        permissions=permissions,
    )

    new_raw, new_hashed = create_refresh_token()
    new_refresh = RefreshToken(
        user_id=user.id,
        token_hash=new_hashed,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        device_info=stored.device_info,
    )
    db.add(new_refresh)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": new_raw,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
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
) -> None:
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFoundError("User not found")

    if not verify_password(old_password, user.hashed_password):
        raise AuthenticationError("Current password is incorrect")

    ok, msg = is_strong_password(new_password)
    if not ok:
        raise ValueError(f"Weak password: {msg}")

    user.hashed_password = hash_password(new_password)
    user.is_first_login = False
    await db.commit()


async def ensure_superadmin_seeded(db: AsyncSession) -> bool:
    """Ensure `SUPERADMIN_EMAIL` can sign in with `SUPERADMIN_PASSWORD` from env.

    Creates the row if missing. If the row exists (e.g. after a DB migration that left a
    bad/empty hash), repairs tier + password hash when the env password does not verify.
    Returns True only when a brand-new row was inserted.
    """
    email = _norm_email(settings.SUPERADMIN_EMAIL)
    plain = settings.SUPERADMIN_PASSWORD.strip()

    result = await db.execute(select(User).where(func.lower(func.trim(User.email)) == email))
    user = result.scalar_one_or_none()

    if user:
        changed = False
        if user.email.strip().lower() != email:
            user.email = email
            changed = True
        if user.tier != "superadmin":
            user.tier = "superadmin"
            changed = True
        if not user.is_active:
            user.is_active = True
            changed = True
        # Always re-hash from env when configured (Docker / broken migration recovery).
        if settings.SUPERADMIN_SYNC_PASSWORD_ON_STARTUP:
            user.hashed_password = hash_password(plain)
            user.is_first_login = False
            changed = True
            logger.info("Superadmin password synced from env for %s (SUPERADMIN_SYNC_PASSWORD_ON_STARTUP)", email)
        else:
            try:
                pw_ok = bool(user.hashed_password) and verify_password(plain, user.hashed_password)
            except ValueError:
                pw_ok = False
            if not pw_ok:
                user.hashed_password = hash_password(plain)
                user.is_first_login = False
                changed = True
                logger.info("Superadmin password hash repaired from env for %s", email)
        if user.full_name != settings.SUPERADMIN_NAME:
            user.full_name = settings.SUPERADMIN_NAME
            changed = True
        if changed:
            await db.commit()
        return False

    superadmin = User(
        email=email,
        full_name=settings.SUPERADMIN_NAME,
        hashed_password=hash_password(plain),
        tier="superadmin",
        job_title="Super Administrator",
        is_active=True,
        is_first_login=False,
    )
    db.add(superadmin)
    await db.commit()
    return True

