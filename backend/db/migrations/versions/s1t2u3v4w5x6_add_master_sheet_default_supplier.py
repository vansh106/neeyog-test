"""Add per-sheet default supplier mapping.

Revision ID: s1t2u3v4w5x6
Revises: r2s3t4u5v6w7
Create Date: 2026-05-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "s1t2u3v4w5x6"
down_revision: Union[str, None] = "r2s3t4u5v6w7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "master_sheet_default_suppliers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("catalog_table", sa.String(length=100), nullable=False),
        sa.Column("nav_slug", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "client_id",
            "catalog_table",
            "nav_slug",
            name="uq_master_sheet_default_supplier",
        ),
    )
    op.create_index(
        "ix_master_sheet_default_suppliers_client_id",
        "master_sheet_default_suppliers",
        ["client_id"],
    )
    op.create_index(
        "ix_master_sheet_default_suppliers_catalog_table",
        "master_sheet_default_suppliers",
        ["catalog_table"],
    )
    op.create_index(
        "ix_master_sheet_default_suppliers_nav_slug",
        "master_sheet_default_suppliers",
        ["nav_slug"],
    )
    op.create_index(
        "ix_master_sheet_default_suppliers_supplier_id",
        "master_sheet_default_suppliers",
        ["supplier_id"],
    )


def downgrade() -> None:
    op.drop_table("master_sheet_default_suppliers")
