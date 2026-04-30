"""Import `docs/Butterfly_Valve_All_Combinations.xlsx` into `catalog_butterfly_valve`.

This workbook uses a single sheet with headers:
  Sr No, Variant Type, Construction, Valve Size, End Connection, Pressure, Body, Disc, Stem, Seat

It does not include Bore Type / Fasteners / Price — those are stored as NULL in the catalog.

Usage (from repo `backend/` directory):
  python -m db.import_butterfly_valve_combinations --dry-run
  python -m db.import_butterfly_valve_combinations
  python -m db.import_butterfly_valve_combinations --allow-duplicates
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import uuid
from pathlib import Path

from openpyxl import load_workbook
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.database import async_session_factory, init_db  # noqa: E402
from db.sheet_models import CatalogButterflyValveRow  # noqa: E402

logger = logging.getLogger(__name__)

DEFAULT_FILE = Path(__file__).resolve().parents[2] / "docs" / "Butterfly_Valve_All_Combinations.xlsx"

# Header cell (row 1) -> possible labels from the sheet (case-insensitive match)
HEADER_ALIASES: dict[str, tuple[str, ...]] = {
    "sr_no": ("sr no", "sr. no.", "sr_no"),
    "variant_type": ("variant type", "type"),
    "construction": ("construction",),
    "valve_size": ("valve size", "size"),
    "end_connection": ("end connection",),
    "pressure": ("pressure",),
    "body": ("body",),
    "ball_disc": ("disc", "ball (disc)", "ball_disc", "ball/disc"),
    "stem": ("stem",),
    "seat": ("seat",),
}


def _norm_header(s: object | None) -> str:
    if s is None:
        return ""
    return str(s).strip().lower()


def _to_float(v: object | None) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        t = v.strip().replace(",", "")
        if not t or t in {"-", "–", "—"}:
            return None
        try:
            return float(t)
        except ValueError:
            return None
    return None


def _to_str(v: object | None) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _normalize_valve_size(raw: object | None) -> str | None:
    """Match cascade / masters conventions: numeric mm → DN{mm}, else trimmed string."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        if isinstance(raw, float) and raw.is_integer():
            raw = int(raw)
        if isinstance(raw, int):
            return f"DN{raw}"
        # non-integer float — stringify
        s = str(raw).strip()
        return s if s else None
    s = str(raw).strip()
    if not s:
        return None
    # plain integer string → DN
    if s.isdigit():
        return f"DN{int(s)}"
    return s


def _build_column_index(header_row: tuple[object | None, ...]) -> dict[str, int]:
    """Map canonical field name -> 0-based column index."""
    lowered = [_norm_header(h) for h in header_row]
    out: dict[str, int] = {}
    for field, aliases in HEADER_ALIASES.items():
        for i, cell in enumerate(lowered):
            if not cell:
                continue
            if cell in aliases:
                out[field] = i
                break
    return out


def _natural_key_fields() -> tuple[str, ...]:
    return (
        "variant_type",
        "construction",
        "valve_size",
        "bore_type",
        "end_connection",
        "pressure",
        "body",
        "ball_disc",
        "stem",
        "seat",
        "fasteners",
    )


def _kwargs_from_row(row: tuple, col_ix: dict[str, int]) -> dict[str, object | None] | None:
    def cell(field: str) -> object | None:
        if field not in col_ix:
            return None
        i = col_ix[field]
        if i >= len(row):
            return None
        return row[i]

    sr = _to_float(cell("sr_no"))
    variant_type = _to_str(cell("variant_type"))
    construction = _to_str(cell("construction"))
    valve_size = _normalize_valve_size(cell("valve_size"))
    end_connection = _to_str(cell("end_connection"))
    pressure = _to_str(cell("pressure"))
    body = _to_str(cell("body"))
    ball_disc = _to_str(cell("ball_disc"))
    stem = _to_str(cell("stem"))
    seat = _to_str(cell("seat"))

    if not variant_type and not construction and not valve_size:
        return None

    return {
        "sr_no": sr,
        "variant_type": variant_type,
        "construction": construction,
        "valve_size": valve_size,
        "bore_type": None,
        "end_connection": end_connection,
        "pressure": pressure,
        "body": body,
        "ball_disc": ball_disc,
        "stem": stem,
        "seat": seat,
        "fasteners": None,
        "source_file": "Butterfly_Valve_All_Combinations.xlsx",
    }


async def _load_existing_keys(session, client_id: str) -> set[tuple]:
    fields = _natural_key_fields()
    cols = [getattr(CatalogButterflyValveRow, f) for f in fields]
    res = await session.execute(
        select(*cols).where(CatalogButterflyValveRow.client_id == client_id),
    )
    out: set[tuple] = set()
    for tup in res.all():
        out.add(tuple(_to_str(x) if x is not None else None for x in tup))
    return out


def _natural_key(kwargs: dict[str, object | None]) -> tuple:
    return (
        kwargs.get("variant_type"),
        kwargs.get("construction"),
        kwargs.get("valve_size"),
        kwargs.get("bore_type"),
        kwargs.get("end_connection"),
        kwargs.get("pressure"),
        kwargs.get("body"),
        kwargs.get("ball_disc"),
        kwargs.get("stem"),
        kwargs.get("seat"),
        kwargs.get("fasteners"),
    )


