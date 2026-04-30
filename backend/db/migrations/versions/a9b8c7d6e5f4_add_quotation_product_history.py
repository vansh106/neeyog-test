"""Add quotation product history table for price lookup.

Revision ID: a9b8c7d6e5f4
Revises: f1a2b3c4d5e6
Create Date: 2026-04-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quotation_product_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quotation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("enquiry_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_config", sa.String(length=100), nullable=False),
        sa.Column("quote_number", sa.String(length=50), nullable=False),
        sa.Column("quoted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("client_name", sa.String(length=255), nullable=True),
        sa.Column("client_company", sa.String(length=255), nullable=True),
        sa.Column("line_index", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Float(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("line_total", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("catalog_table", sa.String(length=100), nullable=True),
        sa.Column("catalog_row_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("variant_type", sa.Text(), nullable=True),
        sa.Column("construction", sa.Text(), nullable=True),
        sa.Column("valve_size", sa.Text(), nullable=True),
        sa.Column("end_connection", sa.Text(), nullable=True),
        sa.Column("pressure", sa.Text(), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("ball_disc", sa.Text(), nullable=True),
        sa.Column("stem", sa.Text(), nullable=True),
        sa.Column("seat", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["enquiry_id"], ["enquiries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["quotation_id"], ["quotations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_qph_client_config_category_quoted_at",
        "quotation_product_history",
        ["client_config", "category", "quoted_at"],
        unique=False,
    )
    op.create_index(
        "ix_qph_catalog_lookup",
        "quotation_product_history",
        ["catalog_table", "catalog_row_id", "quoted_at"],
        unique=False,
    )
    op.create_index(op.f("ix_quotation_product_history_client_config"), "quotation_product_history", ["client_config"], unique=False)
    op.create_index(op.f("ix_quotation_product_history_quotation_id"), "quotation_product_history", ["quotation_id"], unique=False)
    op.create_index(op.f("ix_quotation_product_history_enquiry_id"), "quotation_product_history", ["enquiry_id"], unique=False)
    op.create_index(op.f("ix_quotation_product_history_quote_number"), "quotation_product_history", ["quote_number"], unique=False)
    op.create_index(op.f("ix_quotation_product_history_quoted_at"), "quotation_product_history", ["quoted_at"], unique=False)
    op.create_index(op.f("ix_quotation_product_history_category"), "quotation_product_history", ["category"], unique=False)
    op.create_index(op.f("ix_quotation_product_history_catalog_table"), "quotation_product_history", ["catalog_table"], unique=False)
    op.create_index(op.f("ix_quotation_product_history_catalog_row_id"), "quotation_product_history", ["catalog_row_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_quotation_product_history_catalog_row_id"), table_name="quotation_product_history")
    op.drop_index(op.f("ix_quotation_product_history_catalog_table"), table_name="quotation_product_history")
    op.drop_index(op.f("ix_quotation_product_history_category"), table_name="quotation_product_history")
    op.drop_index(op.f("ix_quotation_product_history_quoted_at"), table_name="quotation_product_history")
    op.drop_index(op.f("ix_quotation_product_history_quote_number"), table_name="quotation_product_history")
    op.drop_index(op.f("ix_quotation_product_history_enquiry_id"), table_name="quotation_product_history")
    op.drop_index(op.f("ix_quotation_product_history_quotation_id"), table_name="quotation_product_history")
    op.drop_index(op.f("ix_quotation_product_history_client_config"), table_name="quotation_product_history")
    op.drop_index("ix_qph_catalog_lookup", table_name="quotation_product_history")
    op.drop_index("ix_qph_client_config_category_quoted_at", table_name="quotation_product_history")
    op.drop_table("quotation_product_history")
