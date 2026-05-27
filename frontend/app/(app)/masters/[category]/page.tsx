'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Database, Download, Loader2 } from 'lucide-react'
import { useSheetRows } from '@/lib/queries'
import { mastersApi, suppliersApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SupplierPriceRow, SupplierResponse } from '@/types'
import {
  MASTERS_SHEET_EXPORT_HIDE_COLUMNS,
  downloadMastersSheetXlsx,
  fetchAllMastersSheetRows,
} from '@/lib/mastersSheetExport'
import { findMasterNavLeafBySlug, masterNavActiveQueryFromSearchParams } from '@/lib/masterSidebarNav'
import type { MastersSheetRowsParams } from '@/lib/queries'

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const

function prettifyHeader(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

export default function MastersCategoryPage() {
  const params = useParams<{ category: string }>()
  const searchParams = useSearchParams()
  const category = params?.category
  const activeQuery = masterNavActiveQueryFromSearchParams(searchParams)

  const sheetFilters = useMemo((): MastersSheetRowsParams => {
    const f: MastersSheetRowsParams = {}
    if (activeQuery.variantType) f.variant_type = activeQuery.variantType
    if (activeQuery.variantContains) f.variant_contains = activeQuery.variantContains
    if (activeQuery.variantExcludeContains) f.variant_exclude_contains = activeQuery.variantExcludeContains
    if (activeQuery.variantContainsAny) f.variant_contains_any = activeQuery.variantContainsAny
    if (activeQuery.modelNamePrefix) f.model_name_prefix = activeQuery.modelNamePrefix
    if (activeQuery.navSlug) f.nav = activeQuery.navSlug
    return f
  }, [
    activeQuery.variantType,
    activeQuery.variantContains,
    activeQuery.variantExcludeContains,
    activeQuery.variantContainsAny,
    activeQuery.modelNamePrefix,
    activeQuery.navSlug,
  ])

  const sheetDisplayName = useMemo(() => {
    if (activeQuery.navSlug) {
      const leaf = findMasterNavLeafBySlug(activeQuery.navSlug)
      if (leaf) return leaf.label
    }
    return category?.replace(/_/g, ' ') ?? ''
  }, [category, activeQuery.navSlug])

  const navSlug = activeQuery.navSlug ?? ''

  const [limit, setLimit] = useState<number>(50)
  const [skip, setSkip] = useState<number>(0)
  const [supplierId, setSupplierId] = useState<string>('') // empty = no supplier selected
  const [defaultSupplierDraft, setDefaultSupplierDraft] = useState<string>('')
  const [defaultSaving, setDefaultSaving] = useState(false)
  const [defaultError, setDefaultError] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const { data, isPending } = useSheetRows(category ?? '', {
    skip,
    limit,
    ...sheetFilters,
  })

  useEffect(() => {
    setSkip(0)
  }, [category, sheetFilters])

  const columns = data?.columns ?? []
  const items = data?.items ?? []
  const total = data?.total ?? 0

  const supplierPricingEnabled = Boolean(supplierId)
  const { data: suppliers = [] } = useQuery<SupplierResponse[]>({
    queryKey: ['suppliers', 'active'],
    queryFn: () => suppliersApi.getSuppliers(true),
    staleTime: 60_000,
  })

  const { data: sheetDefaultData, refetch: refetchSheetDefault } = useQuery({
    queryKey: ['sheetDefaultSupplier', category, navSlug],
    queryFn: () => mastersApi.getSheetDefaultSupplier(category!, navSlug || undefined),
    enabled: Boolean(category),
    staleTime: 30_000,
  })

  const sheetDefaultSupplierId = sheetDefaultData?.default?.supplier_id ?? ''

  useEffect(() => {
    setDefaultSupplierDraft(sheetDefaultSupplierId)
    if (sheetDefaultSupplierId) {
      setSupplierId(sheetDefaultSupplierId)
    } else {
      setSupplierId('')
    }
  }, [sheetDefaultSupplierId, category, navSlug])

  const saveSheetDefaultSupplier = useCallback(
    async (nextId: string) => {
      if (!category) return
      setDefaultSaving(true)
      setDefaultError(null)
      try {
        if (!nextId) {
          await mastersApi.clearSheetDefaultSupplier(category, navSlug || undefined)
        } else {
          await mastersApi.setSheetDefaultSupplier(category, nextId, navSlug || undefined)
        }
        await refetchSheetDefault()
        setDefaultSupplierDraft(nextId)
        if (nextId) setSupplierId(nextId)
      } catch (e) {
        setDefaultError(e instanceof Error ? e.message : 'Failed to save default supplier')
      } finally {
        setDefaultSaving(false)
      }
    },
    [category, navSlug, refetchSheetDefault],
  )
  const supplierLabel = useMemo(() => {
    if (!supplierId) return null
    return suppliers.find((s) => s.id === supplierId)?.name ?? null
  }, [supplierId, suppliers])

  const defaultSupplierLabel = useMemo(() => {
    if (!defaultSupplierDraft) return null
    return (
      suppliers.find((s) => s.id === defaultSupplierDraft)?.name ??
      sheetDefaultData?.default?.supplier_name ??
      null
    )
  }, [defaultSupplierDraft, suppliers, sheetDefaultData?.default?.supplier_name])

  const { data: supplierPrices = [] } = useQuery<SupplierPriceRow[]>({
    queryKey: ['supplierPrices', supplierId, category ?? ''],
    queryFn: () => suppliersApi.getSupplierPrices(supplierId, category ?? undefined),
    enabled: supplierPricingEnabled && Boolean(category),
    staleTime: 30_000,
  })

  const supplierPriceByRowId = useMemo(() => {
    const map = new Map<string, SupplierPriceRow>()
    for (const r of supplierPrices) {
      const id = String(r.catalog_row_id ?? '').trim().toLowerCase()
      if (id) map.set(id, r)
    }
    return map
  }, [supplierPrices])

  const page = Math.floor(skip / limit) + 1
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const visibleCols = useMemo(() => {
    return columns.filter((c) => !MASTERS_SHEET_EXPORT_HIDE_COLUMNS.has(String(c)))
  }, [columns])

  const handleExportXlsx = useCallback(async () => {
    if (!category || exportBusy) return
    setExportBusy(true)
    setExportError(null)
    try {
      const { columns: allCols, items } = await fetchAllMastersSheetRows(category, sheetFilters)
      downloadMastersSheetXlsx(category, allCols, items)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportBusy(false)
    }
  }, [category, exportBusy, sheetFilters])

  return (
    <PageShell
      title={`Masters / ${sheetDisplayName || category}`}
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          disabled={!category || exportBusy}
          onClick={() => void handleExportXlsx()}
        >
          {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export XLSX
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-surface-border bg-[#F9FAF7] px-3 py-2.5">
        <span className="text-[12px] font-medium text-gray-800">Default supplier for this sheet</span>
        <Select
          value={defaultSupplierDraft || '__none__'}
          disabled={defaultSaving || !category}
          onValueChange={(v) => {
            const next = v === '__none__' || v == null ? '' : v
            setDefaultSupplierDraft(next)
            void saveSheetDefaultSupplier(next)
          }}
        >
          <SelectTrigger className="h-9 w-[260px] bg-white">
            <SelectValue placeholder="Not set">{defaultSupplierLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-muted-foreground">Not set</span>
            </SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {s.is_preferred ? ' ★' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {defaultSaving ? (
          <span className="text-[12px] text-surface-muted">Saving…</span>
        ) : null}
        {defaultError ? (
          <span className="text-[12px] text-red-600">{defaultError}</span>
        ) : null}
        <span className="text-[11px] text-[#8A9488]">
          Used automatically in manual upload when this product sheet is selected.
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[14px] text-surface-muted">
          <span className="font-medium text-gray-900">{total}</span> row{total === 1 ? '' : 's'}
          <span className="text-surface-muted"> • Page {page} of {totalPages}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {category && (
            <Link
              href={`/masters?tab=edit&category=${encodeURIComponent(category)}`}
              className="h-9 inline-flex items-center rounded-md border border-surface-border bg-white px-3 text-[13px] hover:bg-[#F4F5F0]"
            >
              Edit prices
            </Link>
          )}

          {exportError ? (
            <span className="w-full text-[12px] text-red-600 sm:w-auto">{exportError}</span>
          ) : null}

          <span className="ml-2 text-[12px] text-[#8A9488]">View prices as</span>
          <Select
            value={supplierId || '__none__'}
            onValueChange={(v) => setSupplierId(v === '__none__' || v == null ? '' : v)}
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
                  const rowId = String((row as Record<string, unknown>).row_id ?? '').trim().toLowerCase()
                  const priceRow = supplierPricingEnabled && rowId
                    ? supplierPriceByRowId.get(rowId)
                    : undefined
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

