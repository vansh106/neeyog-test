"""Add is_archived to enquiries."""

from alembic import op
import sqlalchemy as sa

revision = "i2j3k4l5m6n7"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "enquiries",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_enquiries_is_archived", "enquiries", ["is_archived"])
    op.alter_column("enquiries", "is_archived", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_enquiries_is_archived", table_name="enquiries")
    op.drop_column("enquiries", "is_archived")
