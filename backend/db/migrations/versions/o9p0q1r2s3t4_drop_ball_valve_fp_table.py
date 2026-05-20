"""Drop flush-bottom ball valve catalog table (master removed).

Revision ID: o9p0q1r2s3t4
Revises: n8o9p0q1r2s3
Create Date: 2026-05-20
"""

from typing import Sequence, Union

from alembic import op

revision: str = "o9p0q1r2s3t4"
down_revision: Union[str, None] = "n8o9p0q1r2s3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_catalog_fp_ball_flush_client_id", table_name="catalog_fp_ball_flush")
    op.drop_table("catalog_fp_ball_flush")


def downgrade() -> None:
    import sqlalchemy as sa

    op.create_table(
        "catalog_fp_ball_flush",
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
        sa.Column("sr_no", sa.Float(), nullable=True),
        sa.Column("variant_type", sa.Text(), nullable=True),
        sa.Column("construction", sa.Text(), nullable=True),
        sa.Column("valve_size", sa.Text(), nullable=True),
        sa.Column("bore_type", sa.Text(), nullable=True),
        sa.Column("end_connection", sa.Text(), nullable=True),
        sa.Column("pressure", sa.Text(), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("ball", sa.Text(), nullable=True),
        sa.Column("stem", sa.Text(), nullable=True),
        sa.Column("seat", sa.Text(), nullable=True),
        sa.Column("source_file", sa.Text(), nullable=True),
        sa.Column("product_sheet", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index("ix_catalog_fp_ball_flush_client_id", "catalog_fp_ball_flush", ["client_id"])
