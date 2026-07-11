export const QUOTATION_CRM_STATUSES = ['ongoing', 'po_received', 'lost'] as const

export type QuotationCrmStatus = (typeof QUOTATION_CRM_STATUSES)[number]

export const QUOTATION_CRM_LABELS: Record<QuotationCrmStatus, string> = {
  ongoing: 'Ongoing',
  po_received: 'PO received',
  lost: 'Lost',
}

export function isQuotationCrmStatus(s: string): s is QuotationCrmStatus {
  return (QUOTATION_CRM_STATUSES as readonly string[]).includes(s)
}

export function quotationCrmLabel(status: string): string {
  if (status === 'hold') return 'Ongoing'
  if (isQuotationCrmStatus(status)) return QUOTATION_CRM_LABELS[status]
  return status.replace(/_/g, ' ')
}

export function isLineCrmStatusLocked(status: string): boolean {
  const normalized = status === 'hold' ? 'ongoing' : status
  return normalized === 'po_received' || normalized === 'lost'
}

/** True when at least one purchase order is linked with a non-zero total. */
export function quotationHasPoReceived(
  quotation: { po_total_amount?: number | null },
): boolean {
  return (quotation.po_total_amount ?? 0) > 0
}

export const QUOTATION_CRM_LIST_PHRASE: Record<QuotationCrmStatus, string> = {
  ongoing: 'ongoing',
  po_received: 'PO received',
  lost: 'lost',
}

export const QUOTATION_CRM_COUNT_COLORS: Record<QuotationCrmStatus, string> = {
  ongoing: 'text-emerald-700',
  po_received: 'text-emerald-700',
  lost: 'text-red-700',
}

export function lineStatusCountLabel(
  count: number,
  total: number,
  status: QuotationCrmStatus,
): string {
  if (count <= 0 || total <= 0) return '—'
  const noun = count === 1 ? 'product' : 'products'
  return `${count}/${total} ${noun} ${QUOTATION_CRM_LIST_PHRASE[status]}`
}
