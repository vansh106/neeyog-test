"""Drop legacy universal price_inr from catalog tables.

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
Create Date: 2026-04-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _drop_col_if_exists(table: str, col: str) -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns(table)}
    if col in cols:
        op.drop_column(table, col)


def upgrade() -> None:
    # Universal prices are no longer stored on masters; prices are stored per supplier.
    for t in [
        "catalog_butterfly_valve",
        "catalog_ball_valve",
        "catalog_operator",
        "catalog_brackets_coupler",
        "catalog_sov",
        "catalog_limit_switch_box",
        "catalog_positioner",
    ]:
        _drop_col_if_exists(t, "price_inr")


def downgrade() -> None:
    raise NotImplementedError("Downgrade not supported for dropping price_inr")

