"""Enquiries: track creating user (display name + optional FK)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "j2k3l4m5n6o7"
down_revision = "i1j2k3l4m5n6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "enquiries",
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "enquiries",
        sa.Column("created_by_name", sa.String(length=255), nullable=True),
    )
    op.create_index(
        op.f("ix_enquiries_created_by_user_id"),
        "enquiries",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("fk_enquiries_created_by_user_id_users"),
        "enquiries",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_enquiries_created_by_user_id_users"), "enquiries", type_="foreignkey")
    op.drop_index(op.f("ix_enquiries_created_by_user_id"), table_name="enquiries")
    op.drop_column("enquiries", "created_by_name")
    op.drop_column("enquiries", "created_by_user_id")
