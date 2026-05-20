"""Add catalog_fp tables for Ball_Valve_Products.xlsx worksheets.

Revision ID: p0q1r2s3t4u5
Revises: o9p0q1r2s3t4
Create Date: 2026-05-20

Run data load: ``python -m db.import_final_products_catalog``
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "p0q1r2s3t4u5"
down_revision: Union[str, None] = "o9p0q1r2s3t4"
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
    ball_valve_standard = [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "rating",
        "body",
        "ball",
        "stem",
        "seat",
        "source_file",
    ]
    for table in (
        "catalog_fp_ball_valve_casco_1_piece_multi_end",
        "catalog_fp_ball_valve_casco_1_piece_flanged",
        "catalog_fp_ball_valve_casco_2_piece",
        "catalog_fp_ball_valve_casco_3_piece",
        "catalog_fp_ball_valve_casco_3_piece_ext_stem",
        "catalog_fp_ball_valve_casco_3_piece_3_way_l_port",
        "catalog_fp_ball_valve_unison_1_piece_multi_end",
        "catalog_fp_ball_valve_unison_2_piece_iso_pads",
        "catalog_fp_ball_valve_unison_3_piece",
        "catalog_fp_ball_valve_unison_3_piece_3_way_l_port",
    ):
        _create_fp_table(table, ball_valve_standard)


def downgrade() -> None:
    for table in (
        "catalog_fp_ball_valve_unison_3_piece_3_way_l_port",
        "catalog_fp_ball_valve_unison_3_piece",
        "catalog_fp_ball_valve_unison_2_piece_iso_pads",
        "catalog_fp_ball_valve_unison_1_piece_multi_end",
        "catalog_fp_ball_valve_casco_3_piece_3_way_l_port",
        "catalog_fp_ball_valve_casco_3_piece_ext_stem",
        "catalog_fp_ball_valve_casco_3_piece",
        "catalog_fp_ball_valve_casco_2_piece",
        "catalog_fp_ball_valve_casco_1_piece_flanged",
        "catalog_fp_ball_valve_casco_1_piece_multi_end",
    ):
        op.drop_index(f"ix_{table}_client_id", table_name=table)
        op.drop_table(table)
