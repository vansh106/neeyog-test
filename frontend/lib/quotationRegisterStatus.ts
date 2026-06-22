export const QUOTATION_REGISTER_STATUSES = [
  'open',
  'won',
  'lost',
  'expired',
  'expiring_soon',
] as const

export type QuotationRegisterDisplayStatus = (typeof QUOTATION_REGISTER_STATUSES)[number]

export const QUOTATION_REGISTER_STATUS_LABELS: Record<QuotationRegisterDisplayStatus, string> = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
  expired: 'Expired',
  expiring_soon: 'Expiring Soon',
}

export const QUOTATION_REGISTER_STATUS_PILL: Record<QuotationRegisterDisplayStatus, string> = {
  open: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200/80',
  won: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80',
  lost: 'bg-red-100 text-red-800 ring-1 ring-red-200/80',
  expired: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80',
  expiring_soon: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200/80',
}

export function quotationRegisterStatusLabel(status: string): string {
  if (status in QUOTATION_REGISTER_STATUS_LABELS) {
    return QUOTATION_REGISTER_STATUS_LABELS[status as QuotationRegisterDisplayStatus]
  }
  return status.replace(/_/g, ' ')
}

export function isQuotationRegisterStatus(s: string): s is QuotationRegisterDisplayStatus {
  return (QUOTATION_REGISTER_STATUSES as readonly string[]).includes(s)
}
