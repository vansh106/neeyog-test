"""Add next_follow_up_note and follow_up_history on enquiries and quotations."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "q2r3s4t5u6v7"
down_revision = "p2q3r4s5t6u7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("enquiries", "quotations"):
        op.add_column(table, sa.Column("next_follow_up_note", sa.Text(), nullable=True))
        op.add_column(
            table,
            sa.Column(
                "follow_up_history",
                JSONB(),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )


def downgrade() -> None:
    for table in ("enquiries", "quotations"):
        op.drop_column(table, "follow_up_history")
        op.drop_column(table, "next_follow_up_note")
