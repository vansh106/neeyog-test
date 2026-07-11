"""Add catalog_fp tables for Fittings_Products.xlsx worksheets.

Revision ID: n8o9p0q1r2s3
Revises: m7n8o9p0q1r2
Create Date: 2026-05-20

Run data load: ``python -m db.import_final_products_catalog``
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "n8o9p0q1r2s3"
down_revision: Union[str, None] = "m7n8o9p0q1r2"
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
    fittings_standard = [
        "variant_type",
        "end_connection_1",
        "end_connection_2",
        "size_mm",
        "hose_nipple_moc",
        "hose_cap_moc",
        "source_file",
    ]
    fp_specs: list[tuple[str, list[str]]] = [
        ("catalog_fp_fittings_sms_nut", [*fittings_standard, "sms_nut_moc"]),
        ("catalog_fp_fittings_tri_clover_end", [*fittings_standard, "tc_od"]),
        ("catalog_fp_fittings_din_nut_11851", [*fittings_standard, "din_nut_moc"]),
        ("catalog_fp_fittings_swivel_nut", [*fittings_standard, "swivel_nut_moc"]),
        ("catalog_fp_fittings_flange_150", [*fittings_standard, "flange_nut_moc"]),
    ]
    for table, cols in fp_specs:
        _create_fp_table(table, cols)


def downgrade() -> None:
    for table in (
        "catalog_fp_fittings_flange_150",
        "catalog_fp_fittings_swivel_nut",
        "catalog_fp_fittings_din_nut_11851",
        "catalog_fp_fittings_tri_clover_end",
        "catalog_fp_fittings_sms_nut",
    ):
        op.drop_index(f"ix_{table}_client_id", table_name=table)
        op.drop_table(table)
