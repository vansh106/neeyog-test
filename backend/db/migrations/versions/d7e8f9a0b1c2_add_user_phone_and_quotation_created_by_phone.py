"""Add phone to users and created_by_phone snapshot on quotations."""

from alembic import op
import sqlalchemy as sa

revision = "d7e8f9a0b1c2"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(length=20), nullable=True))
    op.add_column("quotations", sa.Column("created_by_phone", sa.String(length=20), nullable=True))
    op.execute(
        sa.text(
            "UPDATE users SET phone = '9823012345' "
            "WHERE tier = 'superadmin' AND (phone IS NULL OR phone = '')"
        )
    )


def downgrade() -> None:
    op.drop_column("quotations", "created_by_phone")
    op.drop_column("users", "phone")
