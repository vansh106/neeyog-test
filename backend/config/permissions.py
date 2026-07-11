"""Granular permission constants and UI groupings for RBAC."""

from __future__ import annotations

from enum import Enum


class Permission(str, Enum):
    # ── Email & Enquiries ──────────────────
    UPLOAD_EMAIL = "upload_email"
    VIEW_ENQUIRIES = "view_enquiries"
    DELETE_ENQUIRIES = "delete_enquiries"
    EXPORT_ENQUIRIES = "export_enquiries"

    # ── Quotations ─────────────────────────
    VIEW_QUOTATIONS = "view_quotations"
    APPROVE_QUOTATIONS = "approve_quotations"
    DELETE_QUOTATIONS = "delete_quotations"
    DOWNLOAD_PDF = "download_pdf"

    # ── Purchase Orders ────────────────────
    VIEW_PURCHASE_ORDERS = "view_purchase_orders"
    CREATE_PURCHASE_ORDERS = "create_purchase_orders"
    DELETE_PURCHASE_ORDERS = "delete_purchase_orders"
    DOWNLOAD_PO_PDF = "download_po_pdf"

    # ── HITL Approvals (reserved for future) ─
    HITL_APPROVE = "hitl_approve"
    HITL_EDIT_EMAIL = "hitl_edit_email"
    HITL_CUSTOM_PROMPT = "hitl_custom_prompt"

    # ── Client Verification ────────────────
    CLIENT_VERIFY = "client_verify"
    CLIENT_VIEW = "client_view"

    # ── ERP Export ─────────────────────────
    ERP_EXPORT = "erp_export"
    ERP_DOWNLOAD = "erp_download"

    # ── Masters ────────────────────────────
    MASTERS_VIEW = "masters_view"
    MASTERS_EDIT = "masters_edit"
    MASTERS_UPLOAD_PRICELIST = "masters_upload_pricelist"

    # ── Email Sync ─────────────────────────
    EMAIL_SYNC_VIEW = "email_sync_view"
    EMAIL_SYNC_TRIGGER = "email_sync_trigger"

    # ── Reports ────────────────────────────
    REPORTS_VIEW = "reports_view"
    REPORTS_EXPORT = "reports_export"

    # ── IndiaMart ──────────────────────────
    VIEW_INDIAMART = "view_indiamart"

    # ── User Management ────────────────────
    USERS_VIEW = "users_view"
    USERS_CREATE = "users_create"
    USERS_EDIT = "users_edit"
    USERS_DEACTIVATE = "users_deactivate"

    # ── System ─────────────────────────────
    SYSTEM_SETTINGS_VIEW = "system_settings_view"
    SYSTEM_SETTINGS_EDIT = "system_settings_edit"
    AUDIT_LOG_VIEW = "audit_log_view"


PERMISSION_GROUPS: dict[str, list[Permission]] = {
    "Email & Enquiries": [
        Permission.UPLOAD_EMAIL,
        Permission.VIEW_ENQUIRIES,
        Permission.DELETE_ENQUIRIES,
        Permission.EXPORT_ENQUIRIES,
    ],
    "Quotations": [
        Permission.VIEW_QUOTATIONS,
        Permission.APPROVE_QUOTATIONS,
        Permission.DELETE_QUOTATIONS,
        Permission.DOWNLOAD_PDF,
    ],
    "Purchase Orders": [
        Permission.VIEW_PURCHASE_ORDERS,
        Permission.CREATE_PURCHASE_ORDERS,
        Permission.DELETE_PURCHASE_ORDERS,
        Permission.DOWNLOAD_PO_PDF,
    ],
    "HITL Approvals": [
        Permission.HITL_APPROVE,
        Permission.HITL_EDIT_EMAIL,
        Permission.HITL_CUSTOM_PROMPT,
    ],
    "Client Management": [
        Permission.CLIENT_VERIFY,
        Permission.CLIENT_VIEW,
    ],
    "ERP Export": [
        Permission.ERP_EXPORT,
        Permission.ERP_DOWNLOAD,
    ],
    "Masters": [
        Permission.MASTERS_VIEW,
        Permission.MASTERS_EDIT,
        Permission.MASTERS_UPLOAD_PRICELIST,
    ],
    "Email Sync": [
        Permission.EMAIL_SYNC_VIEW,
        Permission.EMAIL_SYNC_TRIGGER,
    ],
    "Reports": [
        Permission.REPORTS_VIEW,
        Permission.REPORTS_EXPORT,
    ],
    "IndiaMart": [
        Permission.VIEW_INDIAMART,
    ],
    "User Management": [
        Permission.USERS_VIEW,
        Permission.USERS_CREATE,
        Permission.USERS_EDIT,
        Permission.USERS_DEACTIVATE,
    ],
    "System": [
        Permission.SYSTEM_SETTINGS_VIEW,
        Permission.SYSTEM_SETTINGS_EDIT,
        Permission.AUDIT_LOG_VIEW,
    ],
}


