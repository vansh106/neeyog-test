import * as XLSX from 'xlsx'

import type { ConversionPipelineReportResponse, ConversionPipelineRow } from '@/lib/api'

export type ConversionPipelineExportFormat = 'csv' | 'xlsx'

const EXPORT_COLUMNS: Array<{
  key: Exclude<keyof ConversionPipelineRow, 'is_total' | 'row_key'>
  header: string
}> = [
  { key: 'group_label', header: 'Group' },
  { key: 'enquiry_count', header: 'Enquiry Count' },
  { key: 'quote_count', header: 'Quote Count' },
  { key: 'quoted_value', header: 'Quoted Value (INR)' },
  { key: 'po_count', header: 'PO Count' },
  { key: 'po_value', header: 'PO Value (INR)' },
  { key: 'conversion_pct', header: 'Conversion Rate (%)' },
]

function rowToExportRecord(row: ConversionPipelineRow, groupHeader: string) {
  const record: Record<string, string | number> = {}
  for (const col of EXPORT_COLUMNS) {
    const header = col.key === 'group_label' ? groupHeader : col.header
    const value = row[col.key]
    if (value === undefined) continue
    record[header] = col.key === 'conversion_pct' ? `${value}%` : value
  }
  return record
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildFilename(report: ConversionPipelineReportResponse, ext: string) {
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  return `conversion-pipeline-${report.group_by}-${from}-${to}.${ext}`
}

export function exportConversionPipelineReport(
  report: ConversionPipelineReportResponse,
  rows: ConversionPipelineRow[],
  format: ConversionPipelineExportFormat,
) {
  const groupHeader = report.group_by_label
  const dataRows = rows.map((row) => rowToExportRecord(row, groupHeader))
  dataRows.push(rowToExportRecord({ ...report.totals, is_total: true }, groupHeader))

  const filename = buildFilename(report, format)

  if (format === 'csv') {
    const sheet = XLSX.utils.json_to_sheet(dataRows)
    const csv = XLSX.utils.sheet_to_csv(sheet)
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }

  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(dataRows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'Pipeline Report')
  XLSX.writeFile(workbook, filename)
}
