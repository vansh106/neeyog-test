import type { QuotationLineStatusSummary, QuotationListItem } from '@/types'
import { QUOTATION_CRM_STATUSES, type QuotationCrmStatus } from '@/lib/quotationCrmStatus'

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
    hold: EMPTY_SUMMARY(total),
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
