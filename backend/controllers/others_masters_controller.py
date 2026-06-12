"""HTTP handlers for dynamic Others masters."""

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from services import others_masters_service


async def handle_get_tree(db: AsyncSession) -> dict:
    try:
        items = await others_masters_service.get_tree(db)
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_create_category(db: AsyncSession, name: str) -> dict:
    try:
        return await others_masters_service.create_category(db, name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_update_category(db: AsyncSession, category_id: str, name: str) -> dict:
    try:
        return await others_masters_service.update_category(db, category_id, name)
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e).lower() else 400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_delete_category(db: AsyncSession, category_id: str) -> dict:
    try:
        await others_masters_service.delete_category(db, category_id)
        return {"deleted": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_create_sheet(db: AsyncSession, category_id: str, name: str) -> dict:
    try:
        return await others_masters_service.create_sheet(db, category_id, name)
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e).lower() else 400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_update_sheet(db: AsyncSession, sheet_id: str, name: str) -> dict:
    try:
        return await others_masters_service.update_sheet(db, sheet_id, name)
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e).lower() else 400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_delete_sheet(db: AsyncSession, sheet_id: str) -> dict:
    try:
        await others_masters_service.delete_sheet(db, sheet_id)
        return {"deleted": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_list_rows(db: AsyncSession, sheet_id: str) -> dict:
    try:
        items = await others_masters_service.list_rows(db, sheet_id)
        return {"items": items}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_create_row(
    db: AsyncSession,
    sheet_id: str,
    *,
    sr_no: float | None,
    description: str | None,
    price_inr: float | None,
) -> dict:
    try:
        return await others_masters_service.create_row(
            db,
            sheet_id,
            sr_no=sr_no,
            description=description,
            price_inr=price_inr,
        )
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e).lower() else 400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_update_row(
    db: AsyncSession,
    row_id: str,
    *,
    sr_no: float | None,
    description: str | None,
    price_inr: float | None,
    clear_sr_no: bool,
    clear_price: bool,
) -> dict:
    try:
        return await others_masters_service.update_row(
            db,
            row_id,
            sr_no=sr_no,
            description=description,
            price_inr=price_inr,
            clear_sr_no=clear_sr_no,
            clear_price=clear_price,
        )
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e).lower() else 400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def handle_delete_row(db: AsyncSession, row_id: str) -> dict:
    try:
        await others_masters_service.delete_row(db, row_id)
        return {"deleted": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
