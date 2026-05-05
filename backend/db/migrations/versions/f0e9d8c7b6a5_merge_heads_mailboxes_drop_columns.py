"""Merge heads: mailboxes + drop empty columns.

Revision ID: f0e9d8c7b6a5
Revises: b2c3d4e5f6a7, e6f1c2d3a4b5
Create Date: 2026-05-05
"""

from typing import Sequence, Union

from alembic import op


revision: str = "f0e9d8c7b6a5"
down_revision: Union[str, Sequence[str], None] = ("b2c3d4e5f6a7", "e6f1c2d3a4b5")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # merge-only
    pass


def downgrade() -> None:
    # merge-only
    pass