def dry_run_parse_file(file_path: Path) -> dict[str, int]:
    """Parse workbook only (no database). Dedupes duplicate rows within the file."""
    if not file_path.is_file():
        raise FileNotFoundError(str(file_path))

    counts = {"inserted": 0, "skipped_blank": 0, "skipped_dup_file": 0}
    seen_file: set[tuple] = set()

    wb = load_workbook(file_path, data_only=True, read_only=True)
    try:
        ws = wb.active
        rows_iter = ws.iter_rows(min_row=1, values_only=True)
        try:
            raw_headers = next(rows_iter)
        except StopIteration:
            return counts

        col_ix = _build_column_index(raw_headers)
        required = (
            "variant_type",
            "construction",
            "valve_size",
            "end_connection",
            "pressure",
            "body",
            "ball_disc",
            "seat",
        )
        missing = [k for k in required if k not in col_ix]
        if missing:
            raise ValueError(f"Missing required columns in row 1: {missing}. Found headers: {raw_headers}")

        for row in rows_iter:
            if not row or all(v is None or (isinstance(v, str) and not str(v).strip()) for v in row):
                counts["skipped_blank"] += 1
                continue
            kwargs = _kwargs_from_row(row, col_ix)
            if not kwargs:
                counts["skipped_blank"] += 1
                continue
            key_parts = _natural_key(kwargs)
            if key_parts in seen_file:
                counts["skipped_dup_file"] += 1
                continue
            seen_file.add(key_parts)
            counts["inserted"] += 1
        return counts
    finally:
        wb.close()


async def import_butterfly_combinations_to_db(
    file_path: Path,
    client_id: str,
    *,
    skip_duplicates: bool,
) -> dict[str, int]:
    if not file_path.is_file():
        raise FileNotFoundError(str(file_path))

    wb = load_workbook(file_path, data_only=True, read_only=True)
    try:
        ws = wb.active
        rows_iter = ws.iter_rows(min_row=1, values_only=True)
        try:
            raw_headers = next(rows_iter)
        except StopIteration:
            return {
                "inserted": 0,
                "skipped_blank": 0,
                "skipped_dup_file": 0,
                "skipped_dup_db": 0,
            }

        col_ix = _build_column_index(raw_headers)
        required = (
            "variant_type",
            "construction",
            "valve_size",
            "end_connection",
            "pressure",
            "body",
            "ball_disc",
            "seat",
        )
        missing = [k for k in required if k not in col_ix]
        if missing:
            raise ValueError(f"Missing required columns in row 1: {missing}. Found headers: {raw_headers}")

        counts = {"inserted": 0, "skipped_blank": 0, "skipped_dup_file": 0, "skipped_dup_db": 0}
        seen_file: set[tuple] = set()

        async with async_session_factory() as session:
            existing_db: set[tuple] = set()
            if skip_duplicates:
                existing_db = await _load_existing_keys(session, client_id)

            for row in rows_iter:
                if not row or all(v is None or (isinstance(v, str) and not str(v).strip()) for v in row):
                    counts["skipped_blank"] += 1
                    continue
                kwargs = _kwargs_from_row(row, col_ix)
                if not kwargs:
                    counts["skipped_blank"] += 1
                    continue

                key_parts = _natural_key(kwargs)
                if key_parts in seen_file:
                    counts["skipped_dup_file"] += 1
                    continue
                seen_file.add(key_parts)

                if skip_duplicates and key_parts in existing_db:
                    counts["skipped_dup_db"] += 1
                    continue

                obj = CatalogButterflyValveRow(row_id=uuid.uuid4(), client_id=client_id, **kwargs)
                session.add(obj)
                counts["inserted"] += 1
                existing_db.add(key_parts)

            await session.commit()

        return counts
    finally:
        wb.close()


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Import Butterfly_Valve_All_Combinations.xlsx into catalog")
    parser.add_argument("--file", type=str, default=str(DEFAULT_FILE))
    parser.add_argument("--client", type=str, default="parth_valves")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--allow-duplicates",
        action="store_true",
        help="Insert even when the same combination already exists in DB / file",
    )
    args = parser.parse_args()

    path = Path(args.file)
    if args.dry_run:
        counts = dry_run_parse_file(path)
        print(
            f"[DRY-RUN] file={path} (no DB)\n"
            f"  rows_to_insert: {counts['inserted']}\n"
            f"  skipped_blank: {counts['skipped_blank']}\n"
            f"  skipped_dup_file: {counts['skipped_dup_file']}",
        )
        return

    await init_db()
    counts = await import_butterfly_combinations_to_db(
        path,
        args.client,
        skip_duplicates=not args.allow_duplicates,
    )
    print(
        f"[IMPORT] file={path} client={args.client}\n"
        f"  inserted: {counts['inserted']}\n"
        f"  skipped_blank: {counts['skipped_blank']}\n"
        f"  skipped_dup_file: {counts['skipped_dup_file']}\n"
        f"  skipped_dup_db: {counts.get('skipped_dup_db', 0)}",
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_main())
