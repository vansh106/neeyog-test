/** Configurable PO value thresholds (INR) for customer tier pills. */

export type CustomerTier = 'top' | 'mid' | 'low'

export const CUSTOMER_TIER_THRESHOLDS_INR: Array<{
  tier: CustomerTier
  label: string
  minPoValue: number
}> = [
  { tier: 'top', label: 'Top', minPoValue: 500_000 },
  { tier: 'mid', label: 'Mid', minPoValue: 100_000 },
  { tier: 'low', label: 'Low', minPoValue: 0 },
]

export const CUSTOMER_TIER_PILL: Record<CustomerTier, string> = {
  top: 'bg-violet-100 text-violet-900 ring-1 ring-violet-200/80',
  mid: 'bg-sky-100 text-sky-900 ring-1 ring-sky-200/80',
  low: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200/80',
}

export function customerTierFromPoValue(poValue: number): { tier: CustomerTier; label: string } {
  for (const row of CUSTOMER_TIER_THRESHOLDS_INR) {
    if (poValue >= row.minPoValue) return { tier: row.tier, label: row.label }
  }
  return { tier: 'low', label: 'Low' }
}

export const STALENESS_WARN_DAYS = 30
export const STALENESS_ALERT_DAYS = 60

export function stalenessLevel(lastActivityIso: string | null, today = new Date()): 'ok' | 'warn' | 'alert' | null {
  if (!lastActivityIso) return null
  const last = new Date(lastActivityIso)
  if (Number.isNaN(last.getTime())) return null
  const days = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  if (days >= STALENESS_ALERT_DAYS) return 'alert'
  if (days >= STALENESS_WARN_DAYS) return 'warn'
  return 'ok'
}
