"""Add validity_date and next_follow_up_date on quotations for CRM listing."""

from alembic import op
import sqlalchemy as sa

revision = "e8f9a0b1c2d3"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quotations", sa.Column("validity_date", sa.Date(), nullable=True))
    op.add_column("quotations", sa.Column("next_follow_up_date", sa.Date(), nullable=True))
    op.execute(
        sa.text(
            "UPDATE quotations SET validity_date = (created_at AT TIME ZONE 'UTC')::date + validity_days "
            "WHERE validity_date IS NULL AND created_at IS NOT NULL"
        )
    )


def downgrade() -> None:
    op.drop_column("quotations", "next_follow_up_date")
    op.drop_column("quotations", "validity_date")
