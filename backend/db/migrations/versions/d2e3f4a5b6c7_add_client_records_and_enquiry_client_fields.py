"""add client_records and enquiry client fields

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b7
Create Date: 2026-04-10

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c1d2e3f4a5b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "client_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_name", sa.String(), nullable=False),
        sa.Column("contact_name", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("city", sa.String(), nullable=True),
        sa.Column("country", sa.String(), nullable=False, server_default="India"),
        sa.Column("erp_code", sa.String(), nullable=True),
        sa.Column("is_erp_synced", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("source", sa.String(), nullable=False, server_default="email_parsed"),
        sa.Column("enquiry_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_client_records_email"), "client_records", ["email"], unique=False)
    op.create_index(op.f("ix_client_records_erp_code"), "client_records", ["erp_code"], unique=False)

    op.add_column("enquiries", sa.Column("client_id", sa.UUID(), nullable=True))
    op.add_column("enquiries", sa.Column("client_is_new", sa.Boolean(), nullable=True))
    op.add_column("enquiries", sa.Column("client_verification_status", sa.String(), nullable=True))
    op.add_column("enquiries", sa.Column("erp_export_path", sa.String(), nullable=True))
    op.create_foreign_key("fk_enquiries_client_id", "enquiries", "client_records", ["client_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_enquiries_client_id", "enquiries", type_="foreignkey")
    op.drop_column("enquiries", "erp_export_path")
    op.drop_column("enquiries", "client_verification_status")
    op.drop_column("enquiries", "client_is_new")
    op.drop_column("enquiries", "client_id")
    op.drop_index(op.f("ix_client_records_erp_code"), table_name="client_records")
    op.drop_index(op.f("ix_client_records_email"), table_name="client_records")
    op.drop_table("client_records")

