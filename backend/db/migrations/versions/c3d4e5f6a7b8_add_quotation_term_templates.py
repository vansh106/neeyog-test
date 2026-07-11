"""Add quotation_term_templates master list.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a8
Create Date: 2026-06-13

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quotation_term_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("client_config", sa.String(length=100), nullable=False, server_default="parth_valves"),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_quotation_term_templates_client_config",
        "quotation_term_templates",
        ["client_config"],
    )


def downgrade() -> None:
    op.drop_index("ix_quotation_term_templates_client_config", table_name="quotation_term_templates")
    op.drop_table("quotation_term_templates")
