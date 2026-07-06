import { collectQuotationLineProducts } from '@/lib/quotationLineStatusSummaries'
import { quotationCrmLabel } from '@/lib/quotationCrmStatus'
import {
  downloadListingExcelWorkbook,
  formatListingExportDate,
  formatListingExportFollowUp,
  listingExportFilename,
  type ListingExcelColumn,
} from '@/lib/listingExportExcel'
import {
  filterItemsByCreatedAt,
  listingExportRangeLabel,
  type ListingExportRange,
} from '@/lib/listingExportRange'
import type { QuotationListItem } from '@/types'

const COLUMNS: ListingExcelColumn[] = [
  { header: 'S.No.', key: 'serial', width: 8 },
  { header: 'Quotation No.', key: 'quote_number', width: 14 },
  { header: 'Enquiry No.', key: 'enquiry_number', width: 14 },
  { header: 'Client Name', key: 'client_name', width: 20 },
  { header: 'Client Company', key: 'client_company', width: 22 },
  { header: 'Date', key: 'date', width: 14 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Sub-Category', key: 'sub_category', width: 20 },
  { header: 'Product Description', key: 'description', width: 42 },
  { header: 'Quantity', key: 'quantity', width: 10 },
  { header: 'Unit Price (₹)', key: 'unit_price', width: 14 },
  { header: 'Product Status', key: 'line_status', width: 14 },
  { header: 'Next Follow-up', key: 'next_follow_up', width: 14 },
  { header: 'Created By', key: 'created_by', width: 16 },
  { header: 'Line Total (₹)', key: 'line_total', width: 14 },
  { header: 'Discount (₹)', key: 'discount', width: 12 },
  { header: 'Sub-total (₹)', key: 'subtotal', width: 14 },
  { header: 'Taxes & Charges (₹)', key: 'taxes_charges', width: 16 },
  { header: 'Grand Total (₹)', key: 'grand_total', width: 14 },
]

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export async function exportQuotationsListingExcel(
  quotations: QuotationListItem[],
  range: ListingExportRange,
): Promise<void> {
  const filtered = filterItemsByCreatedAt(quotations, range)
  if (filtered.length === 0) {
    throw new Error('No quotations found for the selected time period')
  }

  const rows: Record<string, string | number>[] = []
  const groupIndices: number[] = []
  let serial = 0

  filtered.forEach((q, qIndex) => {
    const products = collectQuotationLineProducts(q)
    const descLines = q.item_desc_lines ?? []
    const catLines = q.category_lines ?? []
    const taxesCharges = roundMoney(Math.max(0, (q.total_amount ?? 0) - (q.subtotal ?? 0)))

    const lineProducts =
      products.length > 0
        ? products
        : [
            {
              line_index: 0,
              label: q.item_desc_short || 'Product',
              quantity: 1,
              line_total: q.subtotal ?? q.total_amount ?? 0,
              status: 'ongoing' as const,
              status_remarks: q.status_remarks ?? null,
            },
          ]

    lineProducts.forEach((p, lineIdx) => {
      serial += 1
      const cat = catLines[p.line_index] ?? catLines[0]
      const desc = descLines[p.line_index]?.full ?? descLines[p.line_index]?.short ?? p.label
      const unitPrice = p.quantity > 0 ? roundMoney(p.line_total / p.quantity) : 0
      const isFirst = lineIdx === 0

      rows.push({
        serial,
        quote_number: q.quote_number,
        enquiry_number: q.enquiry_number ?? '',
        client_name: q.client_name,
        client_company: q.client_company ?? '',
        date: formatListingExportDate(q.created_at),
        category: cat?.category ?? q.category_label ?? q.primary_category ?? '',
        sub_category: cat?.sub_category ?? q.sub_category ?? '',
        description: desc,
        quantity: p.quantity,
        unit_price: unitPrice,
        line_status: quotationCrmLabel(p.status),
        next_follow_up: formatListingExportFollowUp(q.next_follow_up_date),
        created_by: q.created_by_name ?? '',
        line_total: roundMoney(p.line_total),
        discount: '',
        subtotal: isFirst ? roundMoney(q.subtotal ?? 0) : '',
        taxes_charges: isFirst ? taxesCharges : '',
        grand_total: isFirst ? roundMoney(q.total_amount ?? 0) : '',
      })
      groupIndices.push(qIndex)
    })
  })

  await downloadListingExcelWorkbook({
    sheetName: 'Quotations',
    filename: listingExportFilename('quotations', listingExportRangeLabel(range)),
    columns: COLUMNS,
    rows,
    groupIndexForRow: (rowIndex) => groupIndices[rowIndex] ?? rowIndex,
  })
}
