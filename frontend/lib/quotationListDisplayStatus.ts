import { QUOTATION_CRM_STATUSES, type QuotationCrmStatus } from '@/lib/quotationCrmStatus'
import { resolveLineStatusSummaries } from '@/lib/quotationLineStatusSummaries'
import type { QuotationListItem } from '@/types'

export const QUOTATION_LIST_DISPLAY_STATUSES = ['open', 'partial', 'close'] as const

export type QuotationListDisplayStatus = (typeof QUOTATION_LIST_DISPLAY_STATUSES)[number]

export const QUOTATION_LIST_DISPLAY_LABELS: Record<QuotationListDisplayStatus, string> = {
  open: 'Open',
  partial: 'Partial',
  close: 'Close',
}

export const QUOTATION_LIST_DISPLAY_COLORS: Record<QuotationListDisplayStatus, string> = {
  open: 'border-sky-200 bg-sky-50 text-sky-800',
  partial: 'border-amber-200 bg-amber-50 text-amber-900',
  close: 'border-[#E2E6DC] bg-[#F4F5F0] text-gray-700',
}

/** List-only rollup from per-line CRM statuses (does not change stored status). */
export function resolveQuotationListDisplayStatus(
  q: QuotationListItem,
): QuotationListDisplayStatus | null {
  const summaries = resolveLineStatusSummaries(q)
  const total = QUOTATION_CRM_STATUSES.reduce((sum, status) => sum + summaries[status].count, 0)
  if (total <= 0) return null

  const ongoing = summaries.ongoing.count
  const poReceived = summaries.po_received.count

  // Partial: ongoing + PO received (with or without lost).
  if (ongoing > 0 && poReceived > 0) return 'partial'

  // Open: all ongoing, or ongoing + lost only (no PO received).
  if (ongoing > 0) return 'open'

  // Close: PO + lost, all PO received, or all lost.
  return 'close'
}

export function quotationListDisplayLabel(status: QuotationListDisplayStatus): string {
  return QUOTATION_LIST_DISPLAY_LABELS[status]
}
