"""Superadmin: connected IMAP mailboxes. Admin/member: list assigned mailboxes."""

from __future__ import annotations

import uuid

import imaplib
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_middleware import CurrentUser, get_current_user
from core.database import get_db
from db.models import UserTier
from services.mailbox_service import (
    create_mailbox,
    delete_mailbox_soft,
    get_mailbox,
    list_mailboxes_public,
    list_viewable_mailbox_ids,
    mailbox_to_dict,
    update_mailbox_credentials,
)

router = APIRouter(prefix="/api/mailboxes", tags=["mailboxes"])


def _require_superadmin(user: CurrentUser) -> None:
    if user.tier != UserTier.SUPERADMIN.value:
        raise HTTPException(status_code=403, detail="Superadmin only")


class MailboxCreateBody(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=255)
    email_address: str
    imap_host: str = "imap.gmail.com"
    imap_port: int = 993
    imap_folder: str = "INBOX"
    # Default to ALL so already-read RFQs still sync.
    unread_only: bool = False
    app_password: str = Field(..., min_length=1)


class MailboxUpdateBody(BaseModel):
    display_name: str | None = None
    imap_host: str | None = None
    imap_port: int | None = None
    imap_folder: str | None = None
    unread_only: bool | None = None
    is_active: bool | None = None
    app_password: str | None = None


@router.get("")
async def list_mailboxes_route(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    if user.tier in (UserTier.SUPERADMIN.value, UserTier.ADMIN.value):
        boxes = await list_mailboxes_public(db, include_inactive=user.tier == UserTier.SUPERADMIN.value)
    else:
        ids = await list_viewable_mailbox_ids(user, db)
        boxes = []
        for mid in ids:
            mb = await get_mailbox(db, mid)
            if mb and mb.is_active:
                boxes.append(mb)
    return [mailbox_to_dict(b) for b in boxes]


@router.post("")
async def create_mailbox_route(
    body: MailboxCreateBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_superadmin(user)
    try:
        mb = await create_mailbox(
            db,
            display_name=body.display_name,
            email_address=body.email_address,
            imap_host=body.imap_host,
            imap_port=body.imap_port,
            imap_folder=body.imap_folder,
            unread_only=body.unread_only,
            app_password=body.app_password,
            created_by=uuid.UUID(user.id),
        )
        return mailbox_to_dict(mb)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.patch("/{mailbox_id}")
async def update_mailbox_route(
    mailbox_id: str,
    body: MailboxUpdateBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_superadmin(user)
    try:
        mb = await update_mailbox_credentials(
            db,
            uuid.UUID(mailbox_id),
            display_name=body.display_name,
            imap_host=body.imap_host,
            imap_port=body.imap_port,
            imap_folder=body.imap_folder,
            unread_only=body.unread_only,
            is_active=body.is_active,
            app_password=body.app_password,
        )
        return mailbox_to_dict(mb)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{mailbox_id}/deactivate", status_code=204)
async def deactivate_mailbox_route(
    mailbox_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _require_superadmin(user)
    try:
        await delete_mailbox_soft(db, uuid.UUID(mailbox_id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return Response(status_code=204)


@router.post("/{mailbox_id}/test-connection")
async def test_mailbox_connection_route(
    mailbox_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_superadmin(user)
    from services.mailbox_crypto import decrypt_secret

    mb = await get_mailbox(db, uuid.UUID(mailbox_id))
    if not mb or not mb.credential_encrypted:
        raise HTTPException(status_code=400, detail="Mailbox or credentials missing")
    try:
        password = decrypt_secret(mb.credential_encrypted)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Decrypt failed: {e}") from e
    try:
        mail = imaplib.IMAP4_SSL(mb.imap_host, mb.imap_port)
        mail.login(mb.email_address, password)
        mail.select(mb.imap_folder)
        mail.logout()
    except imaplib.IMAP4.error as e:
        raise HTTPException(status_code=400, detail=f"IMAP login failed: {e}") from e
    return {"ok": True, "message": "IMAP connection successful"}
