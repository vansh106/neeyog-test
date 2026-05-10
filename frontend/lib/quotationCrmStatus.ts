export const QUOTATION_CRM_STATUSES = ['ongoing', 'po_received', 'lost', 'hold'] as const

export type QuotationCrmStatus = (typeof QUOTATION_CRM_STATUSES)[number]

export const QUOTATION_CRM_LABELS: Record<QuotationCrmStatus, string> = {
  ongoing: 'Ongoing',
  po_received: 'PO received',
  lost: 'Lost',
  hold: 'Hold',
}

export function isQuotationCrmStatus(s: string): s is QuotationCrmStatus {
  return (QUOTATION_CRM_STATUSES as readonly string[]).includes(s)
}

export function quotationCrmLabel(status: string): string {
  if (isQuotationCrmStatus(status)) return QUOTATION_CRM_LABELS[status]
  return status.replace(/_/g, ' ')
}
