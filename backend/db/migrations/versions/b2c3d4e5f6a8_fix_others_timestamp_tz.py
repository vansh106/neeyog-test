"""Use timestamptz for Others masters tables.

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-06-11

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ("others_categories", "others_sheets", "others_sheet_rows")
_COLS = ("created_at", "updated_at")


def upgrade() -> None:
    for table in _TABLES:
        for col in _COLS:
            op.alter_column(
                table,
                col,
                type_=sa.DateTime(timezone=True),
                existing_type=sa.DateTime(timezone=False),
                postgresql_using=f"{col} AT TIME ZONE 'UTC'",
            )


def downgrade() -> None:
    for table in _TABLES:
        for col in _COLS:
            op.alter_column(
                table,
                col,
                type_=sa.DateTime(timezone=False),
                existing_type=sa.DateTime(timezone=True),
            )
