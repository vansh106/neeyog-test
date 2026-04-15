"""add processed_emails table

Revision ID: a1b2c3d4e5f6
Revises: f633f47f4757
Create Date: 2026-04-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f633f47f4757"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "processed_emails",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("message_id", sa.String(), nullable=False),
        sa.Column("sender_email", sa.String(), nullable=False),
        sa.Column("sender_name", sa.String(), nullable=True),
        sa.Column("subject", sa.String(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("enquiry_id", sa.UUID(), nullable=True),
        sa.Column("was_processed", sa.Boolean(), nullable=False),
        sa.Column("filter_reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["enquiry_id"], ["enquiries.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_processed_emails_message_id"), "processed_emails", ["message_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_processed_emails_message_id"), table_name="processed_emails")
    op.drop_table("processed_emails")
