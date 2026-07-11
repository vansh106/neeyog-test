export type AgingTier = 'low' | 'medium' | 'high'

export function agingTier(days: number): AgingTier {
  if (days >= 6) return 'high'
  if (days >= 3) return 'medium'
  return 'low'
}

export function agingBadgeClass(tier: AgingTier): string {
  if (tier === 'high') return 'bg-red-100 text-red-800 border-red-200'
  if (tier === 'medium') return 'bg-orange-100 text-orange-800 border-orange-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

export function formatAgingDays(days: number): string {
  return `${days}d`
}
