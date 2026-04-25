'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Loader2, Pencil, RefreshCw, Save, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMastersCatalog, computeDistinctOptions, type CatalogRow } from '@/hooks/useValveCatalog'
import { mastersApi, suppliersApi } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import type { SupplierPriceRow, SupplierResponse } from '@/types'

const SELECT_EMPTY = '__none__'

type CategoryOption = { key: string; label: string; count?: number }
type CascadeStep = { key: string; label: string }

function toSelectValue(v: string | null | undefined): string {
  return v != null && String(v).trim() !== '' ? String(v) : SELECT_EMPTY
}
function fromSelectValue(v: string | null | undefined): string {
  return !v || v === SELECT_EMPTY ? '' : v
}

function prettifyHeader(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function bestLabel(row: Record<string, unknown>): string {
  // Make a short identity string per row for scanning.
  const pick = (...keys: string[]) =>
    keys.map((k) => row[k]).find((v) => v != null && String(v).trim() !== '') ?? null
  const parts: string[] = []
  const type = pick('variant_type', 'operator_for', 'bracket_operator')
  const cons = pick('construction', 'construct')
  const size = pick('valve_size', 'size_text')
  const model = pick('model_name')
  if (type) parts.push(String(type))
  if (cons) parts.push(String(cons))
  if (size) parts.push(String(size))
  if (model) parts.push(String(model))
  return parts.join(' • ') || String(row.row_id ?? '—')
}

export default function MastersEditor({ initialCategory }: { initialCategory?: string }) {
  const { data: categories, isPending: catsPending, refetch: refetchCats } = useQuery<
    CategoryOption[]
  >({
    queryKey: ['masters', 'categories'],
    queryFn: () => mastersApi.getCategories<CategoryOption[]>(),
    staleTime: 60000,
  })

  const { data: suppliers, isPending: suppliersPending } = useQuery<SupplierResponse[]>({
    queryKey: ['suppliers', 'active'],
    queryFn: () => suppliersApi.getSuppliers(true),
    staleTime: 60000,
  })

  const [category, setCategory] = useState<string>('')
  const [supplierId, setSupplierId] = useState<string>('')
  const [schema, setSchema] = useState<CascadeStep[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})

  const {
    catalog,
    isLoading: catalogLoading,
    error: catalogError,
    loadCatalog,
    reloadCatalog,
    getOptions,
  } = useMastersCatalog(category || null)

  // Editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [draftPrice, setDraftPrice] = useState<string>('')

  const cascadeFields = useMemo(() => schema.map((s) => s.key), [schema])

  const loadSchema = useCallback(async (cat: string) => {
    const s = await mastersApi.getCascadeSchema<CascadeStep[]>(cat)
    setSchema(s ?? [])
    setFilters({})
    setEditingRowId(null)
    setDraftPrice('')
  }, [])

  useEffect(() => {
    const list = (suppliers ?? []).filter((s) => s.is_active)
    if (!list.length) return
    setSupplierId((cur) => {
      if (cur && list.some((s) => s.id === cur)) return cur
      const pref = list.find((s) => s.is_preferred)
      return pref?.id ?? list[0].id
    })
  }, [suppliers])

  useEffect(() => {
    if (!categories || categories.length === 0) return
    if (category) return
    // Prefer explicit initialCategory (e.g. from /masters/<category>).
    if (initialCategory && categories.some((c) => c.key === initialCategory)) {
      setCategory(initialCategory)
      return
    }
    // Default to first category with data, else first overall.
    const withData = categories.find((c) => (c.count ?? 0) > 0)
    setCategory(withData?.key ?? categories[0].key)
  }, [categories, category])

  useEffect(() => {
    if (!category) return
    void loadSchema(category)
  }, [category, loadSchema])

  useEffect(() => {
    if (!category) return
    void loadCatalog(category)
  }, [category, loadCatalog])

  const optionsByField = useMemo(() => {
    if (!category || cascadeFields.length === 0 || catalog.length === 0) return {}
    const next: Record<string, string[]> = {}
    for (const field of cascadeFields) {
      const priorKeys = cascadeFields.slice(0, cascadeFields.indexOf(field))
      const priorFilters: Record<string, string> = {}
      for (const k of priorKeys) {
        if (filters[k]) priorFilters[k] = filters[k]
      }
      next[field] = getOptions(field, priorFilters)
    }
    return next
  }, [category, cascadeFields, catalog, filters, getOptions])

  useEffect(() => {
    if (!category || cascadeFields.length === 0 || catalogLoading || catalog.length === 0) return
    setFilters((prev) => {
      let next = { ...prev }
      let changed = false

      for (const field of cascadeFields) {
        const prior: Record<string, string> = {}
        for (const k of cascadeFields) {
          if (k === field) break
          const v = next[k]
          if (v) prior[k] = v
        }
        const opts = computeDistinctOptions(catalog, field, prior)
        const cur = next[field]
        if (cur && !opts.includes(cur)) {
          delete next[field]
          for (const after of cascadeFields.slice(cascadeFields.indexOf(field) + 1)) {
            delete next[after]
          }
          changed = true
          break
        }
      }
      if (changed) return next

      for (const field of cascadeFields) {
        if (next[field]) continue
        const prior: Record<string, string> = {}
        for (const k of cascadeFields) {
          if (k === field) break
          const v = next[k]
          if (v) prior[k] = v
        }
        const opts = computeDistinctOptions(catalog, field, prior)
        if (opts.length === 1) {
          next[field] = opts[0]
          changed = true
        } else {
          break
        }
      }
      return changed ? next : prev
    })
  }, [category, cascadeFields, catalog, catalogLoading, filters])

  const filteredRows = useMemo(() => {
    if (!category || catalog.length === 0) return { columns: [] as string[], items: [] as Record<string, unknown>[] }
    const entries = Object.entries(filters).filter(([, v]) => v && String(v).trim() !== '')
    if (entries.length === 0) return { columns: [], items: [] }
    const limit = 200
    const items: CatalogRow[] = []
    for (const row of catalog) {
      const ok = entries.every(([k, v]) => {
        const rv = row[k]
        if (rv == null) return false
        if (typeof rv === 'number' && Number.isFinite(rv)) {
          const n = Number(v)
          return Number.isFinite(n) && rv === n
        }
        return String(rv).trim() === String(v).trim()
      })
      if (ok) {
        items.push(row)
        if (items.length >= limit) break
      }
    }
    const columns = items.length > 0 ? Object.keys(items[0]) : []
    return { columns, items: items as Record<string, unknown>[] }
  }, [category, catalog, filters])

  const { data: supplierPrices, refetch: refetchSupplierPrices } = useQuery<SupplierPriceRow[]>({
    queryKey: ['supplier-prices', supplierId || null, category || null],
    enabled: Boolean(supplierId && category),
    queryFn: () => suppliersApi.getSupplierPrices(supplierId, category),
    staleTime: 15000,
  })

  const supplierPriceByRowId = useMemo(() => {
    const m = new Map<string, SupplierPriceRow>()
    for (const r of supplierPrices ?? []) {
      if (!r?.catalog_row_id) continue
      m.set(String(r.catalog_row_id), r)
    }
    return m
  }, [supplierPrices])

  const updateSupplierPriceMutation = useMutation({
    mutationFn: async (args: { catalog_row_id: string; list_price_inr: number }) => {
      if (!supplierId) throw new Error('Select a supplier first')
      return await suppliersApi.upsertPrice(supplierId, {
        catalog_table: category,
        catalog_row_id: args.catalog_row_id,
        list_price_inr: args.list_price_inr,
      })
    },
    onSuccess: async () => {
      setEditingRowId(null)
      setDraftPrice('')
      await Promise.all([reloadCatalog(), refetchSupplierPrices()])
    },
  })

  const visibleColumns = useMemo(() => {
    const cols = filteredRows.columns.length ? filteredRows.columns : ['row_id']
    const HIDE = new Set(['price_inr', 'client_id', 'row_id', 'source_file', 'created_at', 'updated_at'])
    const base = cols.filter((c) => !HIDE.has(c))
    const ordered = [
      ...(['sr_no'].filter((k) => base.includes(k)) as string[]),
      ...base.filter((c) => c !== 'sr_no'),
    ]
    return ordered.slice(0, 10)
  }, [filteredRows.columns])

  const pickField = (field: string, value: string) => {
    const ix = cascadeFields.indexOf(field)
    const next: Record<string, string> = { ...filters }
    const v = value.trim()
    if (!v) delete next[field]
    else next[field] = v
    for (const after of cascadeFields.slice(ix + 1)) delete next[after]
    setFilters(next)
  }

  const categoryLabel =
    categories?.find((c) => c.key === category)?.label ?? (category ? prettifyHeader(category) : '—')

  const supplierLabel = useMemo(() => {
    if (!supplierId) return ''
    const s = (suppliers ?? []).find((x) => x.id === supplierId)
    return s?.name ?? supplierId
  }, [supplierId, suppliers])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-surface-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-brand-navy-500">
              Masters Editor
            </p>
            <p className="text-[13px] text-surface-muted">
              Select a supplier, then search with cascading dropdowns and edit that supplier&apos;s list price per row.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refetchCats()
                void reloadCatalog()
                void refetchSupplierPrices()
              }}
            >
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Supplier</div>
            <Select value={toSelectValue(supplierId)} onValueChange={(v) => setSupplierId(fromSelectValue(v))}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder={suppliersPending ? 'Loading…' : 'Select supplier'}>
                  {supplierLabel || (suppliersPending ? 'Loading…' : 'Select supplier')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_EMPTY}>
                  <span className="text-muted-foreground">Select…</span>
                </SelectItem>
                {(suppliers ?? [])
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.is_preferred ? ' ★' : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
              Category
            </div>
            <Select value={toSelectValue(category)} onValueChange={(v) => setCategory(fromSelectValue(v))}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder={catsPending ? 'Loading…' : 'Select category'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_EMPTY}>
                  <span className="text-muted-foreground">Select…</span>
                </SelectItem>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label} {c.count != null ? `(${c.count})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 lg:col-span-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {schema.map((step, idx) => {
                const field = step.key
                const opts = optionsByField[field] ?? []
                const priorKeys = cascadeFields.slice(0, idx)
                const priorOk = priorKeys.every((k) => {
                  const options = optionsByField[k] ?? []
                  if (options.length <= 1) return true
                  return !!filters[k]
                })

                return (
                  <div key={field} className="space-y-1.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                      {step.label}
                    </div>
                    <Select
                      value={toSelectValue(filters[field])}
                      onValueChange={(raw) => pickField(field, fromSelectValue(raw))}
                      disabled={!priorOk || catalogLoading || !supplierId}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue
                          placeholder={
                            !priorOk
                              ? 'Complete fields above'
                              : !supplierId
                                ? 'Select supplier first'
                              : catalogLoading
                                ? 'Loading…'
                                : `Select ${step.label}`
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_EMPTY}>
                          <span className="text-muted-foreground">Select…</span>
                        </SelectItem>
                        {opts.map((o) => (
                          <SelectItem key={`${field}:${o}`} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 text-[12px] text-surface-muted">
              Showing <span className="font-medium text-gray-900">{categoryLabel}</span>. Results update
              automatically when you select filters.
            </div>
            {catalogError && <p className="mt-2 text-[12px] text-red-600">{catalogError}</p>}
            {catalogLoading && (
              <div className="mt-2 flex items-center gap-2 text-[12px] text-surface-muted">
                <Loader2 className="size-4 animate-spin" />
                Loading catalog…
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-surface-border bg-[#F4F5F0] px-4 py-3">
          <div className="text-[13px] text-surface-muted">
            <span className="font-medium text-gray-900">{filteredRows.items.length}</span> row
            {filteredRows.items.length === 1 ? '' : 's'} match current filters
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                <th className="px-4 py-3 whitespace-nowrap">Item</th>
                {visibleColumns.map((c) => (
                  <th key={c} className="px-4 py-3 whitespace-nowrap">
                    {prettifyHeader(c)}
                  </th>
                ))}
                <th className="px-4 py-3 whitespace-nowrap text-right">Supplier list price</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalogLoading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 3} className="px-4 py-8 text-center text-[13px] text-surface-muted">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Loading catalog…
                    </span>
                  </td>
                </tr>
              ) : filteredRows.items.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 3} className="px-4 py-8 text-center text-[13px] text-surface-muted">
                    Select some filters to see matching rows.
                  </td>
                </tr>
              ) : (
                filteredRows.items.map((row, idx) => {
                  const rid = String((row as any).row_id ?? idx)
                  const isEditing = editingRowId === rid
                  const supplierPrice = supplierPriceByRowId.get(rid) ?? null
                  const currentPrice = supplierPrice?.list_price_inr ?? null

                  return (
                    <tr
                      key={rid}
                      className="border-b border-[#E2E6DC] bg-white text-[13px] transition-colors hover:bg-[#F4F5F0]"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {bestLabel(row)}
                      </td>
                      {visibleColumns.map((c) => {
                        const val = row[c]
                        return (
                          <td key={c} className="px-4 py-3 text-surface-muted whitespace-nowrap">
                            {val == null || val === '' ? (
                              '—'
                            ) : (
                              String(val)
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span
                          className={cn(
                            'font-mono',
                            currentPrice == null ? 'text-brand-gold-700' : 'text-brand-gold-500',
                          )}
                        >
                          {currentPrice == null ? '₹TBD' : formatCurrency(Number(currentPrice))}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {!supplierId ? (
                          <span className="text-[12px] text-surface-muted">Select supplier</span>
                        ) : isEditing ? (
                          <div className="inline-flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={draftPrice}
                              onChange={(e) => setDraftPrice(e.target.value)}
                              className="h-9 w-28 text-right font-mono"
                            />
                            <Button
                              type="button"
                              size="sm"
                              className="bg-brand-green-500 text-white hover:bg-brand-green-600"
                              disabled={updateSupplierPriceMutation.isPending}
                              onClick={() => {
                                const trimmed = draftPrice.trim()
                                const next = Number(trimmed)
                                if (!trimmed || !Number.isFinite(next)) return
                                updateSupplierPriceMutation.mutate({
                                  catalog_row_id: rid,
                                  list_price_inr: next,
                                })
                              }}
                            >
                              <Save className="mr-1 size-4" />
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingRowId(null)
                                setDraftPrice('')
                              }}
                            >
                              <X className="mr-1 size-4" />
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingRowId(rid)
                                setDraftPrice(currentPrice == null ? '' : String(currentPrice))
                              }}
                            >
                              <Pencil className="mr-1 size-4" />
                              Edit price
                            </Button>
                            {currentPrice != null && (
                              <span className="inline-flex items-center gap-1 text-[12px] text-brand-green-700">
                                <Check className="size-3.5" /> Set
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {updateSupplierPriceMutation.isError && (
          <div className="border-t border-surface-border bg-white px-4 py-3 text-[13px] text-red-700">
            {(updateSupplierPriceMutation.error as Error)?.message || 'Update failed'}
          </div>
        )}
      </div>
    </div>
  )
}

