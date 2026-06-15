"""Add is_archived to purchase_orders."""

from alembic import op
import sqlalchemy as sa

revision = "y0z1a2b3c4d5"
down_revision = "x9y0z1a2b3c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "purchase_orders",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_purchase_orders_is_archived", "purchase_orders", ["is_archived"])
    op.alter_column("purchase_orders", "is_archived", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_purchase_orders_is_archived", table_name="purchase_orders")
    op.drop_column("purchase_orders", "is_archived")
