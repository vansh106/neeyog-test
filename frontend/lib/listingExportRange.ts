export type ListingExportRangePreset =
  | 'last_1_day'
  | 'last_7_days'
  | 'this_month'
  | 'last_month'
  | 'specific_month'
  | 'specific_date'
  | 'all_time'

export type ListingExportRange = {
  preset: ListingExportRangePreset
  /** YYYY-MM — used when preset is `specific_month`. */
  specificMonth?: string
  /** YYYY-MM-DD — used when preset is `specific_date`. */
  fromDate?: string
  /** YYYY-MM-DD — used when preset is `specific_date`. */
  toDate?: string
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
  { preset: 'specific_date', label: 'Specific date' },
  { preset: 'all_time', label: 'All time' },
]

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function parseIsoDate(iso: string): Date | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const d = new Date(year, month, day)
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null
  return d
}

function formatIsoDateLabel(iso: string): string {
  const d = parseIsoDate(iso)
  if (!d) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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
    case 'specific_date': {
      const from = parseIsoDate(range.fromDate || '')
      const to = parseIsoDate(range.toDate || '')
      if (!from || !to || from > to) return { from: null, to: null }
      return { from: startOfDay(from), to: endOfDay(to) }
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
  if (range.preset === 'specific_date' && range.fromDate && range.toDate) {
    return `${formatIsoDateLabel(range.fromDate)} – ${formatIsoDateLabel(range.toDate)}`
  }
  return LISTING_EXPORT_RANGE_OPTIONS.find((o) => o.preset === range.preset)?.label ?? 'All time'
}

export function validateListingExportRange(range: ListingExportRange): string | null {
  if (range.preset === 'specific_month' && !(range.specificMonth || '').trim()) {
    return 'Select a month'
  }
  if (range.preset === 'specific_date') {
    const from = (range.fromDate || '').trim()
    const to = (range.toDate || '').trim()
    if (!from || !to) return 'Select both from and to dates'
    if (!parseIsoDate(from) || !parseIsoDate(to)) return 'Enter valid dates'
    if (from > to) return 'From date must be on or before to date'
  }
  return null
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
