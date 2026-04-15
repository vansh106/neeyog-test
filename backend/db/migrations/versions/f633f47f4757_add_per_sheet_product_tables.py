"""add per-sheet product tables

Revision ID: f633f47f4757
Revises: 001
Create Date: 2026-04-09 15:29:02.192847

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f633f47f4757'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    def common_cols() -> list[sa.Column]:
        return [
            sa.Column("row_id", sa.UUID(), primary_key=True),
            sa.Column("client_id", sa.String(100), nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        ]

    def pricing_cols() -> list[sa.Column]:
        return [
            sa.Column("price_inr", sa.Float(), nullable=True),
            sa.Column("price_unit", sa.String(50), nullable=True),
            sa.Column("gst", sa.Float(), nullable=True),
            sa.Column("p_f", sa.Float(), nullable=True),
            sa.Column("gst_amt_inr", sa.Float(), nullable=True),
            sa.Column("p_f_amt_inr", sa.Float(), nullable=True),
            sa.Column("effective_price_inr", sa.Float(), nullable=True),
            sa.Column("price_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("source_file", sa.Text(), nullable=True),
        ]

    op.create_table(
        "products_butterfly_valve",
        *common_cols(),
        sa.Column("id", sa.Integer(), nullable=True),
        sa.Column("pricelist_title", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("sub_category", sa.Text(), nullable=True),
        sa.Column("product", sa.Text(), nullable=True),
        sa.Column("body_material", sa.Text(), nullable=True),
        sa.Column("seat_material", sa.Text(), nullable=True),
        sa.Column("stem_material", sa.Text(), nullable=True),
        sa.Column("pressure_rating", sa.Text(), nullable=True),
        sa.Column("end_connection", sa.Text(), nullable=True),
        sa.Column("drilling_std", sa.Text(), nullable=True),
        sa.Column("paint_finish", sa.Text(), nullable=True),
        sa.Column("operator_config", sa.Text(), nullable=True),
        sa.Column("size", sa.Text(), nullable=True),
        sa.Column("disc_moc_variant", sa.Text(), nullable=True),
        *pricing_cols(),
    )

    op.create_table(
        "products_ball_valve",
        *common_cols(),
        sa.Column("id", sa.Integer(), nullable=True),
        sa.Column("pricelist_title", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("sub_category", sa.Text(), nullable=True),
        sa.Column("product", sa.Text(), nullable=True),
        sa.Column("body_material", sa.Text(), nullable=True),
        sa.Column("seat_material", sa.Text(), nullable=True),
        sa.Column("stem_material", sa.Text(), nullable=True),
        sa.Column("pressure_rating", sa.Text(), nullable=True),
        sa.Column("end_connection", sa.Text(), nullable=True),
        sa.Column("drilling_std", sa.Text(), nullable=True),
        sa.Column("paint_finish", sa.Text(), nullable=True),
        sa.Column("operator_config", sa.Text(), nullable=True),
        sa.Column("size", sa.Text(), nullable=True),
        sa.Column("moc_variant", sa.Text(), nullable=True),
        *pricing_cols(),
    )

    op.create_table(
        "products_diaphragm_valve",
        *common_cols(),
        sa.Column("id", sa.Integer(), nullable=True),
        sa.Column("pricelist_title", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("sub_category", sa.Text(), nullable=True),
        sa.Column("product", sa.Text(), nullable=True),
        sa.Column("valve_way", sa.Text(), nullable=True),
        sa.Column("body_material", sa.Text(), nullable=True),
        sa.Column("bonnet", sa.Text(), nullable=True),
        sa.Column("diaphragm", sa.Text(), nullable=True),
        sa.Column("seat", sa.Text(), nullable=True),
        sa.Column("stem_spindle", sa.Text(), nullable=True),
        sa.Column("stem_nut", sa.Text(), nullable=True),
        sa.Column("compressor", sa.Text(), nullable=True),
        sa.Column("handwheel", sa.Text(), nullable=True),
        sa.Column("pin", sa.Text(), nullable=True),
        sa.Column("stud_nut_washer", sa.Text(), nullable=True),
        sa.Column("lever", sa.Text(), nullable=True),
        sa.Column("pressure_rating", sa.Text(), nullable=True),
        sa.Column("max_temp", sa.Text(), nullable=True),
        sa.Column("end_connection", sa.Text(), nullable=True),
        sa.Column("actuator", sa.Text(), nullable=True),
        sa.Column("operator_operation", sa.Text(), nullable=True),
        sa.Column("paint_finish", sa.Text(), nullable=True),
        sa.Column("moc_price_column", sa.Text(), nullable=True),
        sa.Column("size", sa.Text(), nullable=True),
        *pricing_cols(),
    )

    op.create_table(
        "products_nvr",
        *common_cols(),
        sa.Column("id", sa.Integer(), nullable=True),
        sa.Column("pricelist_title", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("sub_category", sa.Text(), nullable=True),
        sa.Column("product", sa.Text(), nullable=True),
        sa.Column("design", sa.Text(), nullable=True),
        sa.Column("body_material", sa.Text(), nullable=True),
        sa.Column("seat_material", sa.Text(), nullable=True),
        sa.Column("stem_material", sa.Text(), nullable=True),
        sa.Column("pressure_rating", sa.Text(), nullable=True),
        sa.Column("end_connection", sa.Text(), nullable=True),
        sa.Column("drilling_std", sa.Text(), nullable=True),
        sa.Column("paint_finish", sa.Text(), nullable=True),
        sa.Column("operator_config", sa.Text(), nullable=True),
        sa.Column("size", sa.Text(), nullable=True),
        sa.Column("moc_variant", sa.Text(), nullable=True),
        *pricing_cols(),
    )

    op.create_table(
        "products_hoses",
        *common_cols(),
        sa.Column("id", sa.Integer(), nullable=True),
        sa.Column("pricelist_title", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("sub_category", sa.Text(), nullable=True),
        sa.Column("product_name", sa.Text(), nullable=True),
        sa.Column("hose_family", sa.Text(), nullable=True),
        sa.Column("size_as_printed", sa.Text(), nullable=True),
        sa.Column("id_mm", sa.Float(), nullable=True),
        sa.Column("id_inch", sa.Float(), nullable=True),
        sa.Column("od_mm", sa.Float(), nullable=True),
        sa.Column("thickness_mm", sa.Float(), nullable=True),
        sa.Column("std_length_m", sa.Float(), nullable=True),
        sa.Column("temp_min_c", sa.Float(), nullable=True),
        sa.Column("temp_max_c", sa.Float(), nullable=True),
        sa.Column("moc_variant", sa.Text(), nullable=True),
        *pricing_cols(),
    )

    op.create_table(
        "products_speciality_valve",
        *common_cols(),
        sa.Column("id", sa.Integer(), nullable=True),
        sa.Column("pricelist_title", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("sub_category", sa.Text(), nullable=True),
        sa.Column("product", sa.Text(), nullable=True),
        sa.Column("body_material", sa.Text(), nullable=True),
        sa.Column("seat_material", sa.Text(), nullable=True),
        sa.Column("stem_material", sa.Text(), nullable=True),
        sa.Column("pressure_rating", sa.Text(), nullable=True),
        sa.Column("end_connection", sa.Text(), nullable=True),
        sa.Column("drilling_std", sa.Text(), nullable=True),
        sa.Column("paint_finish", sa.Text(), nullable=True),
        sa.Column("operator_config", sa.Text(), nullable=True),
        sa.Column("size", sa.Text(), nullable=True),
        sa.Column("moc_variant", sa.Text(), nullable=True),
        *pricing_cols(),
    )

    op.create_table(
        "products_sight_glass",
        *common_cols(),
        sa.Column("id", sa.Integer(), nullable=True),
        sa.Column("pricelist_title", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("sub_category", sa.Text(), nullable=True),
        sa.Column("product", sa.Text(), nullable=True),
        sa.Column("body_material", sa.Text(), nullable=True),
        sa.Column("seat_material", sa.Text(), nullable=True),
        sa.Column("stem_material", sa.Text(), nullable=True),
        sa.Column("pressure_rating", sa.Text(), nullable=True),
        sa.Column("end_connection", sa.Text(), nullable=True),
        sa.Column("drilling_std", sa.Text(), nullable=True),
        sa.Column("paint_finish", sa.Text(), nullable=True),
        sa.Column("operator_config", sa.Text(), nullable=True),
        sa.Column("size", sa.Text(), nullable=True),
        sa.Column("moc_variant", sa.Text(), nullable=True),
        *pricing_cols(),
    )

    op.create_table(
        "products_strainer",
        *common_cols(),
        sa.Column("id", sa.Integer(), nullable=True),
        sa.Column("pricelist_title", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("sub_category", sa.Text(), nullable=True),
        sa.Column("product", sa.Text(), nullable=True),
        sa.Column("body_material", sa.Text(), nullable=True),
        sa.Column("seat_material", sa.Text(), nullable=True),
        sa.Column("stem_material", sa.Text(), nullable=True),
        sa.Column("pressure_rating", sa.Text(), nullable=True),
        sa.Column("end_connection", sa.Text(), nullable=True),
        sa.Column("drilling_std", sa.Text(), nullable=True),
        sa.Column("paint_finish", sa.Text(), nullable=True),
        sa.Column("operator_config", sa.Text(), nullable=True),
        sa.Column("size", sa.Text(), nullable=True),
        sa.Column("moc_variant", sa.Text(), nullable=True),
        *pricing_cols(),
    )

    # Retire the old unified products table (dummy data + schema mismatch).
    op.drop_table("products")


def downgrade() -> None:
    # Recreate the old unified products table
    from pgvector.sqlalchemy import Vector

    op.create_table(
        "products",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("client_id", sa.String(100), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(100), nullable=False, index=True),
        sa.Column("sub_category", sa.String(100), nullable=True),
        sa.Column("size_inch", sa.Float(), nullable=True),
        sa.Column("size_mm", sa.Float(), nullable=True),
        sa.Column("pressure_rating", sa.String(50), nullable=True),
        sa.Column("material", sa.String(100), nullable=True),
        sa.Column("unit", sa.String(50), nullable=False, server_default="piece"),
        sa.Column("base_price", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="INR"),
        sa.Column("pricelist_version", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("raw_specs", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.drop_table("products_strainer")
    op.drop_table("products_sight_glass")
    op.drop_table("products_speciality_valve")
    op.drop_table("products_hoses")
    op.drop_table("products_nvr")
    op.drop_table("products_diaphragm_valve")
    op.drop_table("products_ball_valve")
    op.drop_table("products_butterfly_valve")
