"""Add supplier per-category pricing variables (margin/discount/customer discount).

Revision ID: e1f2a3b4c5d6
Revises: d5e6f7a8b9c0
Create Date: 2026-04-24

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())
    supplier_cols = {c["name"] for c in insp.get_columns("suppliers")}

    if "primary_category_key" not in supplier_cols:
        op.add_column(
            "suppliers",
            sa.Column(
                "primary_category_key",
                sa.String(length=100),
                nullable=False,
                server_default="all",
            ),
        )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_suppliers_primary_category_key "
            "ON suppliers (primary_category_key)"
        )
    )

    if "supplier_category_pricing" not in tables:
        op.create_table(
            "supplier_category_pricing",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("category_key", sa.String(length=100), nullable=False, server_default="all"),
            sa.Column("margin_multiplier", sa.Float(), nullable=True),
            sa.Column("supplier_discount_pct", sa.Float(), nullable=True),
            sa.Column("customer_discount_pct", sa.Float(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("supplier_id", "category_key", name="uq_supplier_category_pricing"),
        )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_supplier_category_pricing_supplier_id "
            "ON supplier_category_pricing (supplier_id)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_supplier_category_pricing_category_key "
            "ON supplier_category_pricing (category_key)"
        )
    )

    # Backfill: create an 'all' row for every supplier using legacy defaults.
    # - supplier_discount_pct from suppliers.default_discount_pct
    # - margin/customer_discount from client_pricing_configs if present (single-tenant), else defaults.
    op.execute(
        sa.text(
            """
            WITH cfg AS (
              SELECT
                COALESCE(MAX(margin_multiplier), 1.4) AS margin_multiplier,
                COALESCE(MAX(default_customer_discount_pct), 0.0) AS customer_discount_pct
              FROM client_pricing_configs
            )
            INSERT INTO supplier_category_pricing (
              id, supplier_id, category_key,
              margin_multiplier, supplier_discount_pct, customer_discount_pct,
              created_at, updated_at
            )
            SELECT
              gen_random_uuid(),
              s.id,
              'all',
              cfg.margin_multiplier,
              COALESCE(s.default_discount_pct, 0.0),
              cfg.customer_discount_pct,
              now() AT TIME ZONE 'utc',
              now() AT TIME ZONE 'utc'
            FROM suppliers s
            CROSS JOIN cfg
            ON CONFLICT (supplier_id, category_key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    raise NotImplementedError("Downgrade not supported for supplier category pricing migration")

