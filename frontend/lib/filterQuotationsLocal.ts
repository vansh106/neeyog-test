import type { QuotationListItem } from '@/types'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export type LocalQuotationFilters = {
  search: string
  clientName: string
  status: string
  dateFrom: string
  dateTo: string
}

/** Instant in-memory filter; no network. */
export function filterQuotationsLocal(rows: QuotationListItem[], f: LocalQuotationFilters): QuotationListItem[] {
  let out = rows

  const q = norm(f.search)
  if (q) {
    out = out.filter((row) => {
      const num = norm(row.quote_number)
      const cn = norm(row.client_name || '')
      const cc = norm(row.client_company || '')
      return num.includes(q) || cn.includes(q) || cc.includes(q)
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
    out = out.filter((row) => row.status === f.status)
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
