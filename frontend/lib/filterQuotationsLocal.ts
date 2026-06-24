import type { QuotationListItem } from '@/types'
import { matchesArchiveFilter, type ArchiveFilter } from '@/lib/archiveFilter'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export type LocalQuotationFilters = {
  search: string
  clientName: string
  status: string
  dateFrom: string
  dateTo: string
  archive: ArchiveFilter
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

  if (f.dateFrom || f.dateTo) {
    out = out.filter((row) => {
      if (!row.created_at) return false
      const day = row.created_at.slice(0, 10)
      if (f.dateFrom && day < f.dateFrom) return false
      if (f.dateTo && day > f.dateTo) return false
      return true
    })
  }

  return out
}
