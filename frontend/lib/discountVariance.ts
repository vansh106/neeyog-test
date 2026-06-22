/** Discount % color bands — keep in sync with backend DISCOUNT_* constants. */
export const DISCOUNT_ACCEPTABLE_MAX_PCT = 5
export const DISCOUNT_MODERATE_MAX_PCT = 15
export const DISCOUNT_APPROVAL_THRESHOLD_PCT = 10

export type DiscountBand = 'none' | 'low' | 'medium' | 'high'

export function discountPctCellClass(pct: number): string {
  if (pct <= DISCOUNT_ACCEPTABLE_MAX_PCT) return 'bg-emerald-50 text-emerald-800'
  if (pct <= DISCOUNT_MODERATE_MAX_PCT) return 'bg-amber-50 text-amber-900'
  return 'bg-red-50 text-red-800'
}

export function variancePctCellClass(pct: number): string {
  if (pct <= 0) return 'text-gray-700'
  if (pct <= 5) return 'bg-amber-50 text-amber-900'
  return 'bg-red-50 text-red-800'
}

export function approvalStatusPillClass(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-50 text-emerald-800 border border-emerald-200'
    case 'pending':
      return 'bg-red-50 text-red-800 border border-red-200'
    default:
      return 'bg-gray-50 text-gray-600 border border-gray-200'
  }
}

export function approvalStatusLabel(status: string): string {
  switch (status) {
    case 'approved':
      return 'Approved'
    case 'pending':
      return 'Pending'
    default:
      return 'Not Required'
  }
}

export const DISCOUNT_BAND_OPTIONS: { value: DiscountBand | '__all__'; label: string }[] = [
  { value: '__all__', label: 'All bands' },
  { value: 'none', label: 'None (0%)' },
  { value: 'low', label: 'Low (1–5%)' },
  { value: 'medium', label: 'Medium (6–15%)' },
  { value: 'high', label: 'High (15%+)' },
]
