"""Human-readable enquiry_number (FY + 5-digit serial)."""

from alembic import op
import sqlalchemy as sa

revision = "k4l5m6n7o8p9"
down_revision = "j2k3l4m5n6o7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("enquiries", sa.Column("enquiry_number", sa.String(length=20), nullable=True))
    op.create_index(op.f("ix_enquiries_enquiry_number"), "enquiries", ["enquiry_number"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_enquiries_enquiry_number"), table_name="enquiries")
    op.drop_column("enquiries", "enquiry_number")
