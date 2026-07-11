"""Add catalog_fp_paper_products table for packaging paper products.

Revision ID: v5w6x7y8z9a0
Revises: t4u5v6w7x8y9
Create Date: 2026-07-10

Data load: ``python -m db.import_paper_products_catalog_and_prices``
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "v5w6x7y8z9a0"
down_revision: Union[str, None] = "t4u5v6w7x8y9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "catalog_fp_paper_products"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("row_id", sa.UUID(), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("sr_no", sa.Float(), nullable=True),
        sa.Column("variant_type", sa.Text(), nullable=True),
        sa.Column("product_name", sa.Text(), nullable=True),
        sa.Column("gsm", sa.Text(), nullable=True),
        sa.Column("size_value", sa.Text(), nullable=True),
        sa.Column("size_unit", sa.Text(), nullable=True),
        sa.Column("diameter_top", sa.Text(), nullable=True),
        sa.Column("diameter_bt", sa.Text(), nullable=True),
        sa.Column("height", sa.Text(), nullable=True),
        sa.Column("dimensions", sa.Text(), nullable=True),
        sa.Column("hsn_code", sa.Text(), nullable=True),
        sa.Column("rate_per", sa.Text(), nullable=True),
        sa.Column("std_pack", sa.Text(), nullable=True),
        sa.Column("pack_unit", sa.Text(), nullable=True),
        sa.Column("movement", sa.Text(), nullable=True),
        sa.Column("primary_godown", sa.Text(), nullable=True),
        sa.Column("canonical_sku", sa.Text(), nullable=True),
        sa.Column("source_file", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index(f"ix_{TABLE}_client_id", TABLE, ["client_id"])
    op.create_index(f"ix_{TABLE}_canonical_sku", TABLE, ["canonical_sku"])


def downgrade() -> None:
    op.drop_index(f"ix_{TABLE}_canonical_sku", table_name=TABLE)
    op.drop_index(f"ix_{TABLE}_client_id", table_name=TABLE)
    op.drop_table(TABLE)
