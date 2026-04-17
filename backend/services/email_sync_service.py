"""Gmail IMAP polling — qualifies enquiry emails and runs the agent pipeline."""

from __future__ import annotations

import asyncio
import email as email_lib
import email.header
import email.utils
import imaplib
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from core.database import async_session_factory
from db.models import EmailSyncState, ProcessedEmail
from services.enquiry_service import create_enquiry

logger = logging.getLogger(__name__)
settings = get_settings()


class EmailSyncService:
    """Polls Gmail via IMAP and triggers the agent pipeline for qualifying enquiry emails."""

    def __init__(self) -> None:
        self.host = settings.email_imap_host
        self.port = settings.email_imap_port
        self.email = settings.email_address
        self.password = settings.email_app_password
        self.keywords = settings.enquiry_keywords_list

    def _connect(self) -> imaplib.IMAP4_SSL:
        mail = imaplib.IMAP4_SSL(self.host, self.port)
        mail.login(self.email, self.password)
        return mail

    def _decode_header(self, value: str) -> str:
        decoded_parts = email.header.decode_header(value)
        parts: list[str] = []
        for part, charset in decoded_parts:
            if isinstance(part, bytes):
                parts.append(part.decode(charset or "utf-8", errors="replace"))
            else:
                parts.append(str(part))
        return " ".join(parts)

    def _extract_body(self, msg: email_lib.message.Message) -> str:
        body = ""

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                disposition = str(part.get("Content-Disposition", ""))

                if "attachment" in disposition:
                    continue

                if content_type == "text/plain":
                    charset = part.get_content_charset() or "utf-8"
                    raw = part.get_payload(decode=True)
                    if raw is not None:
                        body = raw.decode(charset, errors="replace")
                    break
        else:
            charset = msg.get_content_charset() or "utf-8"
            raw = msg.get_payload(decode=True)
            if raw is not None:
                body = raw.decode(charset, errors="replace")

        return body.strip()

    def _message_received_at(self, msg: email_lib.message.Message) -> datetime:
        ds = msg.get("Date")
        if not ds:
            return datetime.now(timezone.utc)
        try:
            dt = email.utils.parsedate_to_datetime(ds)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except (TypeError, ValueError):
            return datetime.now(timezone.utc)

    def _build_email_text(
        self,
        sender_name: str,
        sender_email: str,
        subject: str,
        body: str,
        date_str: str,
    ) -> str:
        return (
            f"From: {sender_name} <{sender_email}>\n"
            f"Date: {date_str}\n"
            f"Subject: {subject}\n\n"
            f"{body}"
        )

    def _is_enquiry_email(
        self,
        subject: str,
        body: str,
        sender_email: str,
    ) -> tuple[bool, str]:
        if not sender_email or "@" not in sender_email:
            return False, "auto_sender"

        own_domain = self.email.split("@")[-1]
        sender_lower = (sender_email or "").lower()

        # Allow forwarded RFQs sent from our own mailbox/domain by extracting the original external sender.
        if sender_lower.endswith(f"@{own_domain}"):
            fwd_sender = self._extract_forwarded_sender_email(subject, body)
            if fwd_sender and not fwd_sender.lower().endswith(f"@{own_domain}"):
                sender_lower = fwd_sender.lower()
            else:
                return False, "internal_sender"

        skip_senders = [
            "noreply",
            "no-reply",
            "donotreply",
            "mailer-daemon",
            "postmaster",
            "notifications",
            "support@",
            "buyershelpdesk@indiamart.com",
        ]
        if any(s in sender_lower for s in skip_senders):
            if "indiamart" not in sender_lower:
                return False, "auto_sender"

        combined = (subject + " " + body).lower()
        matched_keywords = [kw for kw in self.keywords if kw in combined]

        if not matched_keywords:
            return False, "no_keywords"

        return True, ""

    def _extract_forwarded_sender_email(self, subject: str, body: str) -> str | None:
        """Best-effort extraction of original sender email from forwarded threads."""
        txt = f"{subject}\n{body}"
        # Gmail thread quote format: "On ... Name <email@domain> wrote:"
        m = re.search(
            r"\bOn\s.+?<([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})>\s+wrote:",
            txt,
            re.IGNORECASE | re.DOTALL,
        )
        if m:
            return m.group(1).strip()
        # Forwarded header blocks: "From: Name <email@domain>"
        m = re.search(
            r"^\s*From:\s.*?<([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})>\s*$",
            txt,
            re.IGNORECASE | re.MULTILINE,
        )
        if m:
            return m.group(1).strip()
        m = re.search(
            r"^\s*From:.*?([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}).*$",
            txt,
            re.IGNORECASE | re.MULTILINE,
        )
        if m:
            return m.group(1).strip()
        return None

    async def _get_or_create_sync_state(self, db: AsyncSession) -> EmailSyncState:
        result = await db.execute(select(EmailSyncState).where(EmailSyncState.id == 1))
        row = result.scalar_one_or_none()
        if row is None:
            row = EmailSyncState(id=1, baseline_at=None)
            db.add(row)
            await db.flush()
        return row

    async def _is_already_processed(self, message_id: str, db: AsyncSession) -> bool:
        result = await db.execute(select(ProcessedEmail).where(ProcessedEmail.message_id == message_id))
        return result.scalar_one_or_none() is not None

    async def _record_processed(
        self,
        *,
        message_id: str,
        sender_email: str,
        sender_name: str | None,
        subject: str | None,
        received_at: datetime,
        db: AsyncSession,
        enquiry_id: uuid.UUID | None = None,
        filter_reason: str | None = None,
    ) -> None:
        record = ProcessedEmail(
            message_id=message_id,
            sender_email=sender_email,
            sender_name=sender_name,
            subject=subject,
            received_at=received_at,
            enquiry_id=enquiry_id,
            was_processed=enquiry_id is not None,
            filter_reason=filter_reason,
        )
        db.add(record)
        await db.commit()

    def _parse_fetched_message(
        self, msg_id_bytes: bytes, raw_email: bytes
    ) -> dict[str, Any] | None:
        try:
            msg = email_lib.message_from_bytes(raw_email)
            message_id = msg.get("Message-ID", f"unknown-{msg_id_bytes.decode()}").strip()
            from_header = msg.get("From", "")
            sender_name, sender_email_addr = email.utils.parseaddr(from_header)
            if sender_name:
                sender_name = self._decode_header(sender_name)
            else:
                sender_name = sender_email_addr or ""
            subject = self._decode_header(msg.get("Subject", "(No Subject)"))
            date_str = msg.get("Date", "")
            body = self._extract_body(msg)
            received_at = self._message_received_at(msg)
            return {
                "message_id": message_id,
                "sender_name": sender_name,
                "sender_email_addr": sender_email_addr,
                "subject": subject,
                "date_str": date_str,
                "body": body,
                "received_at": received_at,
            }
        except Exception:
            logger.exception("Failed to parse message %s", msg_id_bytes)
            return None

    async def _establish_baseline(
        self, mail: imaplib.IMAP4_SSL, summary: dict
    ) -> None:
        """First activation: skip all current UNSEEN without parsing; mark read; set baseline."""
        search_criteria = "UNSEEN" if settings.email_filter_unread_only else "ALL"
        _, message_ids = mail.search(None, search_criteria)
        id_list = message_ids[0].split()
        skipped = 0

        for msg_id_bytes in id_list:
            async with async_session_factory() as db:
                try:
                    _, msg_data = mail.fetch(msg_id_bytes, "(RFC822)")
                    if not msg_data or not msg_data[0] or len(msg_data[0]) < 2:
                        continue
                    raw_email = msg_data[0][1]
                    parsed = self._parse_fetched_message(msg_id_bytes, raw_email)
                    if not parsed:
                        continue

                    if await self._is_already_processed(parsed["message_id"], db):
                        try:
                            mail.store(msg_id_bytes, "+FLAGS", "\\Seen")
                        except Exception:
                            logger.debug("Could not mark seen for %s", msg_id_bytes, exc_info=True)
                        continue

                    await self._record_processed(
                        message_id=parsed["message_id"],
                        sender_email=parsed["sender_email_addr"] or "",
                        sender_name=parsed["sender_name"],
                        subject=parsed["subject"],
                        received_at=parsed["received_at"],
                        filter_reason="before_baseline",
                        db=db,
                    )
                    try:
                        mail.store(msg_id_bytes, "+FLAGS", "\\Seen")
                    except Exception:
                        logger.warning("Could not mark seen after before_baseline %s", msg_id_bytes)
                    skipped += 1
                except IntegrityError:
                    await db.rollback()
                    try:
                        mail.store(msg_id_bytes, "+FLAGS", "\\Seen")
                    except Exception:
                        pass
                except Exception as e:
                    await db.rollback()
                    logger.error("Baseline skip failed for %s: %s", msg_id_bytes, e, exc_info=True)

        async with async_session_factory() as db:
            st = await self._get_or_create_sync_state(db)
            st.baseline_at = datetime.now(timezone.utc)
            await db.commit()

        summary["emails_checked"] = len(id_list)
        summary["filtered_out"] += skipped
        summary["baseline_established"] = True
        summary["details"].append(
            f"Sync baseline established — skipped {skipped} older unread message(s) without parsing."
        )
        logger.info("Email sync baseline established (%s backlog messages skipped)", skipped)

    async def _process_single_unseen(
        self,
        mail: imaplib.IMAP4_SSL,
        msg_id_bytes: bytes,
        baseline_at: datetime,
        summary: dict,
    ) -> None:
        """One IMAP message = one fresh DB session so failures never poison the next message."""
        async with async_session_factory() as db:
            try:
                _, msg_data = mail.fetch(msg_id_bytes, "(RFC822)")
                if not msg_data or not msg_data[0] or len(msg_data[0]) < 2:
                    return
                raw_email = msg_data[0][1]
                parsed = self._parse_fetched_message(msg_id_bytes, raw_email)
                if not parsed:
                    return

                message_id = parsed["message_id"]
                sender_email_addr = parsed["sender_email_addr"]
                sender_name = parsed["sender_name"]
                subject = parsed["subject"]
                date_str = parsed["date_str"]
                body = parsed["body"]
                received_at = parsed["received_at"]

                if await self._is_already_processed(message_id, db):
                    logger.debug("Already processed: %s", message_id)
                    try:
                        mail.store(msg_id_bytes, "+FLAGS", "\\Seen")
                    except Exception:
                        pass
                    return

                # If this is a forwarded thread from our own mailbox, use the original external sender in the saved raw email.
                effective_sender_email = sender_email_addr
                if sender_email_addr and sender_email_addr.lower().endswith(f"@{self.email.split('@')[-1]}"):
                    fwd_sender = self._extract_forwarded_sender_email(subject, body)
                    if fwd_sender:
                        effective_sender_email = fwd_sender

                if received_at < baseline_at:
                    logger.info("Skipping message before baseline: %s", subject)
                    await self._record_processed(
                        message_id=message_id,
                        sender_email=sender_email_addr or "",
                        sender_name=sender_name,
                        subject=subject,
                        received_at=received_at,
                        filter_reason="before_baseline",
                        db=db,
                    )
                    try:
                        mail.store(msg_id_bytes, "+FLAGS", "\\Seen")
                    except Exception:
                        pass
                    summary["filtered_out"] += 1
                    return

                is_enquiry, reason = self._is_enquiry_email(subject, body, sender_email_addr)

                if not is_enquiry:
                    logger.info("Filtered out: %s — reason: %s", subject, reason)
                    await self._record_processed(
                        message_id=message_id,
                        sender_email=sender_email_addr or "",
                        sender_name=sender_name,
                        subject=subject,
                        received_at=received_at,
                        filter_reason=reason,
                        db=db,
                    )
                    summary["filtered_out"] += 1
                    return

                email_text = self._build_email_text(
                    sender_name,
                    effective_sender_email or (sender_email_addr or ""),
                    subject,
                    body,
                    date_str,
                )

                enquiry = await create_enquiry(
                    email_text=email_text,
                    input_type="email_sync",
                    db=db,
                )

                # Broadcast to all connected frontends (Emails tab).
                try:
                    from services.global_event_bus import broadcast_new_email

                    await broadcast_new_email(
                        enquiry_id=str(enquiry.id),
                        sender_name=sender_name or "",
                        sender_email=sender_email_addr or "",
                        subject=subject or "",
                        raw_email=email_text,
                        input_type="email_sync",
                    )
                except Exception:
                    pass

                await self._record_processed(
                    message_id=message_id,
                    sender_email=sender_email_addr or "",
                    sender_name=sender_name,
                    subject=subject,
                    received_at=received_at,
                    enquiry_id=enquiry.id,
                    db=db,
                )

                try:
                    mail.store(msg_id_bytes, "+FLAGS", "\\Seen")
                except Exception:
                    logger.warning("Could not mark seen for enquiry email %s", msg_id_bytes)

                asyncio.create_task(
                    _run_pipeline_background(
                        enquiry_id=str(enquiry.id),
                        email_text=email_text,
                    )
                )

                summary["enquiries_created"] += 1
                summary["details"].append(f"Created enquiry for: {sender_name} — {subject}")
                logger.info("Enquiry created: %s from %s", enquiry.id, sender_email_addr)

            except IntegrityError:
                await db.rollback()
                logger.warning("IntegrityError (likely duplicate message_id) for %s", msg_id_bytes)
            except Exception as e:
                await db.rollback()
                summary["errors"] += 1
                logger.error("Error processing email %s: %s", msg_id_bytes, e, exc_info=True)

    async def sync_once(self) -> dict:
        summary: dict = {
            "emails_checked": 0,
            "enquiries_created": 0,
            "filtered_out": 0,
            "errors": 0,
            "details": [],
            "baseline_established": False,
        }

        if not settings.email_sync_enabled:
            logger.info("Email sync disabled — skipping")
            return summary

        if not self.email or not self.password:
            logger.warning("EMAIL_ADDRESS or EMAIL_APP_PASSWORD not configured — skipping sync")
            return summary

        mail: imaplib.IMAP4_SSL | None = None
        try:
            logger.info("Email sync starting for %s", self.email)
            mail = self._connect()
            mail.select(settings.email_sync_label)

            async with async_session_factory() as db:
                st = await self._get_or_create_sync_state(db)
                baseline_at = st.baseline_at
                await db.commit()

            if baseline_at is None:
                await self._establish_baseline(mail, summary)
                return summary

            search_criteria = "UNSEEN" if settings.email_filter_unread_only else "ALL"
            _, message_ids = mail.search(None, search_criteria)
            id_list = message_ids[0].split()

            logger.info("Found %d email(s) matching %s", len(id_list), search_criteria)
            summary["emails_checked"] = len(id_list)

            for msg_id_bytes in id_list:
                await self._process_single_unseen(mail, msg_id_bytes, baseline_at, summary)

        except imaplib.IMAP4.error as e:
            logger.error("IMAP connection error: %s", e)
            summary["errors"] += 1

        except Exception as e:
            logger.error("Email sync error: %s", e, exc_info=True)
            summary["errors"] += 1

        finally:
            if mail:
                try:
                    mail.logout()
                except Exception:
                    pass

        logger.info(
            "Sync complete: %s created, %s filtered, %s errors",
            summary["enquiries_created"],
            summary["filtered_out"],
            summary["errors"],
        )
        return summary


