"""Import Parth master XLSX into per-sheet tables (Option B).

Each worksheet is imported into its corresponding table in db.sheet_models.
The table columns mirror the sheet columns (snake_case) plus:
- row_id (uuid primary key)
- client_id
- created_at / updated_at
"""

import argparse
import asyncio
import logging
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from openpyxl import load_workbook  # noqa: E402
from sqlalchemy import delete  # noqa: E402

from core.database import async_session_factory, init_db  # noqa: E402
from db.sheet_models import SHEET_MODELS  # noqa: E402

logger = logging.getLogger(__name__)


def _norm(v: object | None) -> object | None:
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return s if s else None
    return v


def _to_float(v: object | None) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip()
        if not s or s in {"-", "–", "—"}:
            return None
        s = s.replace(",", "")
        try:
            return float(s)
        except ValueError:
            return None
    return None


def _to_datetime(v: object | None) -> datetime | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    return None


def _row_to_model_kwargs(headers: list[str], row: tuple) -> dict:
    values = {headers[i]: row[i] for i in range(min(len(headers), len(row)))}
    out: dict[str, object | None] = {}

    numeric_keys = {
        "price_inr",
        "gst",
        "p_f",
        "gst_amt_inr",
        "p_f_amt_inr",
        "effective_price_inr",
        "id_mm",
        "id_inch",
        "od_mm",
        "thickness_mm",
        "std_length_m",
        "temp_min_c",
        "temp_max_c",
    }

    # common normalized fields
    for k, v in values.items():
        if k in numeric_keys:
            out[k] = _to_float(v)
        elif k == "price_date":
            out[k] = _to_datetime(v)
        elif k == "id":
            # Sheet "ID" column
            out[k] = int(v) if isinstance(v, (int, float)) else _to_float(v)
        else:
            # For TEXT/VARCHAR columns, always store as string (or null).
            vv = _norm(v)
            if vv is None:
                out[k] = None
            elif isinstance(vv, str):
                out[k] = vv
            else:
                out[k] = str(vv)

    return out


async def import_xlsx_to_sheet_tables(
    file_path: str,
    client_id: str,
    clear_existing: bool = False,
) -> dict[str, int]:
    wb = load_workbook(file_path, data_only=True, read_only=True)
    counts = {"inserted": 0, "deleted": 0, "errors": 0}

    async with async_session_factory() as session:
        if clear_existing:
            for _, model in SHEET_MODELS.values():
                res = await session.execute(delete(model).where(model.client_id == client_id))
                counts["deleted"] += int(res.rowcount or 0)
            await session.commit()

        for sheet_name in wb.sheetnames:
            if sheet_name not in SHEET_MODELS:
                logger.warning("Skipping unknown sheet: %s", sheet_name)
                continue

            _, model = SHEET_MODELS[sheet_name]
            ws = wb[sheet_name]
            it = ws.iter_rows(min_row=1, values_only=True)
            try:
                raw_headers = list(next(it))
            except StopIteration:
                continue

            # Expected headers are already snake_case in our table schema.
            # Convert from the sheet's human headers to our snake_case names.
            # (We reuse the exact mapping we used when inspecting the XLSX.)
            header_map = {}
            for h in raw_headers:
                if h is None:
                    continue
                hs = str(h).strip()
                if not hs:
                    continue
                header_map[hs] = hs

            # Hardcoded mapping based on actual XLSX headers
            H = {
                "ID": "id",
                "Pricelist Title": "pricelist_title",
                "Category": "category",
                "Sub-Category": "sub_category",
                "Product": "product",
                "Product Name": "product_name",
                "Body Material": "body_material",
                "Seat Material": "seat_material",
                "Stem Material": "stem_material",
                "Pressure Rating": "pressure_rating",
                "End Connection": "end_connection",
                "Drilling / Std": "drilling_std",
                "Paint / Finish": "paint_finish",
                "Operator / Config": "operator_config",
                "Operator / Operation": "operator_operation",
                "Size": "size",
                "Disc MOC Variant": "disc_moc_variant",
                "MOC Variant": "moc_variant",
                "Valve Way": "valve_way",
                "Bonnet": "bonnet",
                "Diaphragm": "diaphragm",
                "Seat": "seat",
                "Stem / Spindle": "stem_spindle",
                "Stem Nut": "stem_nut",
                "Compressor": "compressor",
                "Handwheel": "handwheel",
                "Pin": "pin",
                "Stud / Nut / Washer": "stud_nut_washer",
                "Lever": "lever",
                "Max Temp": "max_temp",
                "Actuator": "actuator",
                "MOC / Price Column": "moc_price_column",
                "Design": "design",
                "Hose Family": "hose_family",
                "Size (as printed)": "size_as_printed",
                "ID (mm)": "id_mm",
                "ID (inch)": "id_inch",
                "OD (mm)": "od_mm",
                "Thickness (mm)": "thickness_mm",
                "Std Length (m)": "std_length_m",
                "Temp Min (°C)": "temp_min_c",
                "Temp Max (°C)": "temp_max_c",
                "MOC / Variant": "moc_variant",
                "Price (₹)": "price_inr",
                "Price Unit": "price_unit",
                "GST %": "gst",
                "P&F %": "p_f",
                "GST Amt (₹)": "gst_amt_inr",
                "P&F Amt (₹)": "p_f_amt_inr",
                "Effective Price (₹)": "effective_price_inr",
                "Price Date": "price_date",
                "Source File": "source_file",
            }

            headers = []
            for h in raw_headers:
                hs = str(h).strip() if h is not None else ""
                if not hs:
                    headers.append("")
                    continue
                headers.append(H.get(hs, ""))  # unknown headers ignored

            for row in it:
                if not row or all(v is None or (isinstance(v, str) and not v.strip()) for v in row):
                    continue
                kwargs = _row_to_model_kwargs(headers, row)
                kwargs = {k: v for k, v in kwargs.items() if k}  # drop empty header slots

                obj = model(row_id=uuid.uuid4(), client_id=client_id, **kwargs)
                session.add(obj)
                counts["inserted"] += 1

            await session.commit()

    wb.close()
    return counts


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Import XLSX into per-sheet product tables")
    parser.add_argument("--file", type=str, required=True)
    parser.add_argument("--client", type=str, default="parth_valves")
    parser.add_argument("--clear-existing", action="store_true")
    args = parser.parse_args()

    await init_db()
    counts = await import_xlsx_to_sheet_tables(
        file_path=args.file,
        client_id=args.client,
        clear_existing=args.clear_existing,
    )
    print(f"Deleted {counts['deleted']} rows. Inserted {counts['inserted']}. Errors {counts['errors']}.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_main())

