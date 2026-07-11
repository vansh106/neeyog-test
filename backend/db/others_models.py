"""Dynamic Others product family — user-managed categories, sheets, and rows."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class OthersCategory(Base):
    __tablename__ = "others_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    sheets: Mapped[list["OthersSheet"]] = relationship(
        "OthersSheet",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="OthersSheet.sort_order",
    )


class OthersSheet(Base):
    __tablename__ = "others_sheets"
    __table_args__ = (
        UniqueConstraint("client_id", "catalog_key", name="uq_others_sheets_client_catalog_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("others_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    catalog_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    sort_order: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    category: Mapped["OthersCategory"] = relationship("OthersCategory", back_populates="sheets")
    rows: Mapped[list["OthersSheetRow"]] = relationship(
        "OthersSheetRow",
        back_populates="sheet",
        cascade="all, delete-orphan",
        order_by="OthersSheetRow.sr_no",
    )


class OthersSheetRow(Base):
    __tablename__ = "others_sheet_rows"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    sheet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("others_sheets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    sheet: Mapped["OthersSheet"] = relationship("OthersSheet", back_populates="rows")


OTHERS_CATALOG_PREFIX = "others_"


def is_others_catalog_key(key: str | None) -> bool:
    return bool(key and key.startswith(OTHERS_CATALOG_PREFIX))


def others_catalog_key_for_sheet_id(sheet_id: uuid.UUID) -> str:
    return f"{OTHERS_CATALOG_PREFIX}{sheet_id}"
