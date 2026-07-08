import type { EnquiryListItem } from '@/types'
import { matchesArchiveFilter, type ArchiveFilter } from '@/lib/archiveFilter'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/** YYYY-MM-DD in local timezone (matches date inputs). */
export function localTodayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function enquiryLocalDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type EnquiryListingFilters = {
  useFromDate: boolean
  dateFrom: string
  useToDate: boolean
  dateTo: string
  useCustomer: boolean
  customer: string
  useNonStandardCustomer: boolean
  nonStandardCustomer: string
  useItemLikeSearch: boolean
  itemLikeSearch: string
  useUserName: boolean
  userName: string
  status: string
  useEnquiryNo: boolean
  enquiryNo: string
  useItemNoDesc: boolean
  itemNoDesc: string
  series: string
  source: string
  useSalesEnquiry: boolean
}

export const EMPTY_ENQUIRY_LISTING_FILTERS: EnquiryListingFilters = {
  useFromDate: false,
  dateFrom: '',
  useToDate: false,
  dateTo: '',
  useCustomer: false,
  customer: '',
  useNonStandardCustomer: false,
  nonStandardCustomer: '',
  useItemLikeSearch: false,
  itemLikeSearch: '',
  useUserName: false,
  userName: '',
  status: 'ALL',
  useEnquiryNo: false,
  enquiryNo: '',
  useItemNoDesc: false,
  itemNoDesc: '',
  series: 'ALL',
  source: 'ALL',
  useSalesEnquiry: false,
}

/** Applied on first load — no date/text filters until user clicks Search. */
export const INITIAL_APPLIED_ENQUIRY_FILTERS: EnquiryListingFilters = {
  ...EMPTY_ENQUIRY_LISTING_FILTERS,
}

/** Draft form defaults (dates prefilled for convenience, but not active until checkbox + Search). */
export function defaultEnquiryListingDraft(): EnquiryListingFilters {
  const today = localTodayIso()
  return {
    ...EMPTY_ENQUIRY_LISTING_FILTERS,
    dateFrom: today,
    dateTo: today,
  }
}

/** Apply dense listing filters (Search button); instant in-memory. */
export function filterEnquiriesLocal(
  rows: EnquiryListItem[],
  f: EnquiryListingFilters,
  archive: ArchiveFilter = 'active',
): EnquiryListItem[] {
  let out = rows.filter((row) => matchesArchiveFilter(row.is_archived, archive))

  if (f.useFromDate && f.dateFrom.trim()) {
    const from = f.dateFrom.trim()
    out = out.filter((row) => {
      if (!row.created_at) return false
      return enquiryLocalDay(row.created_at) >= from
    })
  }

  if (f.useToDate && f.dateTo.trim()) {
    const to = f.dateTo.trim()
    out = out.filter((row) => {
      if (!row.created_at) return false
      return enquiryLocalDay(row.created_at) <= to
    })
  }

  if (f.useCustomer) {
    const q = norm(f.customer)
    if (q) {
      out = out.filter((row) => norm(row.client_org_name || '').includes(q))
    }
  }

  if (f.useNonStandardCustomer) {
    out = out.filter((row) => row.is_non_standard_customer === true)
    const q = norm(f.nonStandardCustomer)
    if (q) {
      out = out.filter((row) => norm(row.client_org_name || '').includes(q))
    }
  }

  if (f.useItemLikeSearch) {
    const q = norm(f.itemLikeSearch)
    if (q) {
      out = out.filter((row) => norm(row.items_search_text || '').includes(q))
    }
  }

  if (f.useUserName) {
    const q = norm(f.userName)
    if (q) {
      out = out.filter((row) => norm(row.created_by_name || '').includes(q))
    }
  }

  if (f.status && f.status !== 'ALL') {
    out = out.filter((row) => row.status === f.status)
  }

  if (f.useEnquiryNo) {
    const q = norm(f.enquiryNo)
    if (q) {
      out = out.filter((row) => {
        const num = norm(row.enquiry_number || '')
        const id = norm(row.enquiry_id)
        return num.includes(q) || id.includes(q)
      })
    }
  }

  if (f.useItemNoDesc) {
    const q = norm(f.itemNoDesc)
    if (q) {
      out = out.filter((row) => norm(row.items_search_text || '').includes(q))
    }
  }

  if (f.series && f.series !== 'ALL') {
    const s = f.series.trim()
    out = out.filter((row) => (row.series || '') === s)
  }

  if (f.source && f.source !== 'ALL') {
    const src = norm(f.source)
    out = out.filter((row) => norm(row.source || '') === src)
  }

  if (f.useSalesEnquiry) {
    out = out.filter((row) => row.is_sales_enquiry === true)
  }

  return out
}

export function collectEnquiryFilterOptions(rows: EnquiryListItem[]): { series: string[] } {
  const series = new Set<string>()
  for (const row of rows) {
    const s = (row.series || '').trim()
    if (s) series.add(s)
  }
  return {
    series: [...series].sort((a, b) => a.localeCompare(b)),
  }
}
