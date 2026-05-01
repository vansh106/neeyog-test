"""Normalize operator applicability to 'All valves'.

Revision ID: c8d9e0f1a2b3
Revises: b1c2d3e4f5a7
Create Date: 2026-05-01

Operators are shared across valve families (manual DA/SA actuators).
Set `catalog_operator.operator_for` to a single label: 'All valves'.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, None] = "b1c2d3e4f5a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("UPDATE catalog_operator SET operator_for = 'All valves'"))


def downgrade() -> None:
    # Can't reliably infer prior values (Ball vs Butterfly) after normalization.
    pass

