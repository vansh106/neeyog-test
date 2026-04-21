import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Enquiry(Base):
    __tablename__ = "enquiries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_config: Mapped[str] = mapped_column(String(100), nullable=False, default="parth_valves")
    raw_input: Mapped[str] = mapped_column(Text, nullable=False)
    input_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="received")

    # Client identification (resolved during pipeline, before quoting)
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_records.id"),
        nullable=True,
    )
    erp_export_path: Mapped[str | None] = mapped_column(String, nullable=True)

    client: Mapped["ClientRecord | None"] = relationship()
    parsed_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    matched_products: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    missing_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    flow_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    processing_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    processing_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Tracks when background processing started and finished

    quotations: Mapped[list["Quotation"]] = relationship(back_populates="enquiry")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class Quotation(Base):
    __tablename__ = "quotations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enquiry_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("enquiries.id"), nullable=False)
    quote_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    line_items: Mapped[dict] = mapped_column(JSON, nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, nullable=False)
    gst_rate: Mapped[float] = mapped_column(Float, nullable=False, default=18.0)
    gst_amount: Mapped[float] = mapped_column(Float, nullable=False)
    pf_rate: Mapped[float] = mapped_column(Float, nullable=False, default=3.0)
    pf_amount: Mapped[float] = mapped_column(Float, nullable=False)
    freight_note: Mapped[str] = mapped_column(String(255), nullable=False, default="Extra at actual")
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    validity_days: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    enquiry: Mapped["Enquiry"] = relationship(back_populates="quotations")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="marketing")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class EmailSyncState(Base):
    """Singleton row (id=1). `baseline_at` set after first sync run — only mail after that is parsed."""

    __tablename__ = "email_sync_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    baseline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ProcessedEmail(Base):
    __tablename__ = "processed_emails"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    sender_email: Mapped[str] = mapped_column(String, nullable=False)
    sender_name: Mapped[str | None] = mapped_column(String, nullable=True)
    subject: Mapped[str | None] = mapped_column(String, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    enquiry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("enquiries.id"), nullable=True
    )
    was_processed: Mapped[bool] = mapped_column(Boolean, default=True)
    filter_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    performed_by: Mapped[str] = mapped_column(String(255), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ClientRecord(Base):
    __tablename__ = "client_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Core identity
    company_name: Mapped[str] = mapped_column(String, nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str] = mapped_column(String, default="India")

    # ERP integration fields
    # TODO: Populate from ERP when integration is ready
    erp_code: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    is_erp_synced: Mapped[bool] = mapped_column(Boolean, default=False)

    # Source of this record
    source: Mapped[str] = mapped_column(String, default="email_parsed")

    enquiry_count: Mapped[int] = mapped_column(Integer, default=1)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
