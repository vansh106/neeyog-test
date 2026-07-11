"""Add is_archived to quotations."""

from alembic import op
import sqlalchemy as sa

revision = "z1a2b3c4d5e6"
down_revision = "y0z1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quotations",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_quotations_is_archived", "quotations", ["is_archived"])
    op.alter_column("quotations", "is_archived", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_quotations_is_archived", table_name="quotations")
    op.drop_column("quotations", "is_archived")
