"""ORM models for `docs/Final_Products/*.xlsx` — one table per worksheet (except butterfly/ball).

Butterfly and ball flush products use `CatalogButterflyValveRow` / `CatalogBallValveRow` with
final table names in `sheet_models.py`. All other final sheets use `FinalProductSheetMarker`
subclasses below.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class _FinalCatalogBase(Base):
    __abstract__ = True

    row_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class FinalProductSheetMarker:
    """Mixin marker for final-product sheet rows (Masters / cascades)."""


class CatalogFpMasconManualTcEndRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_manual_tc_end"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    tc_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    bonnet: Mapped[str | None] = mapped_column(Text, nullable=True)
    diaphragm: Mapped[str | None] = mapped_column(Text, nullable=True)
    wheel_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconManualButtWeldRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_manual_butt_weld"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pipe_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    bonnet: Mapped[str | None] = mapped_column(Text, nullable=True)
    diaphragm: Mapped[str | None] = mapped_column(Text, nullable=True)
    wheel_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconPneumaticTcEndRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_pneumatic_tc_end"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    tc_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    bonnet: Mapped[str | None] = mapped_column(Text, nullable=True)
    diaphragm: Mapped[str | None] = mapped_column(Text, nullable=True)
    actuator_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconPneumaticButtWeldRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_pneumatic_butt_weld"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pipe_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    bonnet: Mapped[str | None] = mapped_column(Text, nullable=True)
    diaphragm: Mapped[str | None] = mapped_column(Text, nullable=True)
    actuator_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconZdvmLTypeRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_zdvm_l_type"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    tc_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    bonnet: Mapped[str | None] = mapped_column(Text, nullable=True)
    diaphragm: Mapped[str | None] = mapped_column(Text, nullable=True)
    wheel_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconZdvmJTypeRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_zdvm_j_type"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    tc_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    bonnet: Mapped[str | None] = mapped_column(Text, nullable=True)
    diaphragm: Mapped[str | None] = mapped_column(Text, nullable=True)
    wheel_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconZdvpLTypeRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_zdvp_l_type"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    tc_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    bonnet: Mapped[str | None] = mapped_column(Text, nullable=True)
    diaphragm: Mapped[str | None] = mapped_column(Text, nullable=True)
    actuator_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconZdvpJTypeRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_zdvp_j_type"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    tc_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    bonnet: Mapped[str | None] = mapped_column(Text, nullable=True)
    diaphragm: Mapped[str | None] = mapped_column(Text, nullable=True)
    actuator_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconPrvRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_prv"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    tc_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    inlet_pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    set_pressure_range: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    diaphragm: Mapped[str | None] = mapped_column(Text, nullable=True)
    seating: Mapped[str | None] = mapped_column(Text, nullable=True)
    temperature: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconAngleScFlangedRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_angle_sc_flanged"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    actuator_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconAngleButtWeldRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_angle_butt_weld"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pipe_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    actuator_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconAngleTcEndRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_angle_tc_end"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    tc_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    actuator_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpMasconSpareDiaphragmRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_mascon_spare_diaphragm"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    diaphragm: Mapped[str | None] = mapped_column(Text, nullable=True)
    wheel_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpNeedleValveRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_needle_valve"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpNrvInlineCheckRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_nrv_inline_check"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    set_pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpNrvWaferCheckRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_nrv_wafer_check"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpNrvNonSlamRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_nrv_non_slam"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpSafetySvBspRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_safety_sv_bsp_f"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    set_pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpSafetySvTcEndRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_safety_sv_tc_end"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    set_pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpSafetySvFlanged150Row(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_safety_sv_flanged_150"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    set_pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpSamplingSvTcEndRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_sampling_sv_tc_end"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpSamplingSvOdBaseWeldRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_sampling_sv_od_base_weld"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpSightGlassDoubleWindowRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_sight_glass_double_window"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    packing: Mapped[str | None] = mapped_column(Text, nullable=True)
    glass: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpSightGlassInlineIcCastedRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_sight_glass_inline_ic_casted"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    length: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    flange: Mapped[str | None] = mapped_column(Text, nullable=True)
    packing: Mapped[str | None] = mapped_column(Text, nullable=True)
    glass: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpSightGlassInlineSolidFlangeRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_sight_glass_inline_solid_flange"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    flange: Mapped[str | None] = mapped_column(Text, nullable=True)
    packing: Mapped[str | None] = mapped_column(Text, nullable=True)
    glass: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpStrainerY150Row(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_strainer_y_150"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    mesh: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpStrainerY300Row(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_strainer_y_300"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    mesh: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class _CatalogFpHoseStandardColumns:
    """Shared columns for Hoses_Products.xlsx sheets (except PU)."""

    __abstract__ = True

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_id_mm: Mapped[str | None] = mapped_column(Text, nullable=True)
    temperature_range: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpHoseTuderRow(_CatalogFpHoseStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_hose_tuder"


class CatalogFpHoseThunderRow(_CatalogFpHoseStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_hose_thunder"


class CatalogFpHosePvcNylonNonToxicRow(_CatalogFpHoseStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_hose_pvc_nylon_non_toxic"


class CatalogFpHosePvcNylonFoodGradeRow(_CatalogFpHoseStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_hose_pvc_nylon_food_grade"


class CatalogFpHoseRedSiliconRow(_CatalogFpHoseStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_hose_red_silicon"


class CatalogFpHosePuRow(FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_hose_pu"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    wall_thickness: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_id_mm: Mapped[str | None] = mapped_column(Text, nullable=True)
    temperature_range: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


FINAL_PRODUCT_SHEET_MODELS: list[tuple[str, type]] = [
    ("fp_mascon_manual_tc_end", CatalogFpMasconManualTcEndRow),
    ("fp_mascon_manual_butt_weld", CatalogFpMasconManualButtWeldRow),
    ("fp_mascon_pneumatic_tc_end", CatalogFpMasconPneumaticTcEndRow),
    ("fp_mascon_pneumatic_butt_weld", CatalogFpMasconPneumaticButtWeldRow),
    ("fp_mascon_zdvm_l_type", CatalogFpMasconZdvmLTypeRow),
    ("fp_mascon_zdvm_j_type", CatalogFpMasconZdvmJTypeRow),
    ("fp_mascon_zdvp_l_type", CatalogFpMasconZdvpLTypeRow),
    ("fp_mascon_zdvp_j_type", CatalogFpMasconZdvpJTypeRow),
    ("fp_mascon_prv", CatalogFpMasconPrvRow),
    ("fp_mascon_angle_sc_flanged", CatalogFpMasconAngleScFlangedRow),
    ("fp_mascon_angle_butt_weld", CatalogFpMasconAngleButtWeldRow),
    ("fp_mascon_angle_tc_end", CatalogFpMasconAngleTcEndRow),
    ("fp_mascon_spare_diaphragm", CatalogFpMasconSpareDiaphragmRow),
    ("fp_needle_valve", CatalogFpNeedleValveRow),
    ("fp_nrv_inline_check", CatalogFpNrvInlineCheckRow),
    ("fp_nrv_wafer_check", CatalogFpNrvWaferCheckRow),
    ("fp_nrv_non_slam", CatalogFpNrvNonSlamRow),
    ("fp_safety_sv_bsp_f", CatalogFpSafetySvBspRow),
    ("fp_safety_sv_tc_end", CatalogFpSafetySvTcEndRow),
    ("fp_safety_sv_flanged_150", CatalogFpSafetySvFlanged150Row),
    ("fp_sampling_sv_tc_end", CatalogFpSamplingSvTcEndRow),
    ("fp_sampling_sv_od_base_weld", CatalogFpSamplingSvOdBaseWeldRow),
    ("fp_sight_glass_double_window", CatalogFpSightGlassDoubleWindowRow),
    ("fp_sight_glass_inline_ic_casted", CatalogFpSightGlassInlineIcCastedRow),
    ("fp_sight_glass_inline_solid_flange", CatalogFpSightGlassInlineSolidFlangeRow),
    ("fp_strainer_y_150", CatalogFpStrainerY150Row),
    ("fp_strainer_y_300", CatalogFpStrainerY300Row),
    ("fp_hose_tuder", CatalogFpHoseTuderRow),
    ("fp_hose_thunder", CatalogFpHoseThunderRow),
    ("fp_hose_pvc_nylon_non_toxic", CatalogFpHosePvcNylonNonToxicRow),
    ("fp_hose_pvc_nylon_food_grade", CatalogFpHosePvcNylonFoodGradeRow),
    ("fp_hose_red_silicon", CatalogFpHoseRedSiliconRow),
    ("fp_hose_pu", CatalogFpHosePuRow),
]

# Masters sidebar + cascade (ordered fields = DB column names; exclude sr_no / source_file).
FINAL_PRODUCT_LABEL_BY_KEY: dict[str, str] = {
    "fp_mascon_manual_tc_end": "Mascon — Manual (TC end)",
    "fp_mascon_manual_butt_weld": "Mascon — Manual (butt weld)",
    "fp_mascon_pneumatic_tc_end": "Mascon — Pneumatic (TC end)",
    "fp_mascon_pneumatic_butt_weld": "Mascon — Pneumatic (butt weld)",
    "fp_mascon_zdvm_l_type": "Mascon — ZDV-M L type",
    "fp_mascon_zdvm_j_type": "Mascon — ZDV-M J type",
    "fp_mascon_zdvp_l_type": "Mascon — ZDV-P L type",
    "fp_mascon_zdvp_j_type": "Mascon — ZDV-P J type",
    "fp_mascon_prv": "Mascon — PRV",
    "fp_mascon_angle_sc_flanged": "Mascon — Angle (screwed & flanged)",
    "fp_mascon_angle_butt_weld": "Mascon — Angle (butt weld)",
    "fp_mascon_angle_tc_end": "Mascon — Angle (TC end)",
    "fp_mascon_spare_diaphragm": "Mascon — Spare diaphragm",
    "fp_needle_valve": "Needle valve",
    "fp_nrv_inline_check": "NRV — In-line check",
    "fp_nrv_wafer_check": "NRV — Wafer check",
    "fp_nrv_non_slam": "NRV — Non-slam check",
    "fp_safety_sv_bsp_f": "Safety valve — BSP-F",
    "fp_safety_sv_tc_end": "Safety valve — TC end",
    "fp_safety_sv_flanged_150": "Safety valve — Flanged #150",
    "fp_sampling_sv_tc_end": "Sampling valve — TC end",
    "fp_sampling_sv_od_base_weld": "Sampling valve — OD base weld",
    "fp_sight_glass_double_window": "Sight glass — Double window",
    "fp_sight_glass_inline_ic_casted": "Sight glass — In-line (IC casted)",
    "fp_sight_glass_inline_solid_flange": "Sight glass — In-line (solid flange)",
    "fp_strainer_y_150": "Strainer — Y #150",
    "fp_strainer_y_300": "Strainer — Y #300",
    "fp_hose_tuder": "Hose — Tuder",
    "fp_hose_thunder": "Hose — Thunder",
    "fp_hose_pvc_nylon_non_toxic": "Hose — PVC nylon (non-toxic)",
    "fp_hose_pvc_nylon_food_grade": "Hose — PVC nylon (food grade)",
    "fp_hose_red_silicon": "Hose — Red silicon",
    "fp_hose_pu": "Hose — PU",
}

FINAL_PRODUCT_CASCADE_STEPS: dict[str, list[str]] = {
    "fp_mascon_manual_tc_end": [
        "variant_type",
        "construction",
        "valve_size",
        "end_connection",
        "tc_od",
        "body",
        "bonnet",
        "diaphragm",
        "wheel_moc",
    ],
    "fp_mascon_manual_butt_weld": [
        "variant_type",
        "construction",
        "valve_size",
        "end_connection",
        "pipe_od",
        "body",
        "bonnet",
        "diaphragm",
        "wheel_moc",
    ],
    "fp_mascon_pneumatic_tc_end": [
        "variant_type",
        "construction",
        "valve_size",
        "end_connection",
        "tc_od",
        "body",
        "bonnet",
        "diaphragm",
        "actuator_moc",
    ],
    "fp_mascon_pneumatic_butt_weld": [
        "variant_type",
        "construction",
        "valve_size",
        "end_connection",
        "pipe_od",
        "body",
        "bonnet",
        "diaphragm",
        "actuator_moc",
    ],
    "fp_mascon_zdvm_l_type": [
        "variant_type",
        "construction",
        "valve_size",
        "end_connection",
        "tc_od",
        "body",
        "bonnet",
        "diaphragm",
        "wheel_moc",
    ],
    "fp_mascon_zdvm_j_type": [
        "variant_type",
        "construction",
        "valve_size",
        "end_connection",
        "tc_od",
        "body",
        "bonnet",
        "diaphragm",
        "wheel_moc",
    ],
    "fp_mascon_zdvp_l_type": [
        "variant_type",
        "construction",
        "valve_size",
        "end_connection",
        "tc_od",
        "body",
        "bonnet",
        "diaphragm",
        "actuator_moc",
    ],
    "fp_mascon_zdvp_j_type": [
        "variant_type",
        "construction",
        "valve_size",
        "end_connection",
        "tc_od",
        "body",
        "bonnet",
        "diaphragm",
        "actuator_moc",
    ],
    "fp_mascon_prv": [
        "variant_type",
        "valve_size",
        "end_connection",
        "tc_od",
        "inlet_pressure",
        "set_pressure_range",
        "body",
        "diaphragm",
        "seating",
        "temperature",
    ],
    "fp_mascon_angle_sc_flanged": [
        "variant_type",
        "valve_size",
        "end_connection",
        "body",
        "seat",
        "actuator_moc",
    ],
    "fp_mascon_angle_butt_weld": [
        "variant_type",
        "valve_size",
        "end_connection",
        "pipe_od",
        "body",
        "seat",
        "actuator_moc",
    ],
    "fp_mascon_angle_tc_end": [
        "variant_type",
        "valve_size",
        "end_connection",
        "tc_od",
        "body",
        "seat",
        "actuator_moc",
    ],
    "fp_mascon_spare_diaphragm": ["variant_type", "valve_size", "diaphragm", "wheel_moc"],
    "fp_needle_valve": ["variant_type", "valve_size", "end_connection", "pressure", "body", "seat"],
    "fp_nrv_inline_check": [
        "variant_type",
        "valve_size",
        "end_connection",
        "set_pressure",
        "body",
        "stem",
        "seat",
    ],
    "fp_nrv_wafer_check": ["variant_type", "valve_size", "end_connection", "pressure", "body", "seat"],
    "fp_nrv_non_slam": ["variant_type", "valve_size", "end_connection", "pressure", "body"],
    "fp_safety_sv_bsp_f": [
        "variant_type",
        "valve_size",
        "end_connection",
        "set_pressure",
        "body",
        "stem",
        "seat",
    ],
    "fp_safety_sv_tc_end": [
        "variant_type",
        "valve_size",
        "end_connection",
        "set_pressure",
        "body",
        "stem",
        "seat",
    ],
    "fp_safety_sv_flanged_150": [
        "variant_type",
        "valve_size",
        "end_connection",
        "set_pressure",
        "body",
        "stem",
        "seat",
    ],
    "fp_sampling_sv_tc_end": ["variant_type", "valve_size", "end_connection", "pressure", "body", "seat"],
    "fp_sampling_sv_od_base_weld": [
        "variant_type",
        "valve_size",
        "end_connection",
        "pressure",
        "body",
        "seat",
    ],
    "fp_sight_glass_double_window": [
        "variant_type",
        "valve_size",
        "end_connection",
        "pressure",
        "body",
        "packing",
        "glass",
    ],
    "fp_sight_glass_inline_ic_casted": [
        "variant_type",
        "valve_size",
        "length",
        "end_connection",
        "pressure",
        "flange",
        "packing",
        "glass",
    ],
    "fp_sight_glass_inline_solid_flange": [
        "variant_type",
        "valve_size",
        "end_connection",
        "pressure",
        "flange",
        "packing",
        "glass",
    ],
    "fp_strainer_y_150": ["variant_type", "valve_size", "end_connection", "pressure", "body", "mesh"],
    "fp_strainer_y_300": ["variant_type", "valve_size", "end_connection", "pressure", "body", "mesh"],
    "fp_hose_tuder": ["variant_type", "size_id_mm", "temperature_range"],
    "fp_hose_thunder": ["variant_type", "size_id_mm", "temperature_range"],
    "fp_hose_pvc_nylon_non_toxic": ["variant_type", "size_id_mm", "temperature_range"],
    "fp_hose_pvc_nylon_food_grade": ["variant_type", "size_id_mm", "temperature_range"],
    "fp_hose_red_silicon": ["variant_type", "size_id_mm", "temperature_range"],
    "fp_hose_pu": ["variant_type", "wall_thickness", "size_id_mm", "temperature_range"],
}
