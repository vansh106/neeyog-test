"""Add pdf_display_overrides JSON to quotations for PDF-only text changes."""

from alembic import op
import sqlalchemy as sa


revision = "f7e8d9c0b1a2"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quotations",
        sa.Column("pdf_display_overrides", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("quotations", "pdf_display_overrides")
