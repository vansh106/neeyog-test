"""add client company branch subdivision

Revision ID: d5e6f7a8b9c0
Revises: c3f4a5b6c7d8
Create Date: 2026-04-24

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    def _step(label: str) -> None:
        # Alembic prints stdout to terminal; keep these very explicit for debugging.
        print(f"[d5e6f7a8b9c0] {label}", flush=True)

    def _exec(sql: sa.sql.elements.TextClause, label: str) -> None:
        _step(label)
        try:
            op.execute(sql)
        except Exception as exc:  # noqa: BLE001
            print(f"[d5e6f7a8b9c0][FAILED] {label}: {exc!r}", flush=True)
            raise

    def _constraint_exists(connection: sa.Connection, name: str) -> bool:
        return (
            connection.execute(
                sa.text("SELECT 1 FROM pg_constraint WHERE conname = :n"),
                {"n": name},
            ).first()
            is not None
        )

    _step("STEP 0: inspect existing schema")
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    _step("STEP 1: create tables (if missing)")
    if "client_companies" not in tables:
        op.create_table(
            "client_companies",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("client_config", sa.String(length=100), nullable=False, server_default="parth_valves"),
            sa.Column("company_name", sa.String(length=255), nullable=False),
            sa.Column("gst_number", sa.String(length=20), nullable=True),
            sa.Column("industry", sa.String(length=100), nullable=True),
            sa.Column("website", sa.String(length=255), nullable=True),
            sa.Column("erp_code", sa.String(length=100), nullable=True),
            sa.Column("is_erp_synced", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("source", sa.String(length=50), nullable=False, server_default="manual"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("total_enquiry_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    # Never swallow DDL errors: a failed stmt aborts the whole PG transaction.
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_client_companies_client_config "
            "ON client_companies (client_config)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_client_companies_erp_code ON client_companies (erp_code)"
        )
    )

    if "client_branches" not in tables:
        op.create_table(
            "client_branches",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("branch_name", sa.String(length=255), nullable=False),
            sa.Column("is_headquarters", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("contact_name", sa.String(length=255), nullable=True),
            sa.Column("designation", sa.String(length=100), nullable=True),
            sa.Column("phone", sa.String(length=50), nullable=True),
            sa.Column("email", sa.String(length=255), nullable=True),
            sa.Column("address_line1", sa.String(length=255), nullable=True),
            sa.Column("address_line2", sa.String(length=255), nullable=True),
            sa.Column("city", sa.String(length=100), nullable=False),
            sa.Column("state", sa.String(length=100), nullable=True),
            sa.Column("pincode", sa.String(length=10), nullable=True),
            sa.Column("country", sa.String(length=100), nullable=False, server_default="India"),
            sa.Column("branch_erp_code", sa.String(length=100), nullable=True),
            sa.Column("enquiry_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["company_id"], ["client_companies.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_client_branches_company_id "
            "ON client_branches (company_id)"
        )
    )
    op.execute(
        sa.text("CREATE INDEX IF NOT EXISTS ix_client_branches_email ON client_branches (email)")
    )

    # Data migration is only possible if legacy table exists.
    if "client_records" in tables:
        _exec(
            sa.text(
                """
                INSERT INTO client_companies (
                    id, client_config, company_name, gst_number, industry, website,
                    erp_code, is_erp_synced, source, notes, is_active,
                    total_enquiry_count, created_at, updated_at
                )
                SELECT
                    id,
                    'parth_valves',
                    COALESCE(NULLIF(TRIM(company_name), ''), 'Unnamed company'),
                    NULL,
                    NULL,
                    NULL,
                    erp_code,
                    COALESCE(is_erp_synced, false),
                    COALESCE(source, 'manual'),
                    notes,
                    true,
                    COALESCE(enquiry_count, 0),
                    COALESCE(created_at, now() AT TIME ZONE 'utc'),
                    COALESCE(updated_at, now() AT TIME ZONE 'utc')
                FROM client_records
                WHERE NOT EXISTS (
                    SELECT 1 FROM client_companies cc WHERE cc.id = client_records.id
                )
                """
            ),
            "STEP 2: migrate client_records -> client_companies",
        )

        # Branches: create one Main branch per company only if none exists yet.
        _exec(
            sa.text(
                """
                INSERT INTO client_branches (
                    id, company_id, branch_name, is_headquarters,
                    contact_name, designation, phone, email,
                    address_line1, address_line2, city, state, pincode, country,
                    branch_erp_code, enquiry_count, is_active, created_at, updated_at
                )
                SELECT
                    gen_random_uuid(),
                    cr.id,
                    'Main',
                    true,
                    cr.contact_name,
                    NULL,
                    cr.phone,
                    cr.email,
                    NULL,
                    NULL,
                    COALESCE(NULLIF(TRIM(cr.city), ''), 'Unknown'),
                    NULL,
                    NULL,
                    COALESCE(NULLIF(TRIM(cr.country), ''), 'India'),
                    NULL,
                    COALESCE(cr.enquiry_count, 0),
                    true,
                    COALESCE(cr.created_at, now() AT TIME ZONE 'utc'),
                    COALESCE(cr.updated_at, now() AT TIME ZONE 'utc')
                FROM client_records cr
                WHERE NOT EXISTS (
                    SELECT 1 FROM client_branches cb WHERE cb.company_id = cr.id
                )
                """
            ),
            "STEP 3: migrate client_records -> client_branches (Main)",
        )

    # Ensure new enquiry columns exist.
    _step("STEP 4: ensure enquiries.company_id + enquiries.branch_id exist")
    enquiry_cols = {c["name"] for c in insp.get_columns("enquiries")}
    if "company_id" not in enquiry_cols:
        op.add_column(
            "enquiries",
            sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
    if "branch_id" not in enquiry_cols:
        op.add_column(
            "enquiries",
            sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        )

    if "client_records" in tables and "client_id" in enquiry_cols:
        _exec(
            sa.text(
                """
                UPDATE enquiries e
                SET
                    company_id = cr.id,
                    branch_id = (
                        SELECT cb.id
                        FROM client_branches cb
                        WHERE cb.company_id = cr.id
                        ORDER BY cb.created_at
                        LIMIT 1
                    )
                FROM client_records cr
                WHERE e.client_id = cr.id
                """
            ),
            "STEP 5: backfill enquiries.company_id + enquiries.branch_id from legacy enquiries.client_id",
        )

    # Drop legacy client_id FK+column if present.
    _step("STEP 6: drop enquiries.client_id (if present) and create new FKs/indexes")
    if "client_id" in enquiry_cols:
        op.execute(sa.text("ALTER TABLE enquiries DROP CONSTRAINT IF EXISTS fk_enquiries_client_id"))
        op.drop_column("enquiries", "client_id")

    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_enquiries_company_id ON enquiries (company_id)"
        )
    )
    op.execute(
        sa.text("CREATE INDEX IF NOT EXISTS ix_enquiries_branch_id ON enquiries (branch_id)")
    )
    if not _constraint_exists(bind, "fk_enquiries_company_id"):
        op.create_foreign_key(
            "fk_enquiries_company_id",
            "enquiries",
            "client_companies",
            ["company_id"],
            ["id"],
            ondelete="SET NULL",
        )
    if not _constraint_exists(bind, "fk_enquiries_branch_id"):
        op.create_foreign_key(
            "fk_enquiries_branch_id",
            "enquiries",
            "client_branches",
            ["branch_id"],
            ["id"],
            ondelete="SET NULL",
        )

    _step("STEP 7: drop legacy client_records table (if present)")
    if "client_records" in tables:
        op.execute(sa.text("DROP INDEX IF EXISTS ix_client_records_email"))
        op.execute(sa.text("DROP INDEX IF EXISTS ix_client_records_erp_code"))
        op.drop_table("client_records")


def downgrade() -> None:
    raise NotImplementedError("Downgrade not supported for client subdivision migration")
