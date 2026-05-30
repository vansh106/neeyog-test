"""Add freight_amount and freight_rate to quotations.

Revision ID: v6w7x8y9z0a1
Revises: u5v6w7x8y9z0
Create Date: 2026-05-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "v6w7x8y9z0a1"
down_revision: Union[str, None] = "u5v6w7x8y9z0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quotations",
        sa.Column("freight_amount", sa.Float(), nullable=False, server_default="0"),
    )
    op.add_column(
        "quotations",
        sa.Column("freight_rate", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("quotations", "freight_rate")
    op.drop_column("quotations", "freight_amount")
