"""Quotation business logic — retrieval, PDF lookup, listing.

Pure service — no FastAPI imports, no HTTPException.
Raises only from core.exceptions.
"""

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ProductNotFoundError, QuotationBuildError
from db.models import Quotation


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
