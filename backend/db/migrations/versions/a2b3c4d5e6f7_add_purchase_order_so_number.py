"""Add so_number to purchase_orders."""

from alembic import op
import sqlalchemy as sa

revision = "a2b3c4d5e6f7"
down_revision = "z1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("purchase_orders", sa.Column("so_number", sa.String(50), nullable=True))
    op.create_index("ix_purchase_orders_so_number", "purchase_orders", ["so_number"])


def downgrade() -> None:
    op.drop_index("ix_purchase_orders_so_number", table_name="purchase_orders")
    op.drop_column("purchase_orders", "so_number")
