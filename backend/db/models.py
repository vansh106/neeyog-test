import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ClientCompany(Base):
    __tablename__ = "client_companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_config: Mapped[str] = mapped_column(String(100), nullable=False, default="parth_valves", index=True)

    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    gst_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)

    erp_code: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    is_erp_synced: Mapped[bool] = mapped_column(Boolean, default=False)

    source: Mapped[str] = mapped_column(String(50), default="manual")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    total_enquiry_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    branches: Mapped[list["ClientBranch"]] = relationship(
        "ClientBranch",
        back_populates="company",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ClientBranch(Base):
    __tablename__ = "client_branches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    branch_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_headquarters: Mapped[bool] = mapped_column(Boolean, default=False)

    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="India")

    branch_erp_code: Mapped[str | None] = mapped_column(String(100), nullable=True)

    enquiry_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    company: Mapped["ClientCompany"] = relationship("ClientCompany", back_populates="branches")


class Enquiry(Base):
    __tablename__ = "enquiries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_config: Mapped[str] = mapped_column(String(100), nullable=False, default="parth_valves")
    raw_input: Mapped[str] = mapped_column(Text, nullable=False)
    input_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="received")

    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    erp_export_path: Mapped[str | None] = mapped_column(String, nullable=True)

    company: Mapped["ClientCompany | None"] = relationship("ClientCompany")
    branch: Mapped["ClientBranch | None"] = relationship("ClientBranch")
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


class QuotationProductHistory(Base):
    """Searchable snapshot of quoted product pricing per quote line."""

    __tablename__ = "quotation_product_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quotations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    enquiry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enquiries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_config: Mapped[str] = mapped_column(String(100), nullable=False, default="parth_valves", index=True)

    quote_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    quoted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_company: Mapped[str | None] = mapped_column(String(255), nullable=True)

    line_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    line_total: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="INR")

    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    catalog_table: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    catalog_row_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)

    variant_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    construction: Mapped[str | None] = mapped_column(Text, nullable=True)
    valve_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    pressure: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    ball_disc: Mapped[str | None] = mapped_column(Text, nullable=True)
    stem: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat: Mapped[str | None] = mapped_column(Text, nullable=True)

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


class Supplier(Base):
    """Vendor that supplies catalog products at negotiated list prices + discounts."""

    __tablename__ = "suppliers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[str] = mapped_column(String(100), nullable=False, default="parth_valves", index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    primary_category_key: Mapped[str] = mapped_column(String(100), nullable=False, default="all", index=True)
    contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Legacy: discount moved to supplier-category pricing. Kept for back-compat migrations.
    default_discount_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_preferred: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    prices: Mapped[list["SupplierProductPrice"]] = relationship(
        "SupplierProductPrice",
        back_populates="supplier",
        cascade="all, delete-orphan",
    )
    category_pricing: Mapped[list["SupplierCategoryPricing"]] = relationship(
        "SupplierCategoryPricing",
        back_populates="supplier",
        cascade="all, delete-orphan",
    )


class SupplierProductPrice(Base):
    """List price from a supplier for one catalog row (polymorphic by catalog_table + catalog_row_id)."""

    __tablename__ = "supplier_product_prices"
    __table_args__ = (
        UniqueConstraint("supplier_id", "catalog_table", "catalog_row_id", name="uq_supplier_product"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    catalog_table: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    catalog_row_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    list_price_inr: Mapped[float] = mapped_column(Float, nullable=False)
    discount_pct_override: Mapped[float | None] = mapped_column(Float, nullable=True)

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="prices")

    @property
    def effective_discount_pct(self) -> float:
        """Discount Parth gets from supplier for this line (override or supplier default)."""
        if self.discount_pct_override is not None:
            return float(self.discount_pct_override)
        if self.supplier is not None:
            return float(self.supplier.default_discount_pct)
        return 0.0

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class SupplierCategoryPricing(Base):
    """Supplier-specific pricing variables, scoped per category (default = 'all')."""

    __tablename__ = "supplier_category_pricing"
    __table_args__ = (
        UniqueConstraint("supplier_id", "category_key", name="uq_supplier_category_pricing"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_key: Mapped[str] = mapped_column(String(100), nullable=False, default="all", index=True)

    # The 3 variables: margin, supplier discount, customer discount.
    margin_multiplier: Mapped[float | None] = mapped_column(Float, nullable=True)
    supplier_discount_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    customer_discount_pct: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="category_pricing")


class ClientPricingConfig(Base):
    """Per-tenant (string client_id) margin + default customer discount + default supplier."""

    __tablename__ = "client_pricing_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)

    margin_multiplier: Mapped[float] = mapped_column(Float, nullable=False, default=1.4)
    default_customer_discount_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    default_supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    default_supplier: Mapped["Supplier | None"] = relationship("Supplier")
