"""Add monthly_booking_target on users for dashboard analytics."""

from alembic import op
import sqlalchemy as sa

revision = "g0a1b2c3d4e5"
down_revision = "f9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "monthly_booking_target",
            sa.Float(),
            nullable=False,
            server_default="1000000",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "monthly_booking_target")
