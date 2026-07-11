import {
  downloadListingExcelWorkbook,
  formatListingExportDate,
  listingExportFilename,
  type ListingExcelColumn,
} from '@/lib/listingExportExcel'
import {
  filterItemsByCreatedAt,
  listingExportRangeLabel,
  type ListingExportRange,
} from '@/lib/listingExportRange'
import type { PurchaseOrderExportLine, PurchaseOrderListItem } from '@/types'

const COLUMNS: ListingExcelColumn[] = [
  { header: 'S.No.', key: 'serial', width: 8 },
  { header: 'Customer', key: 'customer', width: 26 },
  { header: 'Type / Quote Ref', key: 'type_quote_ref', width: 20 },
  { header: 'Category', key: 'category', width: 16 },
  { header: 'Item Description', key: 'item_desc', width: 48 },
  { header: 'PO ₹', key: 'po_amount', width: 14 },
  { header: 'SO No.', key: 'so_number', width: 14 },
  { header: 'SO Date', key: 'so_date', width: 14 },
  { header: 'User', key: 'user', width: 16 },
  { header: 'Grand Total (₹)', key: 'grand_total', width: 14 },
]

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function poExportLines(po: PurchaseOrderListItem): PurchaseOrderExportLine[] {
  if (po.export_lines?.length) return po.export_lines
  return [
    {
      description: po.item_desc_short || '—',
      quantity: 1,
      unit_price: po.subtotal,
      line_total: po.subtotal,
    },
  ]
}

function customerLabel(po: PurchaseOrderListItem): string {
  const name = po.client_name?.trim() || '—'
  const company = po.client_company?.trim()
  return company ? `${name} — ${company}` : name
}

function typeQuoteRef(po: PurchaseOrderListItem): string {
  if (po.po_type === 'quoted' && po.quote_number) {
    return `Quoted / ${po.quote_number}`
  }
  return po.po_type === 'quoted' ? 'Quoted' : 'Non-quoted'
}

export async function exportPurchaseOrdersListingExcel(
  purchaseOrders: PurchaseOrderListItem[],
  range: ListingExportRange,
): Promise<void> {
  const filtered = filterItemsByCreatedAt(purchaseOrders, range)
  if (filtered.length === 0) {
    throw new Error('No purchase orders found for the selected time period')
  }

  const rows: Record<string, string | number>[] = []
  const groupIndices: number[] = []
  let serial = 0

  filtered.forEach((po, poIndex) => {
    const lines = poExportLines(po)
    lines.forEach((line, lineIdx) => {
      serial += 1
      const isFirst = lineIdx === 0
      rows.push({
        serial,
        customer: customerLabel(po),
        type_quote_ref: typeQuoteRef(po),
        category: po.primary_category || '—',
        item_desc: line.description,
        po_amount: roundMoney(line.line_total),
        so_number: isFirst ? po.so_number ?? '' : '',
        so_date: isFirst ? formatListingExportDate(po.so_date) : '',
        user: isFirst ? po.created_by_name ?? '' : '',
        grand_total: isFirst ? roundMoney(po.total_amount ?? 0) : '',
      })
      groupIndices.push(poIndex)
    })
  })

  await downloadListingExcelWorkbook({
    sheetName: 'Purchase Orders',
    filename: listingExportFilename('purchase-orders', listingExportRangeLabel(range)),
    columns: COLUMNS,
    rows,
    groupIndexForRow: (rowIndex) => groupIndices[rowIndex] ?? rowIndex,
  })
}
