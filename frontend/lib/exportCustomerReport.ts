import * as XLSX from 'xlsx'

import type { CustomerReportResponse, CustomerReportRow } from '@/lib/api'

export type CustomerReportExportFormat = 'csv' | 'xlsx'

function rowToExportRecord(row: CustomerReportRow) {
  return {
    'Customer Name': row.customer_name,
    Tier: row.customer_tier_label,
    Enquiries: row.enquiry_count,
    Quotes: row.quote_count,
    'Quoted Value (INR)': row.quoted_value,
    POs: row.po_count,
    'PO Value (INR)': row.po_value,
    'Win Rate (%)': row.win_rate_pct,
    'Last Activity': row.last_activity_date ?? '',
    'Primary Source': row.primary_source_label,
    'Primary Category': row.primary_category,
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

export function exportCustomerReport(
  report: CustomerReportResponse,
  rows: CustomerReportRow[],
  format: CustomerReportExportFormat,
) {
  const dataRows = rows.map(rowToExportRecord)
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  const filename = `customer-report-${from}-${to}.${format === 'csv' ? 'csv' : 'xlsx'}`

  if (format === 'csv') {
    const sheet = XLSX.utils.json_to_sheet(dataRows)
    downloadBlob(new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataRows), 'Customers')
  XLSX.writeFile(wb, filename)
}
