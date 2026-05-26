import * as XLSX from 'xlsx'

import { mastersApi } from '@/lib/api'
import type { MastersSheetRowsParams } from '@/lib/queries'

/** Matches masters category table: omit internal / metadata columns from exports. */
export const MASTERS_SHEET_EXPORT_HIDE_COLUMNS = new Set([
  'source_file',
  'row_id',
  'client_id',
  'created_at',
  'updated_at',
  'price_inr',
])

const SHEET_ROWS_PAGE = 200

export type MastersSheetRowsPayload = {
  sheet: string
  columns: string[]
  total: number
  skip: number
  limit: number
  items: Record<string, unknown>[]
}

function prettifyHeader(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

export function visibleMastersExportColumns(columns: string[]): string[] {
  return columns.filter((c) => !MASTERS_SHEET_EXPORT_HIDE_COLUMNS.has(String(c)))
}

/** Fetches every row for a sheet (API pages at 200). */
export async function fetchAllMastersSheetRows(
  sheet: string,
  filters?: Omit<MastersSheetRowsParams, 'skip' | 'limit'>,
): Promise<{
  columns: string[]
  items: Record<string, unknown>[]
}> {
  const all: Record<string, unknown>[] = []
  let columns: string[] = []
  let skip = 0

  for (;;) {
    const res = await mastersApi.listSheetRows<MastersSheetRowsPayload>(sheet, {
      skip,
      limit: SHEET_ROWS_PAGE,
      ...filters,
    })
    columns = res.columns ?? []
    const chunk = res.items ?? []
    all.push(...chunk)
    if (chunk.length < SHEET_ROWS_PAGE || all.length >= (res.total ?? 0)) break
    skip += SHEET_ROWS_PAGE
  }

  return { columns, items: all }
}

/** Builds an .xlsx and triggers a browser download. */
export function downloadMastersSheetXlsx(
  sheetKey: string,
  columns: string[],
  items: Record<string, unknown>[],
): void {
  const cols = visibleMastersExportColumns(columns)
  const headerLabels = cols.map(prettifyHeader)

  const rows = items.map((row) => {
    const o: Record<string, string | number> = {}
    for (let i = 0; i < cols.length; i++) {
      const key = cols[i]
      const label = headerLabels[i]
      const raw = row[key]
      if (raw == null || raw === '') {
        o[label] = ''
      } else if (typeof raw === 'number' && Number.isFinite(raw)) {
        o[label] = raw
      } else {
        o[label] = String(raw)
      }
    }
    return o
  })

  const ws =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([headerLabels])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Masters')

  const safe = sheetKey.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'masters'
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `masters_${safe}_${stamp}.xlsx`)
}
