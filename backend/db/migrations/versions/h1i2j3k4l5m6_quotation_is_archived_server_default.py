"""Restore server default on quotations.is_archived."""

from alembic import op
import sqlalchemy as sa

revision = "h1i2j3k4l5m6"
down_revision = "g0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "quotations",
        "is_archived",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.false(),
    )


def downgrade() -> None:
    op.alter_column(
        "quotations",
        "is_archived",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=None,
    )