async def _run_pipeline_background(enquiry_id: str, email_text: str) -> None:
    """Run agent pipeline for a synced email; no SSE. Uses a fresh DB session for audit."""
    from db.models import AuditLog
    from orchestrator.graph import run_enquiry_flow

    settings = get_settings()
    try:
        final_state = await asyncio.wait_for(
            run_enquiry_flow(
                enquiry_id=enquiry_id,
                raw_input=email_text,
                input_type="email_sync",
                client_config="parth_valves",
                emitter=None,
            ),
            timeout=settings.ENQUIRY_FLOW_TIMEOUT_SECONDS,
        )

        current_step = final_state.get("current_step", "unknown")

        async with async_session_factory() as session:
            audit = AuditLog(
                id=uuid.uuid4(),
                entity_type="enquiry",
                entity_id=uuid.UUID(enquiry_id),
                action="ai_processed",
                performed_by="system",
                details={
                    "flow_type": final_state.get("flow_type"),
                    "current_step": current_step,
                    "has_quotation": final_state.get("quotation_data") is not None,
                    "source": "email_sync",
                },
            )
            session.add(audit)
            await session.commit()

        logger.info(
            "Pipeline complete for %s: flow=%s step=%s",
            enquiry_id,
            final_state.get("flow_type"),
            current_step,
        )

        try:
            from services.global_event_bus import broadcast_enquiry_status_change

            await broadcast_enquiry_status_change(
                enquiry_id=enquiry_id,
                new_status=current_step,
                flow_type=final_state.get("flow_type"),
                client_name=(final_state.get("parsed_data") or {}).get("client_name"),
                message="Background processing complete",
            )
        except Exception:
            pass
    except TimeoutError:
        logger.error(
            "Pipeline timed out for %s after %ss",
            enquiry_id,
            settings.ENQUIRY_FLOW_TIMEOUT_SECONDS,
        )
    except Exception as e:
        logger.error("Pipeline failed for %s: %s", enquiry_id, e, exc_info=True)


email_sync_service = EmailSyncService()
