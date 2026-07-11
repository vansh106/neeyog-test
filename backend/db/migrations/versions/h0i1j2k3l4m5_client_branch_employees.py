"""Client employees per branch + quotation.client_employee_id."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "h0i1j2k3l4m5"
down_revision = "g8h9i0j1k2l3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_employees",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("designation", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["branch_id"], ["client_branches.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_client_employees_branch_id"), "client_employees", ["branch_id"], unique=False)
    op.create_index(op.f("ix_client_employees_email"), "client_employees", ["email"], unique=False)

    op.add_column(
        "quotations",
        sa.Column("client_employee_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(op.f("ix_quotations_client_employee_id"), "quotations", ["client_employee_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_quotations_client_employee_id_client_employees"),
        "quotations",
        "client_employees",
        ["client_employee_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_quotations_client_employee_id_client_employees"), "quotations", type_="foreignkey")
    op.drop_index(op.f("ix_quotations_client_employee_id"), table_name="quotations")
    op.drop_column("quotations", "client_employee_id")
    op.drop_index(op.f("ix_client_employees_email"), table_name="client_employees")
    op.drop_index(op.f("ix_client_employees_branch_id"), table_name="client_employees")
    op.drop_table("client_employees")
