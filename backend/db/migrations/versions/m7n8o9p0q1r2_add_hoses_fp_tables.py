"""Add catalog_fp tables for Hoses_Products.xlsx worksheets.

Revision ID: m7n8o9p0q1r2
Revises: l5m6n7o8p9q0
Create Date: 2026-05-14

Run data load: ``python -m db.import_final_products_catalog``
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m7n8o9p0q1r2"
down_revision: Union[str, None] = "l5m6n7o8p9q0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _catalog_base() -> list[sa.Column]:
    return [
        sa.Column("row_id", sa.UUID(), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    ]


def _create_fp_table(table: str, text_columns: list[str]) -> None:
    op.create_table(
        table,
        *_catalog_base(),
        sa.Column("sr_no", sa.Float(), nullable=True),
        *[sa.Column(c, sa.Text(), nullable=True) for c in text_columns],
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index(f"ix_{table}_client_id", table, ["client_id"])


def upgrade() -> None:
    hose_standard = ["variant_type", "size_id_mm", "temperature_range", "source_file"]
    fp_specs: list[tuple[str, list[str]]] = [
        ("catalog_fp_hose_tuder", hose_standard),
        ("catalog_fp_hose_thunder", hose_standard),
        ("catalog_fp_hose_pvc_nylon_non_toxic", hose_standard),
        ("catalog_fp_hose_pvc_nylon_food_grade", hose_standard),
        ("catalog_fp_hose_red_silicon", hose_standard),
        (
            "catalog_fp_hose_pu",
            ["variant_type", "wall_thickness", "size_id_mm", "temperature_range", "source_file"],
        ),
    ]
    for table, cols in fp_specs:
        _create_fp_table(table, cols)


def downgrade() -> None:
    for table in (
        "catalog_fp_hose_pu",
        "catalog_fp_hose_red_silicon",
        "catalog_fp_hose_pvc_nylon_food_grade",
        "catalog_fp_hose_pvc_nylon_non_toxic",
        "catalog_fp_hose_thunder",
        "catalog_fp_hose_tuder",
    ):
        op.drop_index(f"ix_{table}_client_id", table_name=table)
        op.drop_table(table)
