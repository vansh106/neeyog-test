"""Quotation CRM status (ongoing, po_received, lost, hold) + status_remarks."""

from alembic import op
import sqlalchemy as sa


revision = "g8h9i0j1k2l3"
down_revision = "f7e8d9c0b1a2"
branch_labels = None
depends_on = None

CRM_STATUSES = ("po_received", "lost", "hold", "ongoing")


def upgrade() -> None:
    op.add_column("quotations", sa.Column("status_remarks", sa.Text(), nullable=True))
    # Normalize legacy workflow statuses to CRM "ongoing"
    conn = op.get_bind()
    placeholders = ", ".join(f"'{s}'" for s in CRM_STATUSES)
    conn.execute(
        sa.text(
            f"""
            UPDATE quotations
            SET status = 'ongoing'
            WHERE status IS NULL OR status NOT IN ({placeholders})
            """
        )
    )
    op.alter_column(
        "quotations",
        "status",
        server_default="ongoing",
        existing_type=sa.String(50),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "quotations",
        "status",
        server_default="draft",
        existing_type=sa.String(50),
        existing_nullable=False,
    )
    op.drop_column("quotations", "status_remarks")
