"""Drop is_archived from purchase_orders (hard delete instead)."""

from alembic import op
import sqlalchemy as sa

revision = "b3c4d5e6f7a8"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_purchase_orders_is_archived", table_name="purchase_orders")
    op.drop_column("purchase_orders", "is_archived")


def downgrade() -> None:
    op.add_column(
        "purchase_orders",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_purchase_orders_is_archived", "purchase_orders", ["is_archived"])
    op.alter_column("purchase_orders", "is_archived", server_default=None)
