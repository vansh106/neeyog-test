"""Mailboxes (multi IMAP), per-user access, per-mailbox sync baseline."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b2c3d4e5f6a7"
down_revision = "a7f8e9d0c1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mailboxes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("email_address", sa.String(length=255), nullable=False),
        sa.Column("imap_host", sa.String(length=255), nullable=False, server_default="imap.gmail.com"),
        sa.Column("imap_port", sa.Integer(), nullable=False, server_default="993"),
        sa.Column("imap_folder", sa.String(length=255), nullable=False, server_default="INBOX"),
        sa.Column("unread_only", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("credential_encrypted", sa.Text(), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_mailboxes_email_address", "mailboxes", ["email_address"], unique=True)
    op.create_index("ix_mailboxes_is_active", "mailboxes", ["is_active"])

    op.create_table(
        "mailbox_sync_state",
        sa.Column(
            "mailbox_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("mailboxes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("baseline_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "user_mailbox_access",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mailbox_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mailboxes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("can_view", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("can_process", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("can_trigger_sync", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "mailbox_id", name="uq_user_mailbox_access"),
    )
    op.create_index("ix_user_mailbox_access_user_id", "user_mailbox_access", ["user_id"])
    op.create_index("ix_user_mailbox_access_mailbox_id", "user_mailbox_access", ["mailbox_id"])

    op.add_column(
        "enquiries",
        sa.Column("mailbox_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mailboxes.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_enquiries_mailbox_id", "enquiries", ["mailbox_id"])

    op.add_column(
        "processed_emails",
        sa.Column("mailbox_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mailboxes.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_processed_emails_mailbox_id", "processed_emails", ["mailbox_id"])

    op.drop_index(op.f("ix_processed_emails_message_id"), table_name="processed_emails")
    op.create_index("ix_processed_emails_message_id", "processed_emails", ["message_id"], unique=False)

    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX uq_processed_mailbox_message
            ON processed_emails (mailbox_id, message_id)
            WHERE mailbox_id IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX uq_processed_message_legacy
            ON processed_emails (message_id)
            WHERE mailbox_id IS NULL
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS uq_processed_message_legacy"))
    op.execute(sa.text("DROP INDEX IF EXISTS uq_processed_mailbox_message"))
    op.drop_index("ix_processed_emails_message_id", table_name="processed_emails")
    op.create_index(op.f("ix_processed_emails_message_id"), "processed_emails", ["message_id"], unique=True)

    op.drop_index("ix_processed_emails_mailbox_id", table_name="processed_emails")
    op.drop_column("processed_emails", "mailbox_id")

    op.drop_index("ix_enquiries_mailbox_id", table_name="enquiries")
    op.drop_column("enquiries", "mailbox_id")

    op.drop_index("ix_user_mailbox_access_mailbox_id", table_name="user_mailbox_access")
    op.drop_index("ix_user_mailbox_access_user_id", table_name="user_mailbox_access")
    op.drop_table("user_mailbox_access")

    op.drop_table("mailbox_sync_state")

    op.drop_index("ix_mailboxes_is_active", table_name="mailboxes")
    op.drop_index("ix_mailboxes_email_address", table_name="mailboxes")
    op.drop_table("mailboxes")
