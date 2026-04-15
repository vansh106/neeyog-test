"""ORM models for per-sheet product tables.

Each XLSX worksheet is imported into its own table with the same columns.
These tables become the source of truth for the CPQ catalog (Option B).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class _SheetBase(Base):
    __abstract__ = True

    row_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ButterflyValveRow(_SheetBase):
    __tablename__ = "products_butterfly_valve"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricelist_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    sub_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    product: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure_rating: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    drilling_std: Mapped[str | None] = mapped_column(Text, nullable=True)
    paint_finish: Mapped[str | None] = mapped_column(Text, nullable=True)
    operator_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    size: Mapped[str | None] = mapped_column(Text, nullable=True)
    disc_moc_variant: Mapped[str | None] = mapped_column(Text, nullable=True)

    price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gst: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f: Mapped[float | None] = mapped_column(Float, nullable=True)
    gst_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    effective_price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class BallValveRow(_SheetBase):
    __tablename__ = "products_ball_valve"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricelist_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    sub_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    product: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure_rating: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    drilling_std: Mapped[str | None] = mapped_column(Text, nullable=True)
    paint_finish: Mapped[str | None] = mapped_column(Text, nullable=True)
    operator_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    size: Mapped[str | None] = mapped_column(Text, nullable=True)
    moc_variant: Mapped[str | None] = mapped_column(Text, nullable=True)

    price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gst: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f: Mapped[float | None] = mapped_column(Float, nullable=True)
    gst_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    effective_price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class DiaphragmValveRow(_SheetBase):
    __tablename__ = "products_diaphragm_valve"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricelist_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    sub_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    product: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_way: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    bonnet: Mapped[str | None] = mapped_column(Text, nullable=True)
    diaphragm: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem_spindle: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem_nut: Mapped[str | None] = mapped_column(Text, nullable=True)
    compressor: Mapped[str | None] = mapped_column(Text, nullable=True)
    handwheel: Mapped[str | None] = mapped_column(Text, nullable=True)
    pin: Mapped[str | None] = mapped_column(Text, nullable=True)
    stud_nut_washer: Mapped[str | None] = mapped_column(Text, nullable=True)
    lever: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure_rating: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_temp: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    actuator: Mapped[str | None] = mapped_column(Text, nullable=True)
    operator_operation: Mapped[str | None] = mapped_column(Text, nullable=True)
    paint_finish: Mapped[str | None] = mapped_column(Text, nullable=True)
    moc_price_column: Mapped[str | None] = mapped_column(Text, nullable=True)
    size: Mapped[str | None] = mapped_column(Text, nullable=True)

    price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gst: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f: Mapped[float | None] = mapped_column(Float, nullable=True)
    gst_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    effective_price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class NvrRow(_SheetBase):
    __tablename__ = "products_nvr"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricelist_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    sub_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    product: Mapped[str | None] = mapped_column(Text, nullable=True)
    design: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure_rating: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    drilling_std: Mapped[str | None] = mapped_column(Text, nullable=True)
    paint_finish: Mapped[str | None] = mapped_column(Text, nullable=True)
    operator_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    size: Mapped[str | None] = mapped_column(Text, nullable=True)
    moc_variant: Mapped[str | None] = mapped_column(Text, nullable=True)

    price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gst: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f: Mapped[float | None] = mapped_column(Float, nullable=True)
    gst_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    effective_price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class HosesRow(_SheetBase):
    __tablename__ = "products_hoses"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricelist_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    sub_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    hose_family: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_as_printed: Mapped[str | None] = mapped_column(Text, nullable=True)
    id_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    id_inch: Mapped[float | None] = mapped_column(Float, nullable=True)
    od_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    thickness_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    std_length_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    temp_min_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    temp_max_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    moc_variant: Mapped[str | None] = mapped_column(Text, nullable=True)

    price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gst: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f: Mapped[float | None] = mapped_column(Float, nullable=True)
    gst_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    effective_price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class SpecialityValveRow(_SheetBase):
    __tablename__ = "products_speciality_valve"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricelist_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    sub_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    product: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure_rating: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    drilling_std: Mapped[str | None] = mapped_column(Text, nullable=True)
    paint_finish: Mapped[str | None] = mapped_column(Text, nullable=True)
    operator_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    size: Mapped[str | None] = mapped_column(Text, nullable=True)
    moc_variant: Mapped[str | None] = mapped_column(Text, nullable=True)

    price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gst: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f: Mapped[float | None] = mapped_column(Float, nullable=True)
    gst_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    effective_price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class SightGlassRow(_SheetBase):
    __tablename__ = "products_sight_glass"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricelist_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    sub_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    product: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure_rating: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    drilling_std: Mapped[str | None] = mapped_column(Text, nullable=True)
    paint_finish: Mapped[str | None] = mapped_column(Text, nullable=True)
    operator_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    size: Mapped[str | None] = mapped_column(Text, nullable=True)
    moc_variant: Mapped[str | None] = mapped_column(Text, nullable=True)

    price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gst: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f: Mapped[float | None] = mapped_column(Float, nullable=True)
    gst_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    effective_price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class StrainerRow(_SheetBase):
    __tablename__ = "products_strainer"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricelist_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    sub_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    product: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem_material: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure_rating: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    drilling_std: Mapped[str | None] = mapped_column(Text, nullable=True)
    paint_finish: Mapped[str | None] = mapped_column(Text, nullable=True)
    operator_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    size: Mapped[str | None] = mapped_column(Text, nullable=True)
    moc_variant: Mapped[str | None] = mapped_column(Text, nullable=True)

    price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gst: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f: Mapped[float | None] = mapped_column(Float, nullable=True)
    gst_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_f_amt_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    effective_price_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


SHEET_MODELS = {
    "Butterfly valve": ("butterfly_valve", ButterflyValveRow),
    "Ball valve": ("ball_valve", BallValveRow),
    "Diaphragm Valve ": ("diaphragm_valve", DiaphragmValveRow),
    "NVR": ("nvr", NvrRow),
    "Hoses": ("hoses", HosesRow),
    "Speciality valve": ("speciality_valve", SpecialityValveRow),
    "Sight glass": ("sight_glass", SightGlassRow),
    "Strainer": ("strainer", StrainerRow),
}

