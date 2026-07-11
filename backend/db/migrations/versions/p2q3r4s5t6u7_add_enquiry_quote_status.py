"""Add enquiry_quote_status (not_quoted / quoted / partially_quoted)."""

from alembic import op
import sqlalchemy as sa

revision = "p2q3r4s5t6u7"
down_revision = "o0p1q2r3s4t6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "enquiries",
        sa.Column(
            "enquiry_quote_status",
            sa.String(length=20),
            nullable=False,
            server_default="not_quoted",
        ),
    )
    op.execute(
        """
        UPDATE enquiries e
        SET enquiry_quote_status = 'quoted'
        WHERE EXISTS (
            SELECT 1 FROM quotations q WHERE q.enquiry_id = e.id
        )
        """
    )


def downgrade() -> None:
    op.drop_column("enquiries", "enquiry_quote_status")
