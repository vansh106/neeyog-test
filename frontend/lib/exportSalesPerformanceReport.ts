import * as XLSX from 'xlsx'

import type { SalesPerformanceByUserReportResponse, SalesPerformanceUserRow } from '@/lib/api'

export type SalesPerformanceExportFormat = 'csv' | 'xlsx'

function rowToExportRecord(row: SalesPerformanceUserRow, rank?: number) {
  return {
    Rank: rank ?? '',
    Salesperson: row.salesperson_name,
    'Enquiries Handled': row.enquiry_count,
    'Quotes Sent': row.quote_count,
    'Quoted Value (INR)': row.quoted_value,
    'POs Won': row.po_count,
    'Won Value (INR)': row.won_value,
    'Win Rate (%)': row.win_rate_pct,
    'Avg Response Time (h)': row.avg_response_hours ?? '',
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

export function exportSalesPerformanceReport(
  report: SalesPerformanceByUserReportResponse,
  rows: SalesPerformanceUserRow[],
  format: SalesPerformanceExportFormat,
) {
  const dataRows = rows.map((row, i) => rowToExportRecord(row, i + 1))
  dataRows.push(rowToExportRecord({ ...report.totals, salesperson_name: 'Team total' }))
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  const filename = `sales-performance-by-user-${from}-${to}.${format === 'csv' ? 'csv' : 'xlsx'}`

  if (format === 'csv') {
    const sheet = XLSX.utils.json_to_sheet(dataRows)
    downloadBlob(new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dataRows), 'Sales Performance')
  XLSX.writeFile(workbook, filename)
}