PERMISSION_PRESETS: dict[str, list[Permission]] = {
    "Marketing Executive": [
        Permission.UPLOAD_EMAIL,
        Permission.VIEW_ENQUIRIES,
        Permission.VIEW_QUOTATIONS,
        Permission.DOWNLOAD_PDF,
        Permission.VIEW_PURCHASE_ORDERS,
        Permission.CREATE_PURCHASE_ORDERS,
        Permission.DELETE_PURCHASE_ORDERS,
        Permission.DOWNLOAD_PO_PDF,
        Permission.HITL_APPROVE,
        Permission.HITL_EDIT_EMAIL,
        Permission.CLIENT_VERIFY,
        Permission.CLIENT_VIEW,
        Permission.ERP_EXPORT,
        Permission.ERP_DOWNLOAD,
        Permission.MASTERS_VIEW,
        Permission.EMAIL_SYNC_VIEW,
    ],
    "Senior Marketing": [
        Permission.UPLOAD_EMAIL,
        Permission.VIEW_ENQUIRIES,
        Permission.DELETE_ENQUIRIES,
        Permission.VIEW_QUOTATIONS,
        Permission.APPROVE_QUOTATIONS,
        Permission.DOWNLOAD_PDF,
        Permission.VIEW_PURCHASE_ORDERS,
        Permission.CREATE_PURCHASE_ORDERS,
        Permission.DELETE_PURCHASE_ORDERS,
        Permission.DOWNLOAD_PO_PDF,
        Permission.HITL_APPROVE,
        Permission.HITL_EDIT_EMAIL,
        Permission.HITL_CUSTOM_PROMPT,
        Permission.CLIENT_VERIFY,
        Permission.CLIENT_VIEW,
        Permission.ERP_EXPORT,
        Permission.ERP_DOWNLOAD,
        Permission.MASTERS_VIEW,
        Permission.EMAIL_SYNC_VIEW,
        Permission.EMAIL_SYNC_TRIGGER,
        Permission.REPORTS_VIEW,
    ],
    "View Only": [
        Permission.VIEW_ENQUIRIES,
        Permission.VIEW_QUOTATIONS,
        Permission.VIEW_PURCHASE_ORDERS,
        Permission.MASTERS_VIEW,
        Permission.EMAIL_SYNC_VIEW,
        Permission.REPORTS_VIEW,
    ],
    "IndiaMart Account": [
        Permission.VIEW_INDIAMART,
        Permission.UPLOAD_EMAIL,
        Permission.VIEW_ENQUIRIES,
        Permission.VIEW_QUOTATIONS,
        Permission.DOWNLOAD_PDF,
        Permission.CLIENT_VIEW,
        Permission.CLIENT_VERIFY,
    ],
    "Admin": [
        p for p in Permission if p != Permission.SYSTEM_SETTINGS_EDIT
    ],
}

SUPERADMIN_PERMISSIONS: list[str] = [p.value for p in Permission]
