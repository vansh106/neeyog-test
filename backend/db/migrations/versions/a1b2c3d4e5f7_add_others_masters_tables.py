"""Add dynamic Others masters tables.

Revision ID: a1b2c3d4e5f7
Revises: w7x8y9z0a1b2
Create Date: 2026-06-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "w7x8y9z0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "others_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_others_categories_client_id", "others_categories", ["client_id"])

    op.create_table(
        "others_sheets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("catalog_key", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["others_categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_id", "catalog_key", name="uq_others_sheets_client_catalog_key"),
    )
    op.create_index("ix_others_sheets_client_id", "others_sheets", ["client_id"])
    op.create_index("ix_others_sheets_category_id", "others_sheets", ["category_id"])
    op.create_index("ix_others_sheets_catalog_key", "others_sheets", ["catalog_key"])

    op.create_table(
        "others_sheet_rows",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("sheet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sr_no", sa.Float(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_inr", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["sheet_id"], ["others_sheets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_others_sheet_rows_client_id", "others_sheet_rows", ["client_id"])
    op.create_index("ix_others_sheet_rows_sheet_id", "others_sheet_rows", ["sheet_id"])


def downgrade() -> None:
    op.drop_index("ix_others_sheet_rows_sheet_id", table_name="others_sheet_rows")
    op.drop_index("ix_others_sheet_rows_client_id", table_name="others_sheet_rows")
    op.drop_table("others_sheet_rows")
    op.drop_index("ix_others_sheets_catalog_key", table_name="others_sheets")
    op.drop_index("ix_others_sheets_category_id", table_name="others_sheets")
    op.drop_index("ix_others_sheets_client_id", table_name="others_sheets")
    op.drop_table("others_sheets")
    op.drop_index("ix_others_categories_client_id", table_name="others_categories")
    op.drop_table("others_categories")
