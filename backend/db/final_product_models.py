"""ORM models for `docs/Final_Products/*.xlsx` — one table per worksheet (except butterfly/ball).

Butterfly products use `CatalogButterflyValveRow` with final table names in
`sheet_models.py`. All other final sheets use `FinalProductSheetMarker`
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
    packing: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    packing: Mapped[str | None] = mapped_column(Text, nullable=True)
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


class _CatalogFpFittingsStandardColumns:
    """Shared columns for Fittings_Products.xlsx sheets."""

    __abstract__ = True

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection_1: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection_2: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_mm: Mapped[str | None] = mapped_column(Text, nullable=True)
    hose_nipple_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    hose_cap_moc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpFittingsSmsNutRow(_CatalogFpFittingsStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_fittings_sms_nut"

    sms_nut_moc: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpFittingsTriCloverEndRow(_CatalogFpFittingsStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_fittings_tri_clover_end"

    tc_od: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpFittingsDinNut11851Row(_CatalogFpFittingsStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_fittings_din_nut_11851"

    din_nut_moc: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpFittingsSwivelNutRow(_CatalogFpFittingsStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_fittings_swivel_nut"

    swivel_nut_moc: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpFittingsFlange150Row(_CatalogFpFittingsStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_fittings_flange_150"

    flange_nut_moc: Mapped[str | None] = mapped_column(Text, nullable=True)


class _CatalogFpBallValveStandardColumns:
    """Shared columns for Ball_Valve_Products.xlsx sheets."""

    __abstract__ = True

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    bore_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    ball: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpBallValveCasco1PieceMultiEndRow(
    _CatalogFpBallValveStandardColumns, FinalProductSheetMarker, _FinalCatalogBase
):
    __tablename__ = "catalog_fp_ball_valve_casco_1_piece_multi_end"


class CatalogFpBallValveCasco1PieceFlangedRow(
    _CatalogFpBallValveStandardColumns, FinalProductSheetMarker, _FinalCatalogBase
):
    __tablename__ = "catalog_fp_ball_valve_casco_1_piece_flanged"


class CatalogFpBallValveCasco2PieceRow(
    _CatalogFpBallValveStandardColumns, FinalProductSheetMarker, _FinalCatalogBase
):
    __tablename__ = "catalog_fp_ball_valve_casco_2_piece"


class CatalogFpBallValveCasco3PieceRow(
    _CatalogFpBallValveStandardColumns, FinalProductSheetMarker, _FinalCatalogBase
):
    __tablename__ = "catalog_fp_ball_valve_casco_3_piece"


class CatalogFpBallValveCasco3PieceExtStemRow(
    _CatalogFpBallValveStandardColumns, FinalProductSheetMarker, _FinalCatalogBase
):
    __tablename__ = "catalog_fp_ball_valve_casco_3_piece_ext_stem"


class CatalogFpBallValveCasco3Piece3WayLPortRow(
    _CatalogFpBallValveStandardColumns, FinalProductSheetMarker, _FinalCatalogBase
):
    __tablename__ = "catalog_fp_ball_valve_casco_3_piece_3_way_l_port"


class CatalogFpBallValveUnison1PieceMultiEndRow(
    _CatalogFpBallValveStandardColumns, FinalProductSheetMarker, _FinalCatalogBase
):
    __tablename__ = "catalog_fp_ball_valve_unison_1_piece_multi_end"


class CatalogFpBallValveUnison2PieceIsoPadsRow(
    _CatalogFpBallValveStandardColumns, FinalProductSheetMarker, _FinalCatalogBase
):
    __tablename__ = "catalog_fp_ball_valve_unison_2_piece_iso_pads"


class CatalogFpBallValveUnison3PieceRow(
    _CatalogFpBallValveStandardColumns, FinalProductSheetMarker, _FinalCatalogBase
):
    __tablename__ = "catalog_fp_ball_valve_unison_3_piece"


class CatalogFpBallValveUnison3Piece3WayLPortRow(
    _CatalogFpBallValveStandardColumns, FinalProductSheetMarker, _FinalCatalogBase
):
    __tablename__ = "catalog_fp_ball_valve_unison_3_piece_3_way_l_port"


class _CatalogFpFbvStandardColumns:
    """Shared columns for Flush_Bottom_Valve_Products workbook (Price column → supplier only)."""

    __abstract__ = True

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    bore_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    ball: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpFbvBallTypeRow(_CatalogFpFbvStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_fbv_ball_type"


class CatalogFpFbvYTypeRow(_CatalogFpFbvStandardColumns, FinalProductSheetMarker, _FinalCatalogBase):
    __tablename__ = "catalog_fp_fbv_y_type"


class CatalogFpAluminiumFoilRow(FinalProductSheetMarker, _FinalCatalogBase):
    """Aluminium foil packaging — one row per product spec (suppliers via ``supplier_product_prices``)."""

    __tablename__ = "catalog_fp_aluminium_foil"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_unit: Mapped[str | None] = mapped_column(Text, nullable=True)
    dimensions: Mapped[str | None] = mapped_column(Text, nullable=True)
    weight_grade: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    hsn_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    std_pack: Mapped[str | None] = mapped_column(Text, nullable=True)
    pack_unit: Mapped[str | None] = mapped_column(Text, nullable=True)
    canonical_sku: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogFpPaperProductsRow(FinalProductSheetMarker, _FinalCatalogBase):
    """Paper cups, lids, containers, plates — suppliers via ``supplier_product_prices``."""

    __tablename__ = "catalog_fp_paper_products"

    sr_no: Mapped[float | None] = mapped_column(Float, nullable=True)
    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    gsm: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_unit: Mapped[str | None] = mapped_column(Text, nullable=True)
    diameter_top: Mapped[str | None] = mapped_column(Text, nullable=True)
    diameter_bt: Mapped[str | None] = mapped_column(Text, nullable=True)
    height: Mapped[str | None] = mapped_column(Text, nullable=True)
    dimensions: Mapped[str | None] = mapped_column(Text, nullable=True)
    hsn_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    rate_per: Mapped[str | None] = mapped_column(Text, nullable=True)
    std_pack: Mapped[str | None] = mapped_column(Text, nullable=True)
    pack_unit: Mapped[str | None] = mapped_column(Text, nullable=True)
    movement: Mapped[str | None] = mapped_column(Text, nullable=True)
    primary_godown: Mapped[str | None] = mapped_column(Text, nullable=True)
    canonical_sku: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
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
    ("fp_fittings_sms_nut", CatalogFpFittingsSmsNutRow),
    ("fp_fittings_tri_clover_end", CatalogFpFittingsTriCloverEndRow),
    ("fp_fittings_din_nut_11851", CatalogFpFittingsDinNut11851Row),
    ("fp_fittings_swivel_nut", CatalogFpFittingsSwivelNutRow),
    ("fp_fittings_flange_150", CatalogFpFittingsFlange150Row),
    ("fp_ball_valve_casco_1_piece_multi_end", CatalogFpBallValveCasco1PieceMultiEndRow),
    ("fp_ball_valve_casco_1_piece_flanged", CatalogFpBallValveCasco1PieceFlangedRow),
    ("fp_ball_valve_casco_2_piece", CatalogFpBallValveCasco2PieceRow),
    ("fp_ball_valve_casco_3_piece", CatalogFpBallValveCasco3PieceRow),
    ("fp_ball_valve_casco_3_piece_ext_stem", CatalogFpBallValveCasco3PieceExtStemRow),
    ("fp_ball_valve_casco_3_piece_3_way_l_port", CatalogFpBallValveCasco3Piece3WayLPortRow),
    ("fp_ball_valve_unison_1_piece_multi_end", CatalogFpBallValveUnison1PieceMultiEndRow),
    ("fp_ball_valve_unison_2_piece_iso_pads", CatalogFpBallValveUnison2PieceIsoPadsRow),
    ("fp_ball_valve_unison_3_piece", CatalogFpBallValveUnison3PieceRow),
    ("fp_ball_valve_unison_3_piece_3_way_l_port", CatalogFpBallValveUnison3Piece3WayLPortRow),
    ("fp_fbv_ball_type", CatalogFpFbvBallTypeRow),
    ("fp_fbv_y_type", CatalogFpFbvYTypeRow),
    ("fp_aluminium_foil", CatalogFpAluminiumFoilRow),
    ("fp_paper_products", CatalogFpPaperProductsRow),
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
    "fp_fittings_sms_nut": "Fittings — SMS nut",
    "fp_fittings_tri_clover_end": "Fittings — Tri-Clover end",
    "fp_fittings_din_nut_11851": "Fittings — DIN nut 11851",
    "fp_fittings_swivel_nut": "Fittings — Swivel nut",
    "fp_fittings_flange_150": "Fittings — Flange #150",
    "fp_ball_valve_casco_1_piece_multi_end": "Ball valve — Casco 1-piece (multi-end)",
    "fp_ball_valve_casco_1_piece_flanged": "Ball valve — Casco 1-piece (flanged)",
    "fp_ball_valve_casco_2_piece": "Ball valve — Casco 2-piece",
    "fp_ball_valve_casco_3_piece": "Ball valve — Casco 3-piece",
    "fp_ball_valve_casco_3_piece_ext_stem": "Ball valve — Casco 3-piece (ext. stem)",
    "fp_ball_valve_casco_3_piece_3_way_l_port": "Ball valve — Casco 3-piece (3-way L-port)",
    "fp_ball_valve_unison_1_piece_multi_end": "Ball valve — Unison 1-piece (multi-end)",
    "fp_ball_valve_unison_2_piece_iso_pads": "Ball valve — Unison 2-piece (ISO pads)",
    "fp_ball_valve_unison_3_piece": "Ball valve — Unison 3-piece",
    "fp_ball_valve_unison_3_piece_3_way_l_port": "Ball valve — Unison 3-piece (3-way L-port)",
    "fp_fbv_ball_type": "FBV — Ball Type",
    "fp_fbv_y_type": "FBV — Y Type",
    "fp_aluminium_foil": "Aluminium Foil",
    "fp_paper_products": "Paper Products",
    "fp_damper_butterfly": "Butterfly Damper",
    "fp_damper_multi_louver": "Multi-Louver Damper",
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
    "fp_strainer_y_150": [
        "variant_type",
        "valve_size",
        "end_connection",
        "pressure",
        "body",
        "mesh",
        "packing",
    ],
    "fp_strainer_y_300": [
        "variant_type",
        "valve_size",
        "end_connection",
        "pressure",
        "body",
        "mesh",
        "packing",
    ],
    "fp_hose_tuder": ["variant_type", "size_id_mm", "temperature_range"],
    "fp_hose_thunder": ["variant_type", "size_id_mm", "temperature_range"],
    "fp_hose_pvc_nylon_non_toxic": ["variant_type", "size_id_mm", "temperature_range"],
    "fp_hose_pvc_nylon_food_grade": ["variant_type", "size_id_mm", "temperature_range"],
    "fp_hose_red_silicon": ["variant_type", "size_id_mm", "temperature_range"],
    "fp_hose_pu": ["variant_type", "wall_thickness", "size_id_mm", "temperature_range"],
    "fp_fittings_sms_nut": [
        "variant_type",
        "end_connection_1",
        "end_connection_2",
        "size_mm",
        "hose_nipple_moc",
        "hose_cap_moc",
        "sms_nut_moc",
    ],
    "fp_fittings_tri_clover_end": [
        "variant_type",
        "end_connection_1",
        "end_connection_2",
        "size_mm",
        "tc_od",
        "hose_nipple_moc",
        "hose_cap_moc",
    ],
    "fp_fittings_din_nut_11851": [
        "variant_type",
        "end_connection_1",
        "end_connection_2",
        "size_mm",
        "hose_nipple_moc",
        "hose_cap_moc",
        "din_nut_moc",
    ],
    "fp_fittings_swivel_nut": [
        "variant_type",
        "end_connection_1",
        "end_connection_2",
        "size_mm",
        "hose_nipple_moc",
        "hose_cap_moc",
        "swivel_nut_moc",
    ],
    "fp_fittings_flange_150": [
        "variant_type",
        "end_connection_1",
        "end_connection_2",
        "size_mm",
        "hose_nipple_moc",
        "hose_cap_moc",
        "flange_nut_moc",
    ],
    "fp_ball_valve_casco_1_piece_multi_end": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "rating",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_ball_valve_casco_1_piece_flanged": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "rating",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_ball_valve_casco_2_piece": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "rating",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_ball_valve_casco_3_piece": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "rating",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_ball_valve_casco_3_piece_ext_stem": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "rating",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_ball_valve_casco_3_piece_3_way_l_port": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "rating",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_ball_valve_unison_1_piece_multi_end": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "rating",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_ball_valve_unison_2_piece_iso_pads": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "rating",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_ball_valve_unison_3_piece": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "rating",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_ball_valve_unison_3_piece_3_way_l_port": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "rating",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_fbv_ball_type": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "pressure",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_fbv_y_type": [
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "pressure",
        "body",
        "ball",
        "stem",
        "seat",
    ],
    "fp_aluminium_foil": [
        "size_value",
        "size_unit",
        "weight_grade",
        "product_name",
        "dimensions",
    ],
    "fp_paper_products": [
        "size_value",
        "gsm",
        "diameter_top",
        "product_name",
    ],
}
