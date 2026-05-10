"""Add default discount column on client companies.

Revision ID: c4d5e6f7a8b9
Revises: f0e9d8c7b6a5
Create Date: 2026-05-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "f0e9d8c7b6a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("client_companies")}
    if "default_discount_pct" not in cols:
        op.add_column("client_companies", sa.Column("default_discount_pct", sa.Float(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("client_companies")}
    if "default_discount_pct" in cols:
        op.drop_column("client_companies", "default_discount_pct")
