"""Add catalog_fp tables for Flush_Bottom_Valve_Products workbook.

Revision ID: q1r2s3t4u5v6
Revises: p0q1r2s3t4u5
Create Date: 2026-05-20

Run catalog + Casco prices: ``python -m db.import_fbv_catalog_and_prices``
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "q1r2s3t4u5v6"
down_revision: Union[str, None] = "p0q1r2s3t4u5"
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
    fbv_standard = [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "pressure",
        "body",
        "ball",
        "stem",
        "seat",
        "source_file",
    ]
    for table in ("catalog_fp_fbv_ball_type", "catalog_fp_fbv_y_type"):
        _create_fp_table(table, fbv_standard)


def downgrade() -> None:
    for table in ("catalog_fp_fbv_y_type", "catalog_fp_fbv_ball_type"):
        op.drop_index(f"ix_{table}_client_id", table_name=table)
        op.drop_table(table)
