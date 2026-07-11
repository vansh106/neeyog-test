"""Simplify enquiry_detail_type and enquiry_quote_status values."""

from alembic import op

revision = "r3s4t5u6v7w8"
down_revision = "q2r3s4t5u6v7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE enquiries
        SET enquiry_detail_type = 'incomplete'
        WHERE enquiry_detail_type = 'partially_complete'
        """
    )
    op.execute(
        """
        UPDATE enquiries
        SET enquiry_quote_status = 'quoted'
        WHERE enquiry_quote_status = 'partially_quoted'
        """
    )


def downgrade() -> None:
    pass
