"""Add enquiry_detail_type (complete / incomplete client details)."""

from alembic import op
import sqlalchemy as sa

revision = "n9p0q1r2s3t5"
down_revision = "p1q2r3s4t5u6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "enquiries",
        sa.Column(
            "enquiry_detail_type",
            sa.String(length=20),
            nullable=False,
            server_default="incomplete",
        ),
    )


def downgrade() -> None:
    op.drop_column("enquiries", "enquiry_detail_type")
