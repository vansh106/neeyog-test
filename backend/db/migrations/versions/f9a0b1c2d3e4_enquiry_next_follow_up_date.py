"""Add next_follow_up_date on enquiries for CRM listing."""

from alembic import op
import sqlalchemy as sa

revision = "f9a0b1c2d3e4"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("enquiries", sa.Column("next_follow_up_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("enquiries", "next_follow_up_date")
