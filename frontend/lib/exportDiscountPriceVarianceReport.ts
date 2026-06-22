import * as XLSX from 'xlsx'

import type { DiscountPriceVarianceReportResponse, DiscountPriceVarianceRow } from '@/lib/api'
import { approvalStatusLabel } from '@/lib/discountVariance'

export type DiscountPriceVarianceExportFormat = 'csv' | 'xlsx'

const EXPORT_HEADERS = [
  'PO Reference',
  'Quote Ref',
  'Customer Name',
  'Product / Category',
  'Category',
  'List Price (INR)',
  'Quoted Price (INR)',
  'Final PO Price (INR)',
  'Discount %',
  'Variance % (PO vs Quoted)',
  'Salesperson',
  'Approval Status',
] as const

function rowToExportRecord(row: DiscountPriceVarianceRow) {
  return {
    'PO Reference': row.reference,
    'Quote Ref': row.quote_ref,
    'Customer Name': row.customer_name,
    'Product / Category': row.product,
    Category: row.category,
    'List Price (INR)': row.list_price,
    'Quoted Price (INR)': row.quoted_price,
    'Final PO Price (INR)': row.final_po_price,
    'Discount %': row.discount_pct,
    'Variance % (PO vs Quoted)': row.variance_pct,
    Salesperson: row.salesperson,
    'Approval Status': approvalStatusLabel(row.approval_status),
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

function buildFilename(report: DiscountPriceVarianceReportResponse, ext: string) {
  const from = report.date_from.replace(/-/g, '')
  const to = report.date_to.replace(/-/g, '')
  return `discount-price-variance-${from}-${to}.${ext}`
}

export function exportDiscountPriceVarianceReport(
  report: DiscountPriceVarianceReportResponse,
  rows: DiscountPriceVarianceRow[],
  format: DiscountPriceVarianceExportFormat,
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
  XLSX.utils.book_append_sheet(workbook, sheet, 'Discount Variance')
  XLSX.writeFile(workbook, filename)
}
