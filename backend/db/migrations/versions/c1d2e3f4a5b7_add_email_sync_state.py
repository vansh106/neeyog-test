"""add email_sync_state singleton for sync baseline

Revision ID: c1d2e3f4a5b7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision: str = "c1d2e3f4a5b7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Table may already exist: FastAPI init_db() runs Base.metadata.create_all().
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "email_sync_state" not in insp.get_table_names():
        op.create_table(
            "email_sync_state",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("baseline_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
    op.execute(
        text(
            "INSERT INTO email_sync_state (id, baseline_at) VALUES (1, NULL) "
            "ON CONFLICT (id) DO NOTHING"
        )
    )


def downgrade() -> None:
    op.drop_table("email_sync_state")
