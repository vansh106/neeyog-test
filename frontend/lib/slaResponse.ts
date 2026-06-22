/** SLA target options (hours) — keep in sync with backend SLA_TARGET_HOUR_OPTIONS. */
export const SLA_TARGET_HOUR_OPTIONS = [4, 8] as const

export type SlaTargetHours = (typeof SLA_TARGET_HOUR_OPTIONS)[number]

export const DEFAULT_SLA_TARGET_HOURS: SlaTargetHours = 4

export type SlaSeverity = 'met' | 'amber' | 'red'

export function slaMet(responseHours: number, targetHours: number): boolean {
  return responseHours <= targetHours
}

/** Green within target; amber if 1–2× target; red if 2×+ over target. */
export function slaSeverity(responseHours: number, targetHours: number): SlaSeverity {
  if (responseHours <= targetHours) return 'met'
  if (responseHours <= targetHours * 2) return 'amber'
  return 'red'
}

export const SLA_SEVERITY_CELL: Record<SlaSeverity, string> = {
  met: 'bg-emerald-100 text-emerald-950 font-semibold',
  amber: 'bg-amber-100 text-amber-950 font-semibold',
  red: 'bg-red-100 text-red-950 font-semibold',
}

export const SLA_MET_PILL = {
  met: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80',
  breached: 'bg-red-100 text-red-900 ring-1 ring-red-200/80',
} as const
