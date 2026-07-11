"""Add IndiaMart query pickup fields."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "l6m7n8o9p0q1"
down_revision = "j3k4l5m6n7o8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("indiamart_queries")}

    if "picked_up_by_user_id" not in cols:
        op.add_column(
            "indiamart_queries",
            sa.Column("picked_up_by_user_id", UUID(as_uuid=True), nullable=True),
        )
        op.create_foreign_key(
            "fk_indiamart_queries_picked_up_by_user_id",
            "indiamart_queries",
            "users",
            ["picked_up_by_user_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(
            "ix_indiamart_queries_picked_up_by_user_id",
            "indiamart_queries",
            ["picked_up_by_user_id"],
        )
    if "picked_up_by_name" not in cols:
        op.add_column("indiamart_queries", sa.Column("picked_up_by_name", sa.String(255), nullable=True))
    if "picked_up_at" not in cols:
        op.add_column(
            "indiamart_queries",
            sa.Column("picked_up_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "enquiry_number" not in cols:
        op.add_column("indiamart_queries", sa.Column("enquiry_number", sa.String(20), nullable=True))
        op.create_index("ix_indiamart_queries_enquiry_number", "indiamart_queries", ["enquiry_number"])


def downgrade() -> None:
    op.drop_index("ix_indiamart_queries_enquiry_number", table_name="indiamart_queries")
    op.drop_index("ix_indiamart_queries_picked_up_by_user_id", table_name="indiamart_queries")
    op.drop_constraint("fk_indiamart_queries_picked_up_by_user_id", "indiamart_queries", type_="foreignkey")
    op.drop_column("indiamart_queries", "enquiry_number")
    op.drop_column("indiamart_queries", "picked_up_at")
    op.drop_column("indiamart_queries", "picked_up_by_name")
    op.drop_column("indiamart_queries", "picked_up_by_user_id")
