import * as XLSX from 'xlsx'

import type { SoHandoffReportResponse, SoHandoffRow } from '@/lib/api'

export type SoHandoffExportFormat = 'csv' | 'xlsx'

function rowToExportRecord(row: SoHandoffRow) {
  return {
    'PO Reference': row.po_reference,
    'Customer Name': row.customer_name,
    'PO Value (INR)': row.po_value,
    'PO Date': row.po_date ?? '',
    'SO Created': row.so_created ? 'Yes' : 'No',
    'SO Number': row.so_number ?? '',
    'SO Creation Date': row.so_creation_date ?? '',
    'Days to Handoff': row.days_to_handoff ?? '',
    'Handoff Owner': row.handoff_owner,
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportSoHandoffReport(
  report: SoHandoffReportResponse,
  rows: SoHandoffRow[],
  format: SoHandoffExportFormat,
) {
  const dataRows = rows.map(rowToExportRecord)
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  const filename = `so-handoff-${from}-${to}.${format === 'csv' ? 'csv' : 'xlsx'}`

  if (format === 'csv') {
    const sheet = XLSX.utils.json_to_sheet(dataRows)
    downloadBlob(new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataRows), 'SO Handoff')
  XLSX.writeFile(wb, filename)
}
