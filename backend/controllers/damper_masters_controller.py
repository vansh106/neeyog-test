"""HTTP handlers for Dampers matrix masters."""

from fastapi import HTTPException

from services.damper_schema import (
    get_damper_full_schema,
    is_damper_catalog_key,
    list_damper_sheets,
)


async def handle_list_sheets() -> dict:
    return {"items": list_damper_sheets()}


async def handle_get_schema(catalog_key: str) -> dict:
    if not is_damper_catalog_key(catalog_key):
        raise HTTPException(status_code=404, detail=f"Unknown damper sheet: {catalog_key}")
    return get_damper_full_schema(catalog_key)
