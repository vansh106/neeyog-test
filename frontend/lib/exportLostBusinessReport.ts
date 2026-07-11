import * as XLSX from 'xlsx'

import type { LostBusinessReportResponse, LostBusinessRow } from '@/lib/api'

export type LostBusinessExportFormat = 'csv' | 'xlsx'

function rowToExportRecord(row: LostBusinessRow) {
  return {
    'Quote Ref': row.quote_ref,
    Customer: row.customer_name,
    'Product / Category': row.product,
    Category: row.category,
    'Quoted Value (INR)': row.quoted_value,
    'Loss Date': row.loss_date ?? '',
    'Loss Reason': row.loss_reason ?? '',
    Competitor: row.competitor ?? '',
    Salesperson: row.salesperson,
    'Stage Lost At': row.stage_lost_at_label,
    Notes: row.notes ?? '',
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

export function exportLostBusinessReport(
  report: LostBusinessReportResponse,
  rows: LostBusinessRow[],
  format: LostBusinessExportFormat,
) {
  const dataRows = rows.map(rowToExportRecord)
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  const filename = `lost-business-report-${from}-${to}.${format === 'csv' ? 'csv' : 'xlsx'}`

  if (format === 'csv') {
    const sheet = XLSX.utils.json_to_sheet(dataRows)
    downloadBlob(new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataRows), 'Lost Business')
  XLSX.writeFile(wb, filename)
}
