'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Database } from 'lucide-react'
import { useSheetRows } from '@/lib/queries'
import { suppliersApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SupplierPriceRow, SupplierResponse } from '@/types'

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const

function prettifyHeader(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

export default function MastersCategoryPage() {
  const params = useParams<{ category: string }>()
  const category = params?.category

  const [limit, setLimit] = useState<number>(50)
  const [skip, setSkip] = useState<number>(0)
  const [supplierId, setSupplierId] = useState<string>('') // empty = no supplier selected

  const { data, isPending } = useSheetRows(category ?? '', { skip, limit })

  const columns = data?.columns ?? []
  const items = data?.items ?? []
  const total = data?.total ?? 0

  const supplierPricingEnabled = Boolean(supplierId)
  const { data: suppliers = [] } = useQuery<SupplierResponse[]>({
    queryKey: ['suppliers', 'active'],
    queryFn: () => suppliersApi.getSuppliers(true),
    staleTime: 60_000,
  })
  const supplierLabel = useMemo(() => {
    if (!supplierId) return null
    return suppliers.find((s) => s.id === supplierId)?.name ?? null
  }, [supplierId, suppliers])

  const { data: supplierPrices = [] } = useQuery<SupplierPriceRow[]>({
    queryKey: ['supplierPrices', supplierId, category ?? ''],
    queryFn: () => suppliersApi.getSupplierPrices(supplierId, category ?? undefined),
    enabled: supplierPricingEnabled && Boolean(category),
    staleTime: 30_000,
  })

  const supplierPriceByRowId = useMemo(() => {
    const map = new Map<string, SupplierPriceRow>()
    for (const r of supplierPrices) {
      map.set(String(r.catalog_row_id), r)
    }
    return map
  }, [supplierPrices])

  const page = Math.floor(skip / limit) + 1
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const visibleCols = useMemo(() => {
    // Hide internal / metadata columns from the UI.
    const HIDE = new Set([
      'source_file',
      'row_id',
      'client_id',
      'created_at',
      'updated_at',
      'price_inr',
    ])
    return columns.filter((c) => !HIDE.has(String(c)))
  }, [columns])

  return (
    <PageShell title={`Masters / ${category}`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[14px] text-surface-muted">
          <span className="font-medium text-gray-900">{total}</span> row{total === 1 ? '' : 's'}
          <span className="text-surface-muted"> • Page {page} of {totalPages}</span>
        </div>

        <div className="flex items-center gap-2">
          {category && (
            <Link
              href={`/masters?tab=edit&category=${encodeURIComponent(category)}`}
              className="h-9 inline-flex items-center rounded-md border border-surface-border bg-white px-3 text-[13px] hover:bg-[#F4F5F0]"
            >
              Edit prices
            </Link>
          )}

          <span className="ml-2 text-[12px] text-[#8A9488]">Supplier</span>
          <Select
            value={supplierId || '__none__'}
            onValueChange={(v) => setSupplierId(v === '__none__' ? '' : v)}
          >
            <SelectTrigger className="h-9 w-[240px] bg-white">
              <SelectValue placeholder="No supplier">
                {supplierLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="text-muted-foreground">No supplier</span>
              </SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.is_preferred ? ' ★' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-[12px] text-[#8A9488]">Page size</span>
          <select
            className="h-9 rounded-md border border-surface-border bg-white px-2 text-[13px]"
            value={limit}
            onChange={(e) => {
              const next = Number(e.target.value)
              setLimit(next)
              setSkip(0)
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <button
            className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px] disabled:opacity-50"
            disabled={skip === 0}
            onClick={() => setSkip(Math.max(0, skip - limit))}
          >
            Prev
          </button>
          <button
            className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px] disabled:opacity-50"
            disabled={skip + limit >= total}
            onClick={() => setSkip(skip + limit)}
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                {visibleCols.map((c) => (
                  <th key={c} className="px-4 py-3 whitespace-nowrap">{prettifyHeader(c)}</th>
                ))}
                {supplierPricingEnabled && <th className="px-4 py-3 whitespace-nowrap">Supplier</th>}
                {supplierPricingEnabled && (
                  <th className="px-4 py-3 whitespace-nowrap text-right">Supplier list price</th>
                )}
              </tr>
            </thead>

            {isPending ? (
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#E2E6DC] bg-white">
                    {Array.from({
                      length: Math.max(1, visibleCols.length) + (supplierPricingEnabled ? 2 : 0),
                    }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ) : items.length === 0 ? (
              <tbody>
                <tr>
                  <td
                    colSpan={Math.max(1, visibleCols.length) + (supplierPricingEnabled ? 2 : 0)}
                    className="p-0"
                  >
                    <EmptyState
                      icon={Database}
                      title="No rows"
                      description="No data found for this category."
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {items.map((row, idx) => {
                  const rowId = String((row as any).row_id ?? '')
                  const priceRow = supplierPricingEnabled ? supplierPriceByRowId.get(rowId) : undefined
                  return (
                    <tr
                      key={rowId || String(idx)}
                      className="border-b border-[#E2E6DC] bg-white text-[13px] transition-colors hover:bg-[#F4F5F0]"
                    >
                      {visibleCols.map((c) => (
                        <td key={c} className="px-4 py-3 text-surface-muted whitespace-nowrap">
                          {row[c] == null || row[c] === '' ? '—' : String(row[c])}
                        </td>
                      ))}
                      {supplierPricingEnabled && (
                        <td className="px-4 py-3 text-surface-muted whitespace-nowrap">
                          {supplierLabel ?? '—'}
                        </td>
                      )}
                      {supplierPricingEnabled && (
                        <td className="px-4 py-3 text-right font-mono text-surface-muted whitespace-nowrap">
                          {priceRow?.list_price_inr != null ? formatCurrency(priceRow.list_price_inr) : '—'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            )}
          </table>
        </div>
      </div>
    </PageShell>
  )
}

