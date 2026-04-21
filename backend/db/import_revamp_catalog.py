"""Import `docs/parth_valve_revamp_sheet.xlsx` (or any same-layout workbook) into catalog_* tables.

Usage (from backend/):
  python -m db.import_revamp_catalog --file ../docs/parth_valve_revamp_sheet.xlsx --client parth_valves
  python -m db.import_revamp_catalog --file ../docs/parth_valve_revamp_sheet.xlsx --clear-existing
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import uuid
from pathlib import Path

from openpyxl import load_workbook
from sqlalchemy import delete

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.database import async_session_factory, init_db  # noqa: E402
from db.sheet_models import EXCEL_SHEET_TO_MODEL  # noqa: E402

logger = logging.getLogger(__name__)

TITLE_ROW_SHEETS = frozenset({"Limit switch Box", "Positioner"})


def _to_float(v: object | None) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace(",", "")
        if not s or s in {"-", "–", "—"}:
            return None
        try:
            return float(s)
        except ValueError:
            return None
    return None


def _to_str(v: object | None) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


HEADER_MAP_BUTTERFLY: dict[str, str] = {
    "Sr No": "sr_no",
    "Type": "variant_type",
    "Construction": "construction",
    "Valve Size": "valve_size",
    "Bore Type": "bore_type",
    "End Connection": "end_connection",
    "Pressure": "pressure",
    "Body": "body",
    "Ball (Disc)": "ball_disc",
    "Stem": "stem",
    "Seat": "seat",
    "Fasteners": "fasteners",
    "Price (₹)": "price_inr",
    "Source File": "source_file",
}

HEADER_MAP_BALL: dict[str, str] = {
    **{k: v for k, v in HEADER_MAP_BUTTERFLY.items() if k != "Ball (Disc)"},
    "Ball": "ball",
}

HEADER_MAP_OPERATOR: dict[str, str] = {
    "Operator for": "operator_for",
    "Construct": "construct",
    "Size": "size_text",
    "Model Name": "model_name",
    "Base Price": "price_inr",
}

HEADER_MAP_BRACKETS: dict[str, str] = {
    "Operator": "bracket_operator",
    "Construct": "construct",
    "Size": "size_text",
    "Price": "price_inr",
}

HEADER_MAP_TABULAR: dict[str, str] = {
    "Sr. No.": "sr_no",
    "Sr No": "sr_no",
    "Type": "variant_type",
    "Price in Rs.": "price_inr",
}


def _header_map_for_sheet(sheet_name: str, model_key: str) -> dict[str, str]:
    if model_key == "butterfly_valve":
        return HEADER_MAP_BUTTERFLY
    if model_key == "ball_valve":
        return HEADER_MAP_BALL
    if model_key == "operator":
        return HEADER_MAP_OPERATOR
    if model_key == "brackets_coupler":
        return HEADER_MAP_BRACKETS
    if model_key in ("sov", "limit_switch_box", "positioner"):
        return HEADER_MAP_TABULAR
    return {}


def _header_row_index(sheet_name: str) -> int:
    return 2 if sheet_name in TITLE_ROW_SHEETS else 1


def _row_dict(header_fields: list[str | None], row: tuple, header_map: dict[str, str]) -> dict:
    out: dict[str, object | None] = {}
    for i, raw in enumerate(row):
        if i >= len(header_fields):
            break
        label = header_fields[i]
        if not label:
            continue
        field = header_map.get(str(label).strip())
        if not field:
            continue
        if field == "sr_no":
            out[field] = _to_float(raw)
        elif field == "price_inr":
            out[field] = _to_float(raw)
        else:
            out[field] = _to_str(raw)
    return out


async def import_revamp_workbook(
    file_path: str,
    client_id: str,
    clear_existing: bool = False,
) -> dict[str, int]:
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(file_path)

    wb = load_workbook(path, data_only=True, read_only=True)
    counts = {"inserted": 0, "deleted": 0, "errors": 0}

    async with async_session_factory() as session:
        if clear_existing:
            for _, model in EXCEL_SHEET_TO_MODEL.values():
                res = await session.execute(delete(model).where(model.client_id == client_id))
                counts["deleted"] += int(res.rowcount or 0)
            await session.commit()

        for sheet_name, (model_key, model) in EXCEL_SHEET_TO_MODEL.items():
            if sheet_name not in wb.sheetnames:
                logger.warning("Workbook missing expected sheet: %s", sheet_name)
                continue

            ws = wb[sheet_name]
            header_row = _header_row_index(sheet_name)
            rows_iter = ws.iter_rows(min_row=header_row, values_only=True)
            try:
                raw_headers = next(rows_iter)
            except StopIteration:
                continue

            header_map = _header_map_for_sheet(sheet_name, model_key)
            header_fields: list[str | None] = []
            for h in raw_headers:
                if h is None:
                    header_fields.append(None)
                else:
                    header_fields.append(str(h).strip())

            for row in rows_iter:
                if not row or all(v is None or (isinstance(v, str) and not str(v).strip()) for v in row):
                    continue
                kwargs = _row_dict(header_fields, row, header_map)
                if not kwargs:
                    continue
                obj = model(row_id=uuid.uuid4(), client_id=client_id, **kwargs)
                session.add(obj)
                counts["inserted"] += 1

            await session.commit()
            logger.info("Imported sheet %s (%s) -> %s", sheet_name, model_key, model.__tablename__)

    wb.close()
    return counts


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Import Parth revamp catalog XLSX into catalog_* tables")
    parser.add_argument(
        "--file",
        type=str,
        default=str((Path(__file__).resolve().parents[2] / "docs" / "parth_valve_revamp_sheet.xlsx")),
        help="Path to XLSX (default: ../docs/parth_valve_revamp_sheet.xlsx from repo root)",
    )
    parser.add_argument("--client", type=str, default="parth_valves")
    parser.add_argument("--clear-existing", action="store_true")
    args = parser.parse_args()

    await init_db()
    counts = await import_revamp_workbook(
        file_path=args.file,
        client_id=args.client,
        clear_existing=args.clear_existing,
    )
    print(f"Deleted {counts['deleted']} rows. Inserted {counts['inserted']}. Errors {counts['errors']}.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_main())
