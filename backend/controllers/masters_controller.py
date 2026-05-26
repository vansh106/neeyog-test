"""Request handling for master data (products, client config).

Receives validated data from routers, calls services, and shapes HTTP responses.
Catches service exceptions and converts them into appropriate HTTP status codes.
"""

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ProductNotFoundError
from services import masters_service


async def handle_list_products(
    db: AsyncSession,
    category: str | None = None,
    skip: int = 0,
    limit: int = 500,
) -> list[dict]:
    try:
        return await masters_service.list_products(db, category=category, skip=skip, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_get_product(product_id: str, db: AsyncSession) -> dict:
    try:
        return await masters_service.get_product(product_id, db)
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_get_client_config() -> dict:
    try:
        return await masters_service.get_client_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_list_sheet_rows(
    db: AsyncSession,
    sheet: str,
    skip: int = 0,
    limit: int = 50,
    variant_type: str | None = None,
    variant_contains: str | None = None,
    variant_exclude_contains: str | None = None,
    variant_contains_any: str | None = None,
    model_name_prefix: str | None = None,
) -> dict:
    try:
        return await masters_service.list_sheet_rows(
            db,
            sheet=sheet,
            skip=skip,
            limit=limit,
            variant_type=variant_type,
            variant_contains=variant_contains,
            variant_exclude_contains=variant_exclude_contains,
            variant_contains_any=variant_contains_any,
            model_name_prefix=model_name_prefix,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_clients_dropdown(db: AsyncSession, search: str | None) -> list[dict]:
    try:
        return await masters_service.get_clients_for_dropdown(search, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_product_categories(db: AsyncSession) -> list[dict]:
    try:
        return await masters_service.get_product_categories(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_product_subcategories(db: AsyncSession, category: str) -> list[str]:
    try:
        return await masters_service.get_product_subcategories(category, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_product_sizes(db: AsyncSession, category: str, subcategory: str | None) -> list[dict]:
    try:
        return await masters_service.get_products_for_size_dropdown(category, subcategory, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_product_materials(db: AsyncSession, category: str) -> list[str]:
    try:
        return await masters_service.get_product_materials(category, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def handle_cascade_schema(category: str) -> list[dict]:
    try:
        return masters_service.get_cascade_schema(category)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_cascade_values(
    db: AsyncSession, category: str, field: str, filters: dict[str, str]
) -> dict:
    try:
        values = await masters_service.get_cascade_distinct_field_values(category, field, filters, db)
        return {"values": values}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_cascade_match(db: AsyncSession, category: str, filters: dict[str, str]) -> dict:
    try:
        products = await masters_service.get_cascade_matching_products(category, filters, db)
        return {"count": len(products), "products": products}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_cascade_rows(
    db: AsyncSession, category: str, filters: dict[str, str], limit: int = 200
) -> dict:
    try:
        return await masters_service.get_cascade_matching_rows(category, filters, db, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



