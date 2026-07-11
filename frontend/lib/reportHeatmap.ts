/** Heatmap cell classes for report metric columns (min/max from current view). */

export function winRateHeatmapClass(pct: number, min: number, max: number): string {
  if (max <= min) return 'bg-emerald-50 text-emerald-900'
  const t = (pct - min) / (max - min)
  if (t < 0.34) return 'bg-red-50 text-red-900'
  if (t < 0.67) return 'bg-amber-50 text-amber-900'
  return 'bg-emerald-100 text-emerald-950'
}

/** Inverted scale: lower hours = greener. */
export function responseTimeHeatmapClass(hours: number, min: number, max: number): string {
  if (max <= min) return 'bg-emerald-50 text-emerald-900'
  const t = (hours - min) / (max - min)
  if (t < 0.34) return 'bg-emerald-100 text-emerald-950'
  if (t < 0.67) return 'bg-amber-50 text-amber-900'
  return 'bg-red-50 text-red-900'
}

/** Handoff lag: green ≤2d, amber 3–5d, red 6+d or pending. */
export function handoffDaysClass(days: number | null | undefined): string {
  if (days == null) return 'bg-red-50 text-red-800 font-semibold'
  if (days <= 2) return 'bg-emerald-100 text-emerald-900'
  if (days <= 5) return 'bg-amber-100 text-amber-900'
  return 'bg-red-100 text-red-900'
}

export function metricMinMax(
  rows: Array<{ win_rate_pct?: number; avg_response_hours?: number | null }>,
  key: 'win_rate_pct' | 'avg_response_hours',
): { min: number; max: number } {
  const values = rows
    .map((r) => r[key])
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (values.length === 0) return { min: 0, max: 0 }
  return { min: Math.min(...values), max: Math.max(...values) }
}
