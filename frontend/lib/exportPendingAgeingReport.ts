import * as XLSX from 'xlsx'

import type { PendingAgeingReportResponse, PendingAgeingRow } from '@/lib/api'

export type PendingAgeingExportFormat = 'csv' | 'xlsx'

function rowToExportRecord(row: PendingAgeingRow) {
  return {
    Reference: row.reference,
    Type: row.item_type,
    Customer: row.customer_name,
    'Product / Category': row.product,
    Category: row.category,
    'Quoted Value (INR)': row.quoted_value,
    Stage: row.stage_label,
    'Created Date': row.created_date,
    'Last Activity': row.last_activity_date ?? '',
    'Age (days)': row.age_days,
    'Ageing Bucket': row.ageing_bucket_label,
    Salesperson: row.salesperson,
    'Next Action Due': row.next_action_due ?? 'No date',
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

export function exportPendingAgeingReport(
  report: PendingAgeingReportResponse,
  rows: PendingAgeingRow[],
  format: PendingAgeingExportFormat,
) {
  const dataRows = rows.map(rowToExportRecord)
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  const filename = `pending-ageing-report-${from}-${to}.${format === 'csv' ? 'csv' : 'xlsx'}`

  if (format === 'csv') {
    const sheet = XLSX.utils.json_to_sheet(dataRows)
    downloadBlob(new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataRows), 'Pending Ageing')
  XLSX.writeFile(wb, filename)
}
