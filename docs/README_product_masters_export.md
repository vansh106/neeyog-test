# Product Masters snapshot export

Exports every **Product Masters** sheet from the live database into a folder tree that matches the frontend sidebar (`frontend/lib/masterSidebarNav.ts`).

## Generate a snapshot

From `backend/`:

```bash
python -m db.export_product_masters_snapshot
```

Creates:

- `docs/product_masters_snapshot_YYYY-MM-DD_HH-MM-SS/` — full tree of `.xlsx` files
- `docs/product_masters_snapshot_LATEST.txt` — name of the most recent snapshot folder

Each leaf in the masters sidebar becomes one Excel file at the same folder path as in the UI (e.g. `Valves/Butterfly Valve/.../Hygienic Butterfly Valve Alfa Laval Make.xlsx`).

Re-run this command whenever you change product data in the database to get a fresh dated export.

## After changing the masters navigation

If you edit `frontend/lib/masterSidebarNav.ts`, refresh the leaf manifest first:

```bash
cd frontend && npx tsx scripts/export-master-nav-leaves.ts
```

Then run the export again from `backend/`.
