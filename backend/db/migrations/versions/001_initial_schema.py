"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-04-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "products",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("client_id", sa.String(100), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(100), nullable=False, index=True),
        sa.Column("sub_category", sa.String(100), nullable=True),
        sa.Column("size_inch", sa.Float(), nullable=True),
        sa.Column("size_mm", sa.Float(), nullable=True),
        sa.Column("pressure_rating", sa.String(50), nullable=True),
        sa.Column("material", sa.String(100), nullable=True),
        sa.Column("unit", sa.String(50), nullable=False, server_default="piece"),
        sa.Column("base_price", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="INR"),
        sa.Column("pricelist_version", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("raw_specs", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "enquiries",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("client_config", sa.String(100), nullable=False, server_default="parth_valves"),
        sa.Column("raw_input", sa.Text(), nullable=False),
        sa.Column("input_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="received"),
        sa.Column("parsed_data", sa.JSON(), nullable=True),
        sa.Column("matched_products", sa.JSON(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("ai_reasoning", sa.Text(), nullable=True),
        sa.Column("missing_fields", sa.JSON(), nullable=True),
        sa.Column("assigned_to", sa.String(255), nullable=True),
        sa.Column("flow_type", sa.String(100), nullable=True),
        sa.Column("agent_state", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "quotations",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("enquiry_id", sa.UUID(), sa.ForeignKey("enquiries.id"), nullable=False),
        sa.Column("quote_number", sa.String(50), unique=True, nullable=False),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("client_company", sa.String(255), nullable=True),
        sa.Column("client_email", sa.String(255), nullable=True),
        sa.Column("client_phone", sa.String(50), nullable=True),
        sa.Column("line_items", sa.JSON(), nullable=False),
        sa.Column("subtotal", sa.Float(), nullable=False),
        sa.Column("gst_rate", sa.Float(), nullable=False, server_default=sa.text("18.0")),
        sa.Column("gst_amount", sa.Float(), nullable=False),
        sa.Column("pf_rate", sa.Float(), nullable=False, server_default=sa.text("3.0")),
        sa.Column("pf_amount", sa.Float(), nullable=False),
        sa.Column("freight_note", sa.String(255), nullable=False, server_default="Extra at actual"),
        sa.Column("total_amount", sa.Float(), nullable=False),
        sa.Column("validity_days", sa.Integer(), nullable=False, server_default=sa.text("15")),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("pdf_path", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="marketing"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.UUID(), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("performed_by", sa.String(255), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("users")
    op.drop_table("quotations")
    op.drop_table("enquiries")
    op.drop_table("products")
    op.execute("DROP EXTENSION IF EXISTS vector")
