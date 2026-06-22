import type { PurchaseOrder, PurchaseOrderLineItem, QuotationLineItem } from '@/types'
import {
  clampDiscountPct,
  initialQuotedLinePricing,
  resolveQuotedLineBaseUnitPrice,
} from '@/lib/poQuotedLinePricing'

export type QuotedLineState = {
  selected: boolean
  quantity: number
  unit_price: number
  quoted_unit_price: number
  base_unit_price: number
  customer_discount_pct: number
}

function lineKey(line: PurchaseOrderLineItem | QuotationLineItem): string {
  const cr = (line.catalog_row_id || '').toString().trim()
  const ct = (line.catalog_table || '').toString().trim()
  if (cr && ct) return `${ct}:${cr}`
  const name = (line.product_name || line.description || '').split('\n')[0].trim()
  return name
}

export function buildQuotedLineStateFromPo(
  po: PurchaseOrder,
  quoteLines: QuotationLineItem[],
): Record<number, QuotedLineState> {
  const usedPoIndices = new Set<number>()
  const next: Record<number, QuotedLineState> = {}

  quoteLines.forEach((line, idx) => {
    let poLine: PurchaseOrderLineItem | undefined

    const byIndex = po.line_items.find((li, liIdx) => {
      if (usedPoIndices.has(liIdx)) return false
      const qIdx = (li as PurchaseOrderLineItem & { quotation_line_index?: number }).quotation_line_index
      return qIdx === idx
    })
    if (byIndex) {
      const liIdx = po.line_items.indexOf(byIndex)
      if (liIdx >= 0) usedPoIndices.add(liIdx)
      poLine = byIndex
    }

    if (!poLine) {
      const key = lineKey(line)
      poLine = po.line_items.find((li, liIdx) => {
        if (usedPoIndices.has(liIdx)) return false
        return lineKey(li) === key
      })
      if (poLine) {
        const liIdx = po.line_items.indexOf(poLine)
        if (liIdx >= 0) usedPoIndices.add(liIdx)
      }
    }

    const pricing = poLine
      ? {
          quantity: poLine.quantity ?? line.quantity ?? 1,
          unit_price: poLine.unit_price ?? line.unit_price ?? 0,
          quoted_unit_price:
            poLine.quoted_unit_price ?? line.unit_price ?? poLine.unit_price ?? 0,
          base_unit_price: resolveQuotedLineBaseUnitPrice(poLine),
          customer_discount_pct: clampDiscountPct(poLine.customer_discount_pct ?? 0),
        }
      : {
          ...initialQuotedLinePricing(line),
          quantity: line.quantity ?? 1,
        }

    next[idx] = {
      selected: Boolean(poLine),
      ...pricing,
    }
  })

  return next
}

export function quotedLineStateToPayload(state: Record<number, QuotedLineState>) {
  return Object.entries(state)
    .filter(([, v]) => v.selected)
    .map(([idx, v]) => ({
      line_index: Number(idx),
      quantity: v.quantity,
      unit_price: v.unit_price,
      quoted_unit_price: v.quoted_unit_price,
      customer_discount_pct: v.customer_discount_pct,
    }))
}
