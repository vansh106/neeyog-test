import type { QuotationLineStatusProduct, QuotationLineStatusSummary, QuotationListItem } from '@/types'
import { QUOTATION_CRM_STATUSES, type QuotationCrmStatus } from '@/lib/quotationCrmStatus'

export type QuotationLineStatusProductRow = QuotationLineStatusProduct & {
  status: QuotationCrmStatus
}

const EMPTY_SUMMARY = (total: number): QuotationLineStatusSummary => ({
  count: 0,
  total_lines: total,
  products: [],
})

/** Fallback when API omits summaries (older backend) — treat whole quote as one line. */
export function resolveLineStatusSummaries(
  q: QuotationListItem,
): Record<QuotationCrmStatus, QuotationLineStatusSummary> {
  if (q.line_status_summaries) {
    return q.line_status_summaries
  }
  const total = 1
  const st = (QUOTATION_CRM_STATUSES.includes(q.status as QuotationCrmStatus)
    ? q.status
    : 'ongoing') as QuotationCrmStatus
  const base: Record<QuotationCrmStatus, QuotationLineStatusSummary> = {
    ongoing: EMPTY_SUMMARY(total),
    po_received: EMPTY_SUMMARY(total),
    lost: EMPTY_SUMMARY(total),
  }
  base[st] = {
    count: 1,
    total_lines: total,
    products: [
      {
        line_index: 0,
        label: q.item_desc_short || 'Product',
        quantity: 1,
        line_total: q.total_amount,
        status_remarks: q.status_remarks ?? null,
      },
    ],
  }
  return base
}

export function collectQuotationLineProducts(q: QuotationListItem): QuotationLineStatusProductRow[] {
  const summaries = resolveLineStatusSummaries(q)
  const rows: QuotationLineStatusProductRow[] = []
  for (const status of QUOTATION_CRM_STATUSES) {
    for (const product of summaries[status].products) {
      rows.push({ ...product, status })
    }
  }
  return rows.sort((a, b) => a.line_index - b.line_index)
}
