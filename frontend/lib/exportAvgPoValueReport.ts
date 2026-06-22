import * as XLSX from 'xlsx'

import type { AvgPoValueDimension, AvgPoValueReportResponse, AvgPoValueRow } from '@/lib/api'

export type AvgPoValueExportFormat = 'csv' | 'xlsx'

const EXPORT_HEADERS = [
  'Dimension Name',
  'PO Count',
  'Total Value (INR)',
  'Avg Value (INR)',
  'Min Value (INR)',
  'Max Value (INR)',
  'Value Range (INR)',
] as const

function rowToExportRecord(row: AvgPoValueRow) {
  return {
    'Dimension Name': row.dimension_name,
    'PO Count': row.po_count,
    'Total Value (INR)': row.total_po_value,
    'Avg Value (INR)': row.avg_po_value,
    'Min Value (INR)': row.min_po_value,
    'Max Value (INR)': row.max_po_value,
    'Value Range (INR)': row.value_range,
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

function buildFilename(report: AvgPoValueReportResponse, dimension: AvgPoValueDimension, ext: string) {
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  return `avg-po-value-${dimension}-${from}-${to}.${ext}`
}

export function exportAvgPoValueReport(
  report: AvgPoValueReportResponse,
  rows: AvgPoValueRow[],
  dimension: AvgPoValueDimension,
  format: AvgPoValueExportFormat,
) {
  const dataRows = rows.map(rowToExportRecord)
  const filename = buildFilename(report, dimension, format)

  if (format === 'csv') {
    const sheet = XLSX.utils.json_to_sheet(dataRows, { header: [...EXPORT_HEADERS] })
    const csv = XLSX.utils.sheet_to_csv(sheet)
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }

  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(dataRows, { header: [...EXPORT_HEADERS] })
  XLSX.utils.book_append_sheet(workbook, sheet, dimension)
  XLSX.writeFile(workbook, filename)
}
