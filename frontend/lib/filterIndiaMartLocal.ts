import type { IndiaMartQueryItem } from '@/types'
import { isoLocalDay, uniqueSortedStrings } from '@/lib/listingFilterUtils'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export type IndiaMartPickupFilter = '' | 'bucket' | 'picked_up' | 'archived'

export type LocalIndiaMartFilters = {
  search: string
  queryType: string
  pickup: IndiaMartPickupFilter
  dateFrom: string
  dateTo: string
}

export const DEFAULT_INDIAMART_FILTERS: LocalIndiaMartFilters = {
  search: '',
  queryType: '',
  pickup: '',
  dateFrom: '',
  dateTo: '',
}

export function collectIndiaMartFilterOptions(rows: IndiaMartQueryItem[]) {
  return {
    queryTypes: uniqueSortedStrings(rows.map((r) => r.query_type_label || r.query_type)),
  }
}

export function filterIndiaMartLocal(
  rows: IndiaMartQueryItem[],
  f: LocalIndiaMartFilters,
): IndiaMartQueryItem[] {
  let out = rows

  const q = norm(f.search)
  if (q) {
    out = out.filter((row) => {
      const blob = [
        row.sender_name,
        row.sender_company,
        row.sender_email,
        row.sender_mobile,
        row.query_product_name,
        row.query_message,
        row.unique_query_id,
        row.query_type_label,
        row.picked_up_by_name,
        row.enquiry_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }

  if (f.queryType) {
    const t = norm(f.queryType)
    out = out.filter(
      (row) =>
        norm(row.query_type_label || '') === t || norm(row.query_type || '') === t,
    )
  }

  if (f.pickup === 'bucket') {
    out = out.filter((row) => !row.is_picked_up && !row.is_archived)
  } else if (f.pickup === 'picked_up') {
    out = out.filter((row) => row.is_picked_up)
  } else if (f.pickup === 'archived') {
    out = out.filter((row) => row.is_archived)
  }

  if (f.dateFrom || f.dateTo) {
    out = out.filter((row) => {
      const day = isoLocalDay(row.query_time || row.created_at)
      if (!day) return false
      if (f.dateFrom && day < f.dateFrom) return false
      if (f.dateTo && day > f.dateTo) return false
      return true
    })
  }

  return out
}

export function indiaMartFiltersActive(f: LocalIndiaMartFilters): boolean {
  return (
    !!f.search.trim() ||
    !!f.queryType ||
    !!f.pickup ||
    !!f.dateFrom ||
    !!f.dateTo
  )
}
