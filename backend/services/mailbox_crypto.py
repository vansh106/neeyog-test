"""Encrypt / decrypt mailbox IMAP app passwords at rest."""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet

from core.config import get_settings


def _fernet() -> Fernet:
    settings = get_settings()
    raw_key = (settings.mailbox_credentials_fernet_key or "").strip()
    if raw_key:
        return Fernet(raw_key.encode("utf-8"))
    digest = hashlib.sha256(b"cpq-mailbox-fernet\x00" + settings.jwt_secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
