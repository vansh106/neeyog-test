export type ListingExportRangePreset =
  | 'last_1_day'
  | 'last_7_days'
  | 'this_month'
  | 'last_month'
  | 'specific_month'
  | 'all_time'

export type ListingExportRange = {
  preset: ListingExportRangePreset
  /** YYYY-MM — used when preset is `specific_month`. */
  specificMonth?: string
}

export const LISTING_EXPORT_RANGE_OPTIONS: {
  preset: ListingExportRangePreset
  label: string
}[] = [
  { preset: 'last_1_day', label: 'Last 1 day' },
  { preset: 'last_7_days', label: 'Last 7 days' },
  { preset: 'this_month', label: 'This month' },
  { preset: 'last_month', label: 'Last month' },
  { preset: 'specific_month', label: 'Specific month' },
  { preset: 'all_time', label: 'All time' },
]

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

export function listingExportDateBounds(
  range: ListingExportRange,
  now: Date = new Date(),
): { from: Date | null; to: Date | null } {
  const today = startOfDay(now)

  switch (range.preset) {
    case 'all_time':
      return { from: null, to: null }
    case 'last_1_day':
      return { from: today, to: endOfDay(now) }
    case 'last_7_days': {
      const from = new Date(today)
      from.setDate(from.getDate() - 6)
      return { from, to: endOfDay(now) }
    }
    case 'this_month':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: endOfDay(now),
      }
    case 'last_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))
      return { from, to }
    }
    case 'specific_month': {
      const ym = (range.specificMonth || '').trim()
      const m = ym.match(/^(\d{4})-(\d{2})$/)
      if (!m) return { from: null, to: null }
      const year = Number(m[1])
      const month = Number(m[2]) - 1
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) {
        return { from: null, to: null }
      }
      const from = new Date(year, month, 1)
      const to = endOfDay(new Date(year, month + 1, 0))
      return { from, to }
    }
    default:
      return { from: null, to: null }
  }
}

export function listingExportRangeLabel(range: ListingExportRange): string {
  if (range.preset === 'specific_month' && range.specificMonth) {
    const [y, m] = range.specificMonth.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    }
  }
  return LISTING_EXPORT_RANGE_OPTIONS.find((o) => o.preset === range.preset)?.label ?? 'All time'
}

export function filterItemsByCreatedAt<T extends { created_at: string }>(
  items: T[],
  range: ListingExportRange,
): T[] {
  const { from, to } = listingExportDateBounds(range)
  if (!from && !to) return items
  return items.filter((item) => {
    const created = new Date(item.created_at)
    if (Number.isNaN(created.getTime())) return false
    if (from && created < from) return false
    if (to && created > to) return false
    return true
  })
}
