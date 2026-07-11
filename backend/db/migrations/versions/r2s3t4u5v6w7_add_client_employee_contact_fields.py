"""Add address_code and department to client_employees (branch contact persons).

Revision ID: r2s3t4u5v6w7
Revises: q1r2s3t4u5v6
Create Date: 2026-05-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "r2s3t4u5v6w7"
down_revision: Union[str, None] = "q1r2s3t4u5v6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("client_employees", sa.Column("address_code", sa.String(length=100), nullable=True))
    op.add_column("client_employees", sa.Column("department", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("client_employees", "department")
    op.drop_column("client_employees", "address_code")
