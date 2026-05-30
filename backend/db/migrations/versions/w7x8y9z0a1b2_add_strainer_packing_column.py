"""Add packing column to strainer fp catalog tables.

Revision ID: w7x8y9z0a1b2
Revises: v6w7x8y9z0a1
Create Date: 2026-05-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "w7x8y9z0a1b2"
down_revision: Union[str, None] = "v6w7x8y9z0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("catalog_fp_strainer_y_150", "catalog_fp_strainer_y_300"):
        op.add_column(table, sa.Column("packing", sa.Text(), nullable=True))


def downgrade() -> None:
    for table in ("catalog_fp_strainer_y_300", "catalog_fp_strainer_y_150"):
        op.drop_column(table, "packing")
