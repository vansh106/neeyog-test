import * as XLSX from 'xlsx'

import type { SourceRoiReportResponse, SourceRoiRow } from '@/lib/api'

export type SourceRoiExportFormat = 'csv' | 'xlsx'

function rowToExportRecord(row: SourceRoiRow) {
  return {
    Source: row.source_label,
    Enquiries: row.enquiry_count,
    Quotes: row.quote_count,
    'Quoted Value (INR)': row.quoted_value,
    'POs Won': row.po_count,
    'Won Value (INR)': row.won_value,
    'Win Rate (%)': row.win_rate_pct,
    'Revenue Share (%)': row.revenue_share_pct,
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function exportSourceRoiReport(
  report: SourceRoiReportResponse,
  rows: SourceRoiRow[],
  format: SourceRoiExportFormat,
) {
  const dataRows = rows.map(rowToExportRecord)
  dataRows.push(rowToExportRecord({ ...report.totals, source_label: 'All sources' }))
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  const filename = `source-roi-${from}-${to}.${format === 'csv' ? 'csv' : 'xlsx'}`

  if (format === 'csv') {
    const sheet = XLSX.utils.json_to_sheet(dataRows)
    downloadBlob(new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dataRows), 'Source ROI')
  XLSX.writeFile(workbook, filename)
}
