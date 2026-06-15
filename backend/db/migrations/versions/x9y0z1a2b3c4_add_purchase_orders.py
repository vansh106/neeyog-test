"""Add purchase_orders table."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "x9y0z1a2b3c4"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "purchase_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("po_number", sa.String(50), nullable=False),
        sa.Column("quotation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quote_number", sa.String(50), nullable=True),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("client_company", sa.String(255), nullable=True),
        sa.Column("client_email", sa.String(255), nullable=True),
        sa.Column("client_phone", sa.String(50), nullable=True),
        sa.Column("client_employee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("line_items", sa.JSON(), nullable=False),
        sa.Column("subtotal", sa.Float(), nullable=False),
        sa.Column("gst_rate", sa.Float(), nullable=False, server_default="18"),
        sa.Column("gst_amount", sa.Float(), nullable=False),
        sa.Column("pf_rate", sa.Float(), nullable=False, server_default="3"),
        sa.Column("pf_amount", sa.Float(), nullable=False),
        sa.Column("freight_note", sa.String(255), nullable=False, server_default="Extra at actual"),
        sa.Column("freight_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("freight_rate", sa.Float(), nullable=True),
        sa.Column("total_amount", sa.Float(), nullable=False),
        sa.Column("primary_category", sa.String(100), nullable=False, server_default="Others"),
        sa.Column("item_desc_short", sa.String(255), nullable=False, server_default=""),
        sa.Column("financial_config", sa.JSON(), nullable=True),
        sa.Column("pdf_path", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_name", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["quotation_id"], ["quotations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["client_employee_id"], ["client_employees.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("po_number"),
    )
    op.create_index("ix_purchase_orders_po_number", "purchase_orders", ["po_number"])
    op.create_index("ix_purchase_orders_quotation_id", "purchase_orders", ["quotation_id"])
    op.create_index("ix_purchase_orders_quote_number", "purchase_orders", ["quote_number"])
    op.create_index("ix_purchase_orders_primary_category", "purchase_orders", ["primary_category"])
    op.create_index("ix_purchase_orders_created_by_user_id", "purchase_orders", ["created_by_user_id"])


def downgrade() -> None:
    op.drop_index("ix_purchase_orders_created_by_user_id", table_name="purchase_orders")
    op.drop_index("ix_purchase_orders_primary_category", table_name="purchase_orders")
    op.drop_index("ix_purchase_orders_quote_number", table_name="purchase_orders")
    op.drop_index("ix_purchase_orders_quotation_id", table_name="purchase_orders")
    op.drop_index("ix_purchase_orders_po_number", table_name="purchase_orders")
    op.drop_table("purchase_orders")
