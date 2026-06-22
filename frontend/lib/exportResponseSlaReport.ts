import * as XLSX from 'xlsx'

import type { ResponseSlaReportResponse, ResponseSlaRow } from '@/lib/api'
import { slaMet } from '@/lib/slaResponse'

export type ResponseSlaExportFormat = 'csv' | 'xlsx'

function rowToExportRecord(row: ResponseSlaRow, targetHours: number) {
  const met = slaMet(row.response_hours, targetHours)
  return {
    'Enquiry Ref': row.enquiry_ref,
    'Customer Name': row.customer_name,
    Category: row.category,
    'Received At': row.received_at,
    'Quote Sent At': row.quote_sent_at,
    'Response Time (h)': row.response_hours,
    Salesperson: row.salesperson,
    'SLA Met': met ? 'Yes' : 'No',
    'SLA Target (h)': targetHours,
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

export function exportResponseSlaReport(
  report: ResponseSlaReportResponse,
  rows: ResponseSlaRow[],
  targetHours: number,
  format: ResponseSlaExportFormat,
) {
  const dataRows = rows.map((row) => rowToExportRecord(row, targetHours))
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  const filename = `response-sla-report-${from}-${to}.${format === 'csv' ? 'csv' : 'xlsx'}`

  if (format === 'csv') {
    const sheet = XLSX.utils.json_to_sheet(dataRows)
    downloadBlob(new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataRows), 'Response SLA')
  XLSX.writeFile(wb, filename)
}
