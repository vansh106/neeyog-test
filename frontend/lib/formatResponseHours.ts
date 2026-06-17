/** Format hours for dashboard response-time KPI (e.g. 6.2h, 14h). */
export function formatResponseHours(hours: number): string {
  const n = Number(hours)
  if (!Number.isFinite(n)) return '—'
  if (n >= 10) return `${Math.round(n)}h`
  return `${n.toFixed(1).replace(/\.0$/, '')}h`
}
