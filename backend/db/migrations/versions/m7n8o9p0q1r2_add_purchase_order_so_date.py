"""Add so_date to purchase_orders."""

from alembic import op
import sqlalchemy as sa

revision = "p1q2r3s4t5u6"
down_revision = "l6m7n8o9p0q1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("purchase_orders", sa.Column("so_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("purchase_orders", "so_date")
