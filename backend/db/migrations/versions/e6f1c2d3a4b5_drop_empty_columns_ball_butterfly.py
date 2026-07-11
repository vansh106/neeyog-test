"""Drop empty columns from ball/butterfly catalogs.

Revision ID: e6f1c2d3a4b5
Revises: f1a2b3c4d5e6
Create Date: 2026-05-05
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e6f1c2d3a4b5"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ball valve: remove fasteners
    with op.batch_alter_table("catalog_fp_ball_flush") as b:
        b.drop_column("fasteners")

    # Butterfly valve: remove bore_type, stem, fasteners
    with op.batch_alter_table("catalog_fp_butterfly_all_products") as b:
        b.drop_column("bore_type")
        b.drop_column("stem")
        b.drop_column("fasteners")


def downgrade() -> None:
    with op.batch_alter_table("catalog_fp_ball_flush") as b:
        b.add_column(sa.Column("fasteners", sa.Text(), nullable=True))

    with op.batch_alter_table("catalog_fp_butterfly_all_products") as b:
        b.add_column(sa.Column("bore_type", sa.Text(), nullable=True))
        b.add_column(sa.Column("stem", sa.Text(), nullable=True))
        b.add_column(sa.Column("fasteners", sa.Text(), nullable=True))

