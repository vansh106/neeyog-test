"""Add IndiaMart sync state and queries tables; backfill indiamart tier user."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSON, UUID

revision = "j3k4l5m6n7o8"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "indiamart_sync_state" not in insp.get_table_names():
        op.create_table(
            "indiamart_sync_state",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_sync_status", sa.String(50), nullable=True),
            sa.Column("last_sync_message", sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
    op.execute(
        text(
            "INSERT INTO indiamart_sync_state (id, last_sync_at, last_sync_status, last_sync_message) "
            "VALUES (1, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING"
        )
    )

    if "indiamart_queries" not in insp.get_table_names():
        op.create_table(
            "indiamart_queries",
            sa.Column("id", UUID(as_uuid=True), nullable=False),
            sa.Column("unique_query_id", sa.String(64), nullable=False),
            sa.Column("query_type", sa.String(20), nullable=True),
            sa.Column("query_time", sa.DateTime(timezone=True), nullable=True),
            sa.Column("sender_name", sa.String(255), nullable=True),
            sa.Column("sender_email", sa.String(255), nullable=True),
            sa.Column("sender_mobile", sa.String(50), nullable=True),
            sa.Column("sender_company", sa.String(255), nullable=True),
            sa.Column("sender_city", sa.String(120), nullable=True),
            sa.Column("sender_state", sa.String(120), nullable=True),
            sa.Column("sender_address", sa.Text(), nullable=True),
            sa.Column("sender_country_iso", sa.String(10), nullable=True),
            sa.Column("query_message", sa.Text(), nullable=True),
            sa.Column("query_product_name", sa.String(255), nullable=True),
            sa.Column("raw_payload", JSON(), nullable=True),
            sa.Column("enquiry_id", UUID(as_uuid=True), nullable=True),
            sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["enquiry_id"], ["enquiries.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_indiamart_queries_unique_query_id", "indiamart_queries", ["unique_query_id"], unique=True)
        op.create_index("ix_indiamart_queries_enquiry_id", "indiamart_queries", ["enquiry_id"])
        op.create_index("ix_indiamart_queries_is_archived", "indiamart_queries", ["is_archived"])
        op.alter_column("indiamart_queries", "is_archived", server_default=None)

    op.execute(
        text(
            "UPDATE users SET tier = 'indiamart' "
            "WHERE lower(email) = 'admin@indiamart.com' AND tier = 'member'"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_indiamart_queries_is_archived", table_name="indiamart_queries")
    op.drop_index("ix_indiamart_queries_enquiry_id", table_name="indiamart_queries")
    op.drop_index("ix_indiamart_queries_unique_query_id", table_name="indiamart_queries")
    op.drop_table("indiamart_queries")
    op.drop_table("indiamart_sync_state")
