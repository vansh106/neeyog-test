"""Add catalog_fp tables for Sight Glass + Strainer Final_Products workbooks.

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-05-12

Run data load: ``python -m db.import_final_products_catalog``
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "l5m6n7o8p9q0"
down_revision: Union[str, None] = "k4l5m6n7o8p9"
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
    fp_specs: list[tuple[str, list[str]]] = [
        (
            "catalog_fp_sight_glass_double_window",
            [
                "variant_type",
                "valve_size",
                "end_connection",
                "pressure",
                "body",
                "packing",
                "glass",
                "source_file",
            ],
        ),
        (
            "catalog_fp_sight_glass_inline_ic_casted",
            [
                "variant_type",
                "valve_size",
                "length",
                "end_connection",
                "pressure",
                "flange",
                "packing",
                "glass",
                "source_file",
            ],
        ),
        (
            "catalog_fp_sight_glass_inline_solid_flange",
            [
                "variant_type",
                "valve_size",
                "end_connection",
                "pressure",
                "flange",
                "packing",
                "glass",
                "source_file",
            ],
        ),
        (
            "catalog_fp_strainer_y_150",
            ["variant_type", "valve_size", "end_connection", "pressure", "body", "mesh", "source_file"],
        ),
        (
            "catalog_fp_strainer_y_300",
            ["variant_type", "valve_size", "end_connection", "pressure", "body", "mesh", "source_file"],
        ),
    ]
    for table, cols in fp_specs:
        _create_fp_table(table, cols)


def downgrade() -> None:
    for table in (
        "catalog_fp_strainer_y_300",
        "catalog_fp_strainer_y_150",
        "catalog_fp_sight_glass_inline_solid_flange",
        "catalog_fp_sight_glass_inline_ic_casted",
        "catalog_fp_sight_glass_double_window",
    ):
        op.drop_index(f"ix_{table}_client_id", table_name=table)
        op.drop_table(table)
