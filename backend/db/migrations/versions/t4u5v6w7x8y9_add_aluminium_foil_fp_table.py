"""Add catalog_fp_aluminium_foil table for packaging products.

Revision ID: t4u5v6w7x8y9
Revises: r3s4t5u6v7w8
Create Date: 2026-07-09

Data load: ``python -m db.import_aluminium_foil_catalog_and_prices``
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "t4u5v6w7x8y9"
down_revision: Union[str, None] = "r3s4t5u6v7w8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "catalog_fp_aluminium_foil"


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
        sa.Column("size_value", sa.Text(), nullable=True),
        sa.Column("size_unit", sa.Text(), nullable=True),
        sa.Column("dimensions", sa.Text(), nullable=True),
        sa.Column("weight_grade", sa.Text(), nullable=True),
        sa.Column("product_code", sa.Text(), nullable=True),
        sa.Column("hsn_code", sa.Text(), nullable=True),
        sa.Column("std_pack", sa.Text(), nullable=True),
        sa.Column("pack_unit", sa.Text(), nullable=True),
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
