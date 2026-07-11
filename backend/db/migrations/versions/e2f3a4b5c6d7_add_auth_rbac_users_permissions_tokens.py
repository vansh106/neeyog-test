"""Add auth RBAC: users columns, user_permissions, refresh_tokens."""

from __future__ import annotations

import bcrypt
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision = "e2f3a4b5c6d7"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None


def _users_columns(bind) -> set[str]:
    return {c["name"] for c in inspect(bind).get_columns("users")}


def _table_exists(bind, name: str) -> bool:
    return inspect(bind).has_table(name)


def _index_exists(bind, table: str, index_name: str) -> bool:
    if not _table_exists(bind, table):
        return False
    return any(ix.get("name") == index_name for ix in inspect(bind).get_indexes(table))


def _fk_exists(bind, table: str, fk_name: str) -> bool:
    return any(fk.get("name") == fk_name for fk in inspect(bind).get_foreign_keys(table))


def upgrade() -> None:
    bind = op.get_bind()
    ucols = _users_columns(bind)

    if "full_name" not in ucols and "name" in ucols:
        op.execute(sa.text("ALTER TABLE users RENAME COLUMN name TO full_name"))
        ucols = _users_columns(bind)

    if "hashed_password" not in ucols:
        op.add_column("users", sa.Column("hashed_password", sa.String(length=255), nullable=True))
        ucols.add("hashed_password")
    if "tier" not in ucols:
        op.add_column("users", sa.Column("tier", sa.String(length=50), nullable=False, server_default="member"))
        ucols.add("tier")
    if "job_title" not in ucols:
        op.add_column("users", sa.Column("job_title", sa.String(length=255), nullable=True))
        ucols.add("job_title")
    if "is_first_login" not in ucols:
        op.add_column(
            "users",
            sa.Column("is_first_login", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        )
        ucols.add("is_first_login")
    if "created_by" not in ucols:
        op.add_column("users", sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True))
        ucols.add("created_by")
    if "last_login_at" not in ucols:
        op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
        ucols.add("last_login_at")
    if "last_login_ip" not in ucols:
        op.add_column("users", sa.Column("last_login_ip", sa.String(length=64), nullable=True))
        ucols.add("last_login_ip")
    if "reset_token" not in ucols:
        op.add_column("users", sa.Column("reset_token", sa.String(length=255), nullable=True))
        ucols.add("reset_token")
    if "reset_token_expires" not in ucols:
        op.add_column("users", sa.Column("reset_token_expires", sa.DateTime(timezone=True), nullable=True))
        ucols.add("reset_token_expires")

    if "role" in _users_columns(bind):
        op.execute(sa.text("UPDATE users SET tier = CASE WHEN role = 'admin' THEN 'admin' ELSE 'member' END"))
        op.drop_column("users", "role")

    # Use bcrypt directly — passlib 1.7.4 can fail against bcrypt 4.1+ during Alembic (no app venv isolation).
    migrated_hash = bcrypt.hashpw(b"Migrated@PleaseReset1", bcrypt.gensalt(rounds=12)).decode("ascii")
    op.execute(
        sa.text("UPDATE users SET hashed_password = :h WHERE hashed_password IS NULL").bindparams(h=migrated_hash),
    )
    if "hashed_password" in _users_columns(bind):
        hp_col = next(c for c in inspect(bind).get_columns("users") if c["name"] == "hashed_password")
        if hp_col.get("nullable", True):
            op.alter_column("users", "hashed_password", existing_type=sa.String(length=255), nullable=False)

    op.alter_column("users", "is_first_login", server_default=None)
    op.alter_column("users", "tier", server_default=None)

    if not _fk_exists(bind, "users", "fk_users_created_by_users"):
        op.create_foreign_key(
            "fk_users_created_by_users",
            "users",
            "users",
            ["created_by"],
            ["id"],
            ondelete="SET NULL",
        )

    if not _table_exists(bind, "user_permissions"):
        op.create_table(
            "user_permissions",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                nullable=False,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("permission", sa.String(length=100), nullable=False),
            sa.Column("granted_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["granted_by"], ["users.id"], ondelete="SET NULL"),
            sa.UniqueConstraint("user_id", "permission", name="uq_user_permission"),
        )
    if not _index_exists(bind, "user_permissions", "ix_user_permissions_user_id"):
        op.create_index("ix_user_permissions_user_id", "user_permissions", ["user_id"])

    if not _table_exists(bind, "refresh_tokens"):
        op.create_table(
            "refresh_tokens",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                nullable=False,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("token_hash", sa.String(length=128), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("device_info", sa.String(length=512), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
        )
    if not _index_exists(bind, "refresh_tokens", "ix_refresh_tokens_user_id"):
        op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("ix_user_permissions_user_id", table_name="user_permissions")
    op.drop_table("user_permissions")

    op.drop_constraint("fk_users_created_by_users", "users", type_="foreignkey")

    op.add_column(
        "users",
        sa.Column("role", sa.String(length=50), nullable=False, server_default="marketing"),
    )
    op.execute(sa.text("UPDATE users SET role = CASE WHEN tier = 'admin' THEN 'admin' ELSE 'marketing' END"))
    op.drop_column("users", "reset_token_expires")
    op.drop_column("users", "reset_token")
    op.drop_column("users", "last_login_ip")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "created_by")
    op.drop_column("users", "is_first_login")
    op.drop_column("users", "job_title")
    op.drop_column("users", "tier")
    op.drop_column("users", "hashed_password")

    op.execute(sa.text("ALTER TABLE users RENAME COLUMN full_name TO name"))
