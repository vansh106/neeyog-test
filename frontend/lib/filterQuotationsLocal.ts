import type { QuotationListItem } from '@/types'
import { matchesArchiveFilter, type ArchiveFilter } from '@/lib/archiveFilter'
import { isoLocalDay, isFullAmountRange, localTodayIso, uniqueSortedStrings } from '@/lib/listingFilterUtils'
import {
  collectQuotationCategoryFilterOptions,
  quotationMatchesCategoryFilters,
} from '@/lib/listingCategoryFilter'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export type FollowUpFilter = '' | 'upcoming' | 'expired'

export type LocalQuotationFilters = {
  search: string
  clientName: string
  status: string
  category: string
  subCategory: string
  user: string
  dateFrom: string
  dateTo: string
  poAmountMin: number
  poAmountMax: number
  poBoundsMin: number
  poBoundsMax: number
  followUp: FollowUpFilter
  archive: ArchiveFilter
}

export const DEFAULT_QUOTATION_FILTERS: LocalQuotationFilters = {
  search: '',
  clientName: '',
  status: '',
  category: '',
  subCategory: '',
  user: '',
  dateFrom: '',
  dateTo: '',
  poAmountMin: 0,
  poAmountMax: 0,
  poBoundsMin: 0,
  poBoundsMax: 0,
  followUp: '',
  archive: 'active',
}

export function collectQuotationFilterOptions(rows: QuotationListItem[]) {
  const categoryOptions = collectQuotationCategoryFilterOptions(rows)
  const users = uniqueSortedStrings(rows.map((r) => r.created_by_name))
  return { ...categoryOptions, users }
}

export function quotationPoBounds(rows: QuotationListItem[]) {
  const amounts = rows.map((r) => (r.po_total_amount != null && r.po_total_amount > 0 ? r.po_total_amount : 0))
  const { min, max } = computePoBounds(amounts)
  return { min, max }
}

function computePoBounds(amounts: number[]) {
  const valid = amounts.filter((n) => Number.isFinite(n) && n >= 0)
  if (valid.length === 0) return { min: 0, max: 100000 }
  const min = Math.floor(Math.min(...valid))
  const max = Math.ceil(Math.max(...valid))
  if (max <= min) return { min: 0, max: Math.max(min + 1, 100000) }
  return { min, max }
}

/** Instant in-memory filter; no network. */
export function filterQuotationsLocal(rows: QuotationListItem[], f: LocalQuotationFilters): QuotationListItem[] {
  let out = rows.filter((row) => matchesArchiveFilter(row.is_archived, f.archive))

  const q = norm(f.search)
  if (q) {
    out = out.filter((row) => {
      const num = norm(row.quote_number)
      const enq = norm(row.enquiry_number || '')
      const cn = norm(row.client_name || '')
      const cc = norm(row.client_company || '')
      const desc = norm(row.item_desc_short || '')
      const linesBlob = norm(
        (row.item_desc_lines ?? []).map((l) => `${l.short} ${l.full}`).join(' '),
      )
      return (
        num.includes(q) ||
        enq.includes(q) ||
        cn.includes(q) ||
        cc.includes(q) ||
        desc.includes(q) ||
        linesBlob.includes(q)
      )
    })
  }

  const clientQ = norm(f.clientName)
  if (clientQ) {
    out = out.filter((row) => {
      const cn = norm(row.client_name || '')
      const cc = norm(row.client_company || '')
      return cn.includes(clientQ) || cc.includes(clientQ)
    })
  }

  if (f.status) {
    out = out.filter((row) => {
      const key = f.status as keyof typeof row.line_status_summaries
      const block = row.line_status_summaries?.[key]
      if (block && block.count > 0) return true
      return row.status === f.status
    })
  }

  if (f.category || f.subCategory) {
    out = out.filter((row) => quotationMatchesCategoryFilters(row, f.category, f.subCategory))
  }

  if (f.user) {
    const u = norm(f.user)
    out = out.filter((row) => norm(row.created_by_name || '') === u)
  }

  if (f.dateFrom || f.dateTo) {
    out = out.filter((row) => {
      if (!row.created_at) return false
      const day = row.created_at.slice(0, 10)
      if (f.dateFrom && day < f.dateFrom) return false
      if (f.dateTo && day > f.dateTo) return false
      return true
    })
  }

  const boundsMin = f.poBoundsMin
  const boundsMax = f.poBoundsMax
  if (
    boundsMax > boundsMin &&
    !isFullAmountRange(boundsMin, boundsMax, f.poAmountMin, f.poAmountMax)
  ) {
    out = out.filter((row) => {
      const amt = row.po_total_amount != null && row.po_total_amount > 0 ? row.po_total_amount : 0
      return amt >= f.poAmountMin && amt <= f.poAmountMax
    })
  }

  if (f.followUp) {
    const today = localTodayIso()
    out = out.filter((row) => {
      const day = isoLocalDay(row.next_follow_up_date)
      if (!day) return false
      if (f.followUp === 'expired') return day < today
      if (f.followUp === 'upcoming') return day >= today
      return true
    })
  }

  if (f.followUp === 'upcoming') {
    out = [...out].sort((a, b) => {
      const da = isoLocalDay(a.next_follow_up_date) || '9999-12-31'
      const db = isoLocalDay(b.next_follow_up_date) || '9999-12-31'
      return da.localeCompare(db)
    })
  } else if (f.followUp === 'expired') {
    out = [...out].sort((a, b) => {
      const da = isoLocalDay(a.next_follow_up_date) || ''
      const db = isoLocalDay(b.next_follow_up_date) || ''
      return db.localeCompare(da)
    })
  }

  return out
}

export function quotationFiltersActive(f: LocalQuotationFilters): boolean {
  const poFiltered =
    f.poBoundsMax > f.poBoundsMin &&
    !isFullAmountRange(f.poBoundsMin, f.poBoundsMax, f.poAmountMin, f.poAmountMax)
  return (
    !!f.search.trim() ||
    !!f.clientName.trim() ||
    !!f.status ||
    !!f.category ||
    !!f.subCategory ||
    !!f.user ||
    !!f.dateFrom ||
    !!f.dateTo ||
    !!f.followUp ||
    poFiltered ||
    f.archive !== 'active'
  )
}
