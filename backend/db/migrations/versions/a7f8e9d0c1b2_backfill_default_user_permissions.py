"""Backfill user_permissions for legacy member/admin users (RBAC rollout)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a7f8e9d0c1b2"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None

# Mirrors config.permissions.PERMISSION_PRESETS — keep in sync for one-shot migration.
_MARKETING = (
    "upload_email",
    "view_enquiries",
    "view_quotations",
    "download_pdf",
    "hitl_approve",
    "hitl_edit_email",
    "client_verify",
    "client_view",
    "erp_export",
    "erp_download",
    "masters_view",
    "email_sync_view",
)

_ADMIN = (
    "upload_email",
    "view_enquiries",
    "delete_enquiries",
    "export_enquiries",
    "view_quotations",
    "approve_quotations",
    "delete_quotations",
    "download_pdf",
    "hitl_approve",
    "hitl_edit_email",
    "hitl_custom_prompt",
    "client_verify",
    "client_view",
    "erp_export",
    "erp_download",
    "masters_view",
    "masters_edit",
    "masters_upload_pricelist",
    "email_sync_view",
    "email_sync_trigger",
    "reports_view",
    "reports_export",
    "users_view",
    "users_create",
    "users_edit",
    "users_deactivate",
    "system_settings_view",
    "audit_log_view",
)


def _array_sql(values: tuple[str, ...]) -> str:
    inner = ",".join("'" + v.replace("'", "''") + "'" for v in values)
    return f"ARRAY[{inner}]::text[]"


def upgrade() -> None:
    m_sql = _array_sql(_MARKETING)
    a_sql = _array_sql(_ADMIN)
    op.execute(
        sa.text(
            f"""
            INSERT INTO user_permissions (id, user_id, permission, granted_by, granted_at)
            SELECT gen_random_uuid(), u.id, p, NULL, now()
            FROM users u
            CROSS JOIN unnest({m_sql}) AS p
            WHERE u.tier = 'member'
              AND COALESCE(u.is_active, true)
              AND NOT EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id)
            """
        )
    )
    op.execute(
        sa.text(
            f"""
            INSERT INTO user_permissions (id, user_id, permission, granted_by, granted_at)
            SELECT gen_random_uuid(), u.id, p, NULL, now()
            FROM users u
            CROSS JOIN unnest({a_sql}) AS p
            WHERE u.tier = 'admin'
              AND COALESCE(u.is_active, true)
              AND NOT EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id)
            """
        )
    )


def downgrade() -> None:
    pass
