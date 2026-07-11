"""ORM models for per-sheet catalog tables (Parth revamp workbook).

Each worksheet maps to one `catalog_*` table. These are the source of truth
for Masters + manual entry cascades.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class _CatalogBase(Base):
    __abstract__ = True

    row_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class CatalogButterflyValveRow(_CatalogBase):
    __tablename__ = "catalog_fp_butterfly_all_products"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    ball_disc: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogOperatorRow(_CatalogBase):
    __tablename__ = "catalog_operator"

    operator_for: Mapped[str | None] = mapped_column(Text, nullable=True)
    construct: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_name: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogBracketsCouplerRow(_CatalogBase):
    __tablename__ = "catalog_brackets_coupler"

    bracket_operator: Mapped[str | None] = mapped_column(Text, nullable=True)
    construct: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_text: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogSovRow(_CatalogBase):
    __tablename__ = "catalog_sov"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogLimitSwitchRow(_CatalogBase):
    __tablename__ = "catalog_limit_switch_box"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogPositionerRow(_CatalogBase):
    __tablename__ = "catalog_positioner"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)


# Exact Excel worksheet name -> (stable API key, ORM model)
EXCEL_SHEET_TO_MODEL: dict[str, tuple[str, type]] = {
    "Butterfly Valve": ("butterfly_valve", CatalogButterflyValveRow),
    "Operator": ("operator", CatalogOperatorRow),
    "Brackets and couplers": ("brackets_coupler", CatalogBracketsCouplerRow),
    "SOV": ("sov", CatalogSovRow),
    "Limit switch Box": ("limit_switch_box", CatalogLimitSwitchRow),
    "Positioner": ("positioner", CatalogPositionerRow),
}

# Register Final_Products ORM tables on the same metadata (``init_db`` / Alembic).
import db.final_product_models  # noqa: E402, F401
