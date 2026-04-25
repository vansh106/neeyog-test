"""Add supplier pricing layer and clear legacy catalog list prices.

Revision ID: c3f4a5b6c7d8
Revises: b7c8d9e0f1a2
Create Date: 2026-04-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3f4a5b6c7d8"
down_revision: Union[str, None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "suppliers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False, server_default="parth_valves"),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("contact_person", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("default_discount_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_preferred", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_suppliers_client_id", "suppliers", ["client_id"])

    op.create_table(
        "supplier_product_prices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("catalog_table", sa.String(length=100), nullable=False),
        sa.Column("catalog_row_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("list_price_inr", sa.Float(), nullable=False),
        sa.Column("discount_pct_override", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("supplier_id", "catalog_table", "catalog_row_id", name="uq_supplier_product"),
    )
    op.create_index("ix_supplier_product_prices_supplier_id", "supplier_product_prices", ["supplier_id"])
    op.create_index("ix_supplier_product_prices_catalog_table", "supplier_product_prices", ["catalog_table"])
    op.create_index("ix_supplier_product_prices_catalog_row_id", "supplier_product_prices", ["catalog_row_id"])

    op.create_table(
        "client_pricing_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("margin_multiplier", sa.Float(), nullable=False, server_default="1.4"),
        sa.Column("default_customer_discount_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("default_supplier_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["default_supplier_id"], ["suppliers.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("client_id", name="uq_client_pricing_configs_client_id"),
    )
    op.create_index("ix_client_pricing_configs_client_id", "client_pricing_configs", ["client_id"])

    for tbl in (
        "catalog_butterfly_valve",
        "catalog_ball_valve",
        "catalog_operator",
        "catalog_brackets_coupler",
        "catalog_sov",
        "catalog_limit_switch_box",
        "catalog_positioner",
    ):
        op.alter_column(tbl, "price_inr", existing_type=sa.Float(), nullable=True)
    op.execute(
        """
        UPDATE catalog_butterfly_valve SET price_inr = NULL;
        UPDATE catalog_ball_valve SET price_inr = NULL;
        UPDATE catalog_operator SET price_inr = NULL;
        UPDATE catalog_brackets_coupler SET price_inr = NULL;
        UPDATE catalog_sov SET price_inr = NULL;
        UPDATE catalog_limit_switch_box SET price_inr = NULL;
        UPDATE catalog_positioner SET price_inr = NULL;
        """
    )


def downgrade() -> None:
    op.drop_table("client_pricing_configs")
    op.drop_table("supplier_product_prices")
    op.drop_table("suppliers")
