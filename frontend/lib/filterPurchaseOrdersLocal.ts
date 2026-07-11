import type { PurchaseOrderListItem } from '@/types'
import { computeAmountBounds, isFullAmountRange, uniqueSortedStrings } from '@/lib/listingFilterUtils'
import {
  collectPurchaseOrderCategoryFilterOptions,
  purchaseOrderMatchesCategoryFilters,
} from '@/lib/listingCategoryFilter'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export type LocalPurchaseOrderFilters = {
  search: string
  clientName: string
  type: string
  category: string
  subCategory: string
  user: string
  dateFrom: string
  dateTo: string
  amountMin: number
  amountMax: number
  boundsMin: number
  boundsMax: number
}

export const DEFAULT_PO_FILTERS: LocalPurchaseOrderFilters = {
  search: '',
  clientName: '',
  type: '',
  category: '',
  subCategory: '',
  user: '',
  dateFrom: '',
  dateTo: '',
  amountMin: 0,
  amountMax: 0,
  boundsMin: 0,
  boundsMax: 0,
}

export function collectPurchaseOrderFilterOptions(rows: PurchaseOrderListItem[]) {
  const categoryOptions = collectPurchaseOrderCategoryFilterOptions(rows)
  return {
    ...categoryOptions,
    users: uniqueSortedStrings(rows.map((r) => r.created_by_name)),
  }
}

export function purchaseOrderAmountBounds(rows: PurchaseOrderListItem[]) {
  return computeAmountBounds(rows.map((r) => r.subtotal))
}

export function filterPurchaseOrdersLocal(
  rows: PurchaseOrderListItem[],
  f: LocalPurchaseOrderFilters,
): PurchaseOrderListItem[] {
  let out = rows

  const q = norm(f.search)
  if (q) {
    out = out.filter((row) => {
      const blob = `${row.po_number} ${row.client_name} ${row.client_company ?? ''} ${row.quote_number ?? ''} ${row.so_number ?? ''} ${row.item_desc_short}`.toLowerCase()
      return blob.includes(q)
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

  if (f.type === 'quoted') out = out.filter((row) => row.po_type === 'quoted')
  if (f.type === 'non_quoted') out = out.filter((row) => row.po_type === 'non_quoted')

  if (f.category || f.subCategory) {
    out = out.filter((row) => purchaseOrderMatchesCategoryFilters(row, f.category, f.subCategory))
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

  if (
    f.boundsMax > f.boundsMin &&
    !isFullAmountRange(f.boundsMin, f.boundsMax, f.amountMin, f.amountMax)
  ) {
    out = out.filter((row) => row.subtotal >= f.amountMin && row.subtotal <= f.amountMax)
  }

  return out
}

export function purchaseOrderFiltersActive(f: LocalPurchaseOrderFilters): boolean {
  const amountFiltered =
    f.boundsMax > f.boundsMin &&
    !isFullAmountRange(f.boundsMin, f.boundsMax, f.amountMin, f.amountMax)
  return (
    !!f.search.trim() ||
    !!f.clientName.trim() ||
    !!f.type ||
    !!f.category ||
    !!f.subCategory ||
    !!f.user ||
    !!f.dateFrom ||
    !!f.dateTo ||
    amountFiltered
  )
}
