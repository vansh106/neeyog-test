"""Replace legacy butterfly/ball catalog tables with Final_Products sheet tables.

Revision ID: b1c2d3e4f5a7
Revises: a9b8c7d6e5f4
Create Date: 2026-05-01

- Drops ``catalog_butterfly_valve`` and ``catalog_ball_valve`` (revamp-era names).
- Creates ``catalog_fp_butterfly_all_products`` and ``catalog_fp_ball_flush`` with the
  same column layout as the old tables (ball adds ``product_sheet``).
- Creates one ``catalog_fp_*`` table per worksheet from ``docs/Final_Products/`` (Mascon,
  Needle, NRV, Safety, Sampling).

Run data load: ``python -m db.import_final_products_catalog``
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1c2d3e4f5a7"
down_revision: Union[str, None] = "a9b8c7d6e5f4"
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
    op.execute(sa.text('DROP TABLE IF EXISTS "catalog_butterfly_valve" CASCADE'))
    op.execute(sa.text('DROP TABLE IF EXISTS "catalog_ball_valve" CASCADE'))

    op.create_table(
        "catalog_fp_butterfly_all_products",
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
        sa.Column("source_file", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index("ix_catalog_fp_butterfly_all_products_client_id", "catalog_fp_butterfly_all_products", ["client_id"])

    op.create_table(
        "catalog_fp_ball_flush",
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
        sa.Column("source_file", sa.Text(), nullable=True),
        sa.Column("product_sheet", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index("ix_catalog_fp_ball_flush_client_id", "catalog_fp_ball_flush", ["client_id"])

    fp_specs: list[tuple[str, list[str]]] = [
        (
            "catalog_fp_mascon_manual_tc_end",
            [
                "variant_type",
                "construction",
                "valve_size",
                "end_connection",
                "tc_od",
                "body",
                "bonnet",
                "diaphragm",
                "wheel_moc",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_manual_butt_weld",
            [
                "variant_type",
                "construction",
                "valve_size",
                "end_connection",
                "pipe_od",
                "body",
                "bonnet",
                "diaphragm",
                "wheel_moc",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_pneumatic_tc_end",
            [
                "variant_type",
                "construction",
                "valve_size",
                "end_connection",
                "tc_od",
                "body",
                "bonnet",
                "diaphragm",
                "actuator_moc",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_pneumatic_butt_weld",
            [
                "variant_type",
                "construction",
                "valve_size",
                "end_connection",
                "pipe_od",
                "body",
                "bonnet",
                "diaphragm",
                "actuator_moc",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_zdvm_l_type",
            [
                "variant_type",
                "construction",
                "valve_size",
                "end_connection",
                "tc_od",
                "body",
                "bonnet",
                "diaphragm",
                "wheel_moc",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_zdvm_j_type",
            [
                "variant_type",
                "construction",
                "valve_size",
                "end_connection",
                "tc_od",
                "body",
                "bonnet",
                "diaphragm",
                "wheel_moc",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_zdvp_l_type",
            [
                "variant_type",
                "construction",
                "valve_size",
                "end_connection",
                "tc_od",
                "body",
                "bonnet",
                "diaphragm",
                "actuator_moc",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_zdvp_j_type",
            [
                "variant_type",
                "construction",
                "valve_size",
                "end_connection",
                "tc_od",
                "body",
                "bonnet",
                "diaphragm",
                "actuator_moc",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_prv",
            [
                "variant_type",
                "valve_size",
                "end_connection",
                "tc_od",
                "inlet_pressure",
                "set_pressure_range",
                "body",
                "diaphragm",
                "seating",
                "temperature",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_angle_sc_flanged",
            [
                "variant_type",
                "valve_size",
                "end_connection",
                "body",
                "seat",
                "actuator_moc",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_angle_butt_weld",
            [
                "variant_type",
                "valve_size",
                "end_connection",
                "pipe_od",
                "body",
                "seat",
                "actuator_moc",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_angle_tc_end",
            [
                "variant_type",
                "valve_size",
                "end_connection",
                "tc_od",
                "body",
                "seat",
                "actuator_moc",
                "source_file",
            ],
        ),
        (
            "catalog_fp_mascon_spare_diaphragm",
            ["variant_type", "valve_size", "diaphragm", "wheel_moc", "source_file"],
        ),
        (
            "catalog_fp_needle_valve",
            ["variant_type", "valve_size", "end_connection", "pressure", "body", "seat", "source_file"],
        ),
        (
            "catalog_fp_nrv_inline_check",
            [
                "variant_type",
                "valve_size",
                "end_connection",
                "set_pressure",
                "body",
                "stem",
                "seat",
                "source_file",
            ],
        ),
        (
            "catalog_fp_nrv_wafer_check",
            ["variant_type", "valve_size", "end_connection", "pressure", "body", "seat", "source_file"],
        ),
        (
            "catalog_fp_nrv_non_slam",
            ["variant_type", "valve_size", "end_connection", "pressure", "body", "source_file"],
        ),
        (
            "catalog_fp_safety_sv_bsp_f",
            [
                "variant_type",
                "valve_size",
                "end_connection",
                "set_pressure",
                "body",
                "stem",
                "seat",
                "source_file",
            ],
        ),
        (
            "catalog_fp_safety_sv_tc_end",
            [
                "variant_type",
                "valve_size",
                "end_connection",
                "set_pressure",
                "body",
                "stem",
                "seat",
                "source_file",
            ],
        ),
        (
            "catalog_fp_safety_sv_flanged_150",
            [
                "variant_type",
                "valve_size",
                "end_connection",
                "set_pressure",
                "body",
                "stem",
                "seat",
                "source_file",
            ],
        ),
        (
            "catalog_fp_sampling_sv_tc_end",
            ["variant_type", "valve_size", "end_connection", "pressure", "body", "seat", "source_file"],
        ),
        (
            "catalog_fp_sampling_sv_od_base_weld",
            ["variant_type", "valve_size", "end_connection", "pressure", "body", "seat", "source_file"],
        ),
    ]

    for table, cols in fp_specs:
        _create_fp_table(table, cols)


def downgrade() -> None:
    fp_tables = [
        "catalog_fp_sampling_sv_od_base_weld",
        "catalog_fp_sampling_sv_tc_end",
        "catalog_fp_safety_sv_flanged_150",
        "catalog_fp_safety_sv_tc_end",
        "catalog_fp_safety_sv_bsp_f",
        "catalog_fp_nrv_non_slam",
        "catalog_fp_nrv_wafer_check",
        "catalog_fp_nrv_inline_check",
        "catalog_fp_needle_valve",
        "catalog_fp_mascon_spare_diaphragm",
        "catalog_fp_mascon_angle_tc_end",
        "catalog_fp_mascon_angle_butt_weld",
        "catalog_fp_mascon_angle_sc_flanged",
        "catalog_fp_mascon_prv",
        "catalog_fp_mascon_zdvp_j_type",
        "catalog_fp_mascon_zdvp_l_type",
        "catalog_fp_mascon_zdvm_j_type",
        "catalog_fp_mascon_zdvm_l_type",
        "catalog_fp_mascon_pneumatic_butt_weld",
        "catalog_fp_mascon_pneumatic_tc_end",
        "catalog_fp_mascon_manual_butt_weld",
        "catalog_fp_mascon_manual_tc_end",
    ]
    for t in fp_tables:
        op.drop_index(f"ix_{t}_client_id", table_name=t)
        op.drop_table(t)

    op.drop_index("ix_catalog_fp_ball_flush_client_id", table_name="catalog_fp_ball_flush")
    op.drop_table("catalog_fp_ball_flush")
    op.drop_index("ix_catalog_fp_butterfly_all_products_client_id", table_name="catalog_fp_butterfly_all_products")
    op.drop_table("catalog_fp_butterfly_all_products")

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
        sa.Column("source_file", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("row_id"),
    )
    op.create_index("ix_catalog_ball_valve_client_id", "catalog_ball_valve", ["client_id"])
