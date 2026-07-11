"""Add supplier_catalog_categories for multi-sheet supplier assignment.

Revision ID: u5v6w7x8y9z0
Revises: s1t2u3v4w5x6
Create Date: 2026-05-27

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "u5v6w7x8y9z0"
down_revision: Union[str, None] = "s1t2u3v4w5x6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supplier_catalog_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_key", sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("supplier_id", "category_key", name="uq_supplier_catalog_category"),
    )
    op.create_index(
        "ix_supplier_catalog_categories_supplier_id",
        "supplier_catalog_categories",
        ["supplier_id"],
    )
    op.create_index(
        "ix_supplier_catalog_categories_category_key",
        "supplier_catalog_categories",
        ["category_key"],
    )

    op.execute(
        sa.text(
            """
            INSERT INTO supplier_catalog_categories (id, supplier_id, category_key)
            SELECT gen_random_uuid(), id, primary_category_key
            FROM suppliers
            WHERE primary_category_key IS NOT NULL
              AND primary_category_key <> 'all'
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_supplier_catalog_categories_category_key", table_name="supplier_catalog_categories")
    op.drop_index("ix_supplier_catalog_categories_supplier_id", table_name="supplier_catalog_categories")
    op.drop_table("supplier_catalog_categories")
