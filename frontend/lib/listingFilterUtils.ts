export function uniqueSortedStrings(values: (string | null | undefined)[], limit = 200): string[] {
  const set = new Set<string>()
  for (const v of values) {
    const s = (v || '').trim()
    if (s) set.add(s)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b)).slice(0, limit)
}

export function computeAmountBounds(
  amounts: number[],
  fallbackMax = 100000,
): { min: number; max: number } {
  const valid = amounts.filter((n) => Number.isFinite(n) && n >= 0)
  if (valid.length === 0) return { min: 0, max: fallbackMax }
  const min = Math.floor(Math.min(...valid))
  const max = Math.ceil(Math.max(...valid))
  if (max <= min) return { min: 0, max: Math.max(min + 1, fallbackMax) }
  return { min, max }
}

export function localTodayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isoLocalDay(iso: string | null | undefined): string {
  if (!iso?.trim()) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** True when range covers the full dataset span (no amount filter active). */
export function isFullAmountRange(
  min: number,
  max: number,
  valueMin: number,
  valueMax: number,
): boolean {
  return valueMin <= min && valueMax >= max
}
