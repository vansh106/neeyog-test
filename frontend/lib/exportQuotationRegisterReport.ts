import * as XLSX from 'xlsx'

import type { QuotationRegisterReportResponse, QuotationRegisterRow } from '@/lib/api'
import { quotationRegisterStatusLabel } from '@/lib/quotationRegisterStatus'

export type QuotationRegisterExportFormat = 'csv' | 'xlsx'

const EXPORT_HEADERS = [
  'Quote Ref',
  'Date Raised',
  'Customer Name',
  'Product / Category',
  'Category',
  'Quoted Value (INR)',
  'Quote Status',
  'Salesperson',
  'Expiry Date',
] as const

function rowToExportRecord(row: QuotationRegisterRow) {
  return {
    'Quote Ref': row.quote_ref,
    'Date Raised': row.date_raised ?? '',
    'Customer Name': row.customer_name,
    'Product / Category': row.product,
    Category: row.category,
    'Quoted Value (INR)': row.quoted_value,
    'Quote Status': quotationRegisterStatusLabel(row.display_status),
    Salesperson: row.salesperson,
    'Expiry Date': row.expiry_date ?? '',
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

function buildFilename(report: QuotationRegisterReportResponse, ext: string) {
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  return `quotation-register-${from}-${to}.${ext}`
}

export function exportQuotationRegisterReport(
  report: QuotationRegisterReportResponse,
  rows: QuotationRegisterRow[],
  format: QuotationRegisterExportFormat,
) {
  const dataRows = rows.map(rowToExportRecord)
  const filename = buildFilename(report, format)

  if (format === 'csv') {
    const sheet = XLSX.utils.json_to_sheet(dataRows, { header: [...EXPORT_HEADERS] })
    const csv = XLSX.utils.sheet_to_csv(sheet)
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }

  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(dataRows, { header: [...EXPORT_HEADERS] })
  XLSX.utils.book_append_sheet(workbook, sheet, 'Quotation Register')
  XLSX.writeFile(workbook, filename)
}
