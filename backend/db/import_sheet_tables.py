"""Legacy entry point — delegates to `import_revamp_catalog`.

The Parth catalog is imported from the revamp workbook layout
(`docs/parth_valve_revamp_sheet.xlsx` by default).
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.database import init_db  # noqa: E402
from db.import_revamp_catalog import import_revamp_workbook  # noqa: E402


async def import_xlsx_to_sheet_tables(
    file_path: str,
    client_id: str,
    clear_existing: bool = False,
) -> dict[str, int]:
    return await import_revamp_workbook(
        file_path=file_path,
        client_id=client_id,
        clear_existing=clear_existing,
    )


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Import Parth catalog XLSX (revamp layout)")
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
