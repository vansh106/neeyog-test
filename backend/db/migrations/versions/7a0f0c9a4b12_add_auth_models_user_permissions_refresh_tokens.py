"""add auth models user_permissions refresh_tokens

Revision ID: 7a0f0c9a4b12
Revises: d2e3f4a5b6c7
Create Date: 2026-04-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "7a0f0c9a4b12"
down_revision: Union[str, None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to users
    op.add_column("users", sa.Column("full_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("hashed_password", sa.String(), nullable=True))
    op.add_column("users", sa.Column("tier", sa.String(), nullable=False, server_default="member"))
    op.add_column("users", sa.Column("job_title", sa.String(), nullable=True))
    op.add_column("users", sa.Column("is_first_login", sa.Boolean(), server_default=sa.text("true"), nullable=False))
    op.add_column("users", sa.Column("created_by", sa.UUID(), nullable=True))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("last_login_ip", sa.String(), nullable=True))
    op.add_column("users", sa.Column("reset_token", sa.String(), nullable=True))
    op.add_column("users", sa.Column("reset_token_expires", sa.DateTime(timezone=True), nullable=True))

    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_reset_token"), "users", ["reset_token"], unique=False)

    # Backfill full_name from old name
    op.execute("UPDATE users SET full_name = COALESCE(full_name, name)")
    # Backfill hashed_password with placeholder (superadmin seeding will overwrite if needed)
    op.execute("UPDATE users SET hashed_password = COALESCE(hashed_password, '')")

    # Make new required columns non-null
    op.alter_column("users", "full_name", nullable=False)
    op.alter_column("users", "hashed_password", nullable=False)

    # Drop old columns
    op.drop_column("users", "name")
    op.drop_column("users", "role")

    # user_permissions
    op.create_table(
        "user_permissions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permission", sa.String(), nullable=False),
        sa.Column("granted_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "permission", name="uq_user_permission"),
    )
    op.create_index(op.f("ix_user_permissions_user_id"), "user_permissions", ["user_id"], unique=False)

    # refresh_tokens
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("device_info", sa.String(), nullable=True),
    )
    op.create_index(op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False)

    # users.created_by FK
    op.create_foreign_key("fk_users_created_by", "users", "users", ["created_by"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_users_created_by", "users", type_="foreignkey")
    op.drop_table("refresh_tokens")
    op.drop_table("user_permissions")

    op.add_column("users", sa.Column("role", sa.String(length=50), server_default="marketing", nullable=False))
    op.add_column("users", sa.Column("name", sa.String(length=255), nullable=False))

    op.execute("UPDATE users SET name = COALESCE(full_name, email)")

    op.drop_index(op.f("ix_users_reset_token"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")

    op.drop_column("users", "reset_token_expires")
    op.drop_column("users", "reset_token")
    op.drop_column("users", "last_login_ip")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "created_by")
    op.drop_column("users", "is_first_login")
    op.drop_column("users", "job_title")
    op.drop_column("users", "tier")
    op.drop_column("users", "hashed_password")
    op.drop_column("users", "full_name")

