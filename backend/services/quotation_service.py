"""Quotation business logic — retrieval, PDF lookup, listing.

Pure service — no FastAPI imports, no HTTPException.
Raises only from core.exceptions.
"""

from pathlib import Path

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from core.exceptions import ProductNotFoundError, QuotationBuildError
from db.models import Quotation, QuotationProductHistory


async def get_quotation(quotation_id: str, db: AsyncSession) -> Quotation:
    """Fetch a quotation by ID. Raises ProductNotFoundError if missing."""
    result = await db.execute(
        select(Quotation).where(Quotation.id == quotation_id)
    )
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise ProductNotFoundError(f"Quotation {quotation_id} not found")
    return quotation


async def get_quotation_pdf_path(quotation_id: str, db: AsyncSession) -> str:
    """Return the absolute PDF file path for a quotation.

    Raises ProductNotFoundError if quotation doesn't exist.
    Raises QuotationBuildError if PDF not yet generated or file missing.
    """
    quotation = await get_quotation(quotation_id, db)

    if not quotation.pdf_path:
        raise QuotationBuildError(f"PDF not yet generated for quotation {quotation_id}")

    pdf = Path(quotation.pdf_path)
    if not pdf.exists():
        raise QuotationBuildError(f"PDF file missing on disk: {quotation.pdf_path}")

    return str(pdf.resolve())


async def list_quotations(
    db: AsyncSession,
    limit: int = 50,
    offset: int = 0,
) -> list[Quotation]:
    """Return list of quotations ordered by creation date."""
    result = await db.execute(
        select(Quotation)
        .order_by(Quotation.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_product_quote_history(
    db: AsyncSession,
    *,
    category: str,
    catalog_table: str | None = None,
    catalog_row_id: str | None = None,
    variant_type: str | None = None,
    construction: str | None = None,
    valve_size: str | None = None,
    end_connection: str | None = None,
    pressure: str | None = None,
    body: str | None = None,
    ball_disc: str | None = None,
    stem: str | None = None,
    seat: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, list[QuotationProductHistory]]:
    settings = get_settings()
    conds = [QuotationProductHistory.client_config == settings.ACTIVE_CLIENT]

    cat_norm = category.strip().lower() if category else ""
    if cat_norm:
        conds.append(QuotationProductHistory.category == cat_norm)

    # Preferred exact lookup (works across all categories if catalog ids are present).
    use_catalog_lookup = False
    if catalog_table and catalog_row_id:
        try:
            import uuid as _uuid

            row_uuid = _uuid.UUID(str(catalog_row_id))
        except Exception:
            row_uuid = None
        if row_uuid is not None:
            conds.append(QuotationProductHistory.catalog_table == catalog_table.strip().lower())
            conds.append(QuotationProductHistory.catalog_row_id == row_uuid)
            use_catalog_lookup = True

    def add_if(field, value: str | None) -> None:
        if value is not None and value.strip() != "":
            conds.append(field == value.strip())

    if not use_catalog_lookup:
        add_if(QuotationProductHistory.variant_type, variant_type)
        add_if(QuotationProductHistory.construction, construction)
        add_if(QuotationProductHistory.valve_size, valve_size)
        add_if(QuotationProductHistory.end_connection, end_connection)
        add_if(QuotationProductHistory.pressure, pressure)
        add_if(QuotationProductHistory.body, body)
        add_if(QuotationProductHistory.ball_disc, ball_disc)
        add_if(QuotationProductHistory.stem, stem)
        add_if(QuotationProductHistory.seat, seat)

    where_clause = and_(*conds)
    total = (
        await db.execute(
            select(func.count(QuotationProductHistory.id)).where(where_clause),
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(QuotationProductHistory)
            .where(where_clause)
            .order_by(QuotationProductHistory.quoted_at.desc(), QuotationProductHistory.created_at.desc())
            .offset(max(0, offset))
            .limit(min(max(1, limit), 100)),
        )
    ).scalars().all()
    return int(total or 0), list(rows)
