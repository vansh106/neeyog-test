"""Replace legacy products_* sheet tables with catalog_* (revamp workbook).

Revision ID: b7c8d9e0f1a2
Revises: 151a315e654e
Create Date: 2026-04-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, None] = "151a315e654e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_LEGACY_PRODUCT_TABLES = (
    "products_strainer",
    "products_sight_glass",
    "products_speciality_valve",
    "products_hoses",
    "products_nvr",
    "products_diaphragm_valve",
    "products_ball_valve",
    "products_butterfly_valve",
)


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


def upgrade() -> None:
    for name in _LEGACY_PRODUCT_TABLES:
        op.execute(sa.text(f'DROP TABLE IF EXISTS "{name}" CASCADE'))

    op.create_table(
        "catalog_butterfly_valve",
        *_catalog_base(),
        sa.Column("sr_no", sa.Float(), nullable=True),
        sa.Column("variant_type", sa.Text(), nullable=True),
        sa.Column("construction", sa.Text(), nullable=True),
        sa.Column("valve_size", sa.Text(), nullable=True),
        sa.Column("bore_type", sa.Text(), nullable=True),
        sa.Column("end_connection", sa.Text(), nullable=True),
        sa.Column("pressure", sa.Text(), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("ball_disc", sa.Text(), nullable=True),
        sa.Column("stem", sa.Text(), nullable=True),
        sa.Column("seat", sa.Text(), nullable=True),
        sa.Column("fasteners", sa.Text(), nullable=True),
        sa.Column("price_inr", sa.Float(), nullable=True),
        sa.Column("source_file", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index("ix_catalog_butterfly_valve_client_id", "catalog_butterfly_valve", ["client_id"])

    op.create_table(
        "catalog_ball_valve",
        *_catalog_base(),
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
        sa.Column("fasteners", sa.Text(), nullable=True),
        sa.Column("price_inr", sa.Float(), nullable=True),
        sa.Column("source_file", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index("ix_catalog_ball_valve_client_id", "catalog_ball_valve", ["client_id"])

    op.create_table(
        "catalog_operator",
        *_catalog_base(),
        sa.Column("operator_for", sa.Text(), nullable=True),
        sa.Column("construct", sa.Text(), nullable=True),
        sa.Column("size_text", sa.Text(), nullable=True),
        sa.Column("model_name", sa.Text(), nullable=True),
        sa.Column("price_inr", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index("ix_catalog_operator_client_id", "catalog_operator", ["client_id"])

    op.create_table(
        "catalog_brackets_coupler",
        *_catalog_base(),
        sa.Column("bracket_operator", sa.Text(), nullable=True),
        sa.Column("construct", sa.Text(), nullable=True),
        sa.Column("size_text", sa.Text(), nullable=True),
        sa.Column("price_inr", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index("ix_catalog_brackets_coupler_client_id", "catalog_brackets_coupler", ["client_id"])

    op.create_table(
        "catalog_sov",
        *_catalog_base(),
        sa.Column("sr_no", sa.Float(), nullable=True),
        sa.Column("variant_type", sa.Text(), nullable=True),
        sa.Column("price_inr", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index("ix_catalog_sov_client_id", "catalog_sov", ["client_id"])

    op.create_table(
        "catalog_limit_switch_box",
        *_catalog_base(),
        sa.Column("sr_no", sa.Float(), nullable=True),
        sa.Column("variant_type", sa.Text(), nullable=True),
        sa.Column("price_inr", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index("ix_catalog_limit_switch_box_client_id", "catalog_limit_switch_box", ["client_id"])

    op.create_table(
        "catalog_positioner",
        *_catalog_base(),
        sa.Column("sr_no", sa.Float(), nullable=True),
        sa.Column("variant_type", sa.Text(), nullable=True),
        sa.Column("price_inr", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index("ix_catalog_positioner_client_id", "catalog_positioner", ["client_id"])


def downgrade() -> None:
    for t in (
        "catalog_positioner",
        "catalog_limit_switch_box",
        "catalog_sov",
        "catalog_brackets_coupler",
        "catalog_operator",
        "catalog_ball_valve",
        "catalog_butterfly_valve",
    ):
        op.drop_index(f"ix_{t}_client_id", table_name=t)
        op.drop_table(t)
