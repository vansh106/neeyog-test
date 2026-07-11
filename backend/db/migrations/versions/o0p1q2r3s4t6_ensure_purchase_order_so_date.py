"""Ensure purchase_orders.so_date exists (backfill skipped duplicate revision)."""

from alembic import op
import sqlalchemy as sa

revision = "o0p1q2r3s4t6"
down_revision = "n9p0q1r2s3t5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("purchase_orders")}
    if "so_date" not in cols:
        op.add_column("purchase_orders", sa.Column("so_date", sa.Date(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("purchase_orders")}
    if "so_date" in cols:
        op.drop_column("purchase_orders", "so_date")
