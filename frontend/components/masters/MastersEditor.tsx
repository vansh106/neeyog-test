'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Pencil, RefreshCw, Save, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { mastersApi } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'

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

  const [category, setCategory] = useState<string>('')
  const [schema, setSchema] = useState<CascadeStep[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [optionsByField, setOptionsByField] = useState<Record<string, string[]>>({})
  const [loadingOptions, setLoadingOptions] = useState(false)

  const [results, setResults] = useState<{ columns: string[]; items: Record<string, unknown>[] }>({
    columns: [],
    items: [],
  })
  const [loadingRows, setLoadingRows] = useState(false)

  // Editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [draftPrice, setDraftPrice] = useState<string>('')

  const cascadeFields = useMemo(() => schema.map((s) => s.key), [schema])

  const loadSchema = useCallback(async (cat: string) => {
    const s = await mastersApi.getCascadeSchema<CascadeStep[]>(cat)
    setSchema(s ?? [])
    setFilters({})
    setOptionsByField({})
    setResults({ columns: [], items: [] })
    setEditingRowId(null)
    setDraftPrice('')
  }, [])

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

  const loadOptionsForField = useCallback(
    async (field: string, currentFilters: Record<string, string>) => {
      if (!category) return []
      try {
        const res = await mastersApi.postCascadeValues<{ values: string[] }>({
          category,
          field,
          filters: currentFilters,
        })
        return (res.values ?? []).filter(Boolean)
      } catch {
        return []
      }
    },
    [category],
  )

  const refreshCascadeOptions = useCallback(async () => {
    if (!category || schema.length === 0) return
    setLoadingOptions(true)
    try {
      const next: Record<string, string[]> = {}
      let updatedFilters: Record<string, string> = { ...filters }

      for (const field of cascadeFields) {
        // Only pass prior keys as filters.
        const priorKeys = cascadeFields.slice(0, cascadeFields.indexOf(field))
        const priorFilters: Record<string, string> = {}
        for (const k of priorKeys) {
          if (updatedFilters[k]) priorFilters[k] = updatedFilters[k]
        }

        const opts = await loadOptionsForField(field, priorFilters)
        next[field] = opts

        // If current selection invalid, clear it and anything after.
        const current = updatedFilters[field]
        if (current && !opts.includes(current)) {
          delete updatedFilters[field]
          for (const after of cascadeFields.slice(cascadeFields.indexOf(field) + 1)) {
            delete updatedFilters[after]
          }
        }
        // Auto-pick when only one option.
        if (!updatedFilters[field] && opts.length === 1) {
          updatedFilters[field] = opts[0]
        }
      }

      setOptionsByField(next)
      if (JSON.stringify(updatedFilters) !== JSON.stringify(filters)) setFilters(updatedFilters)
    } finally {
      setLoadingOptions(false)
    }
  }, [category, schema.length, cascadeFields, filters, loadOptionsForField])

  useEffect(() => {
    void refreshCascadeOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, schema.length, JSON.stringify(filters)])

  const fetchRows = useCallback(async () => {
    if (!category) return
    setLoadingRows(true)
    try {
      const res = await mastersApi.postCascadeRows<{
        category: string
        columns: string[]
        items: Record<string, unknown>[]
      }>({ category, filters, limit: 200 })
      setResults({ columns: res.columns ?? [], items: res.items ?? [] })
    } finally {
      setLoadingRows(false)
    }
  }, [category, filters])

  useEffect(() => {
    // Only fetch when at least one filter is selected.
    if (!category) return
    if (Object.keys(filters).length === 0) {
      setResults({ columns: [], items: [] })
      return
    }
    void fetchRows()
  }, [category, filters, fetchRows])

  const updatePriceMutation = useMutation({
    mutationFn: async (args: { row_id: string; price_inr: number | null }) => {
      return await mastersApi.updateSheetRowPrice(category, args.row_id, args.price_inr)
    },
    onSuccess: async () => {
      setEditingRowId(null)
      setDraftPrice('')
      await fetchRows()
    },
  })

  const priceColumnExists = results.columns.includes('price_inr')

  const visibleColumns = useMemo(() => {
    const cols = results.columns.length ? results.columns : ['row_id', 'price_inr']
    const base = cols.filter((c) => !['client_id'].includes(c))
    // Keep row_id and price near the front.
    const ordered = [
      ...(['row_id', 'price_inr'].filter((k) => base.includes(k)) as string[]),
      ...base.filter((c) => c !== 'row_id' && c !== 'price_inr'),
    ]
    return ordered.slice(0, 10) // keep table readable
  }, [results.columns])

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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-surface-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-brand-navy-500">
              Masters Editor
            </p>
            <p className="text-[13px] text-surface-muted">
              Search with cascading dropdowns, then edit <span className="font-mono">price_inr</span>{' '}
              per row.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refetchCats()
                void refreshCascadeOptions()
                void fetchRows()
              }}
            >
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
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

          <div className="md:col-span-2">
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
                      disabled={!priorOk || loadingOptions}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue
                          placeholder={
                            !priorOk
                              ? 'Complete fields above'
                              : loadingOptions
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
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-surface-border bg-[#F4F5F0] px-4 py-3">
          <div className="text-[13px] text-surface-muted">
            <span className="font-medium text-gray-900">{results.items.length}</span> row
            {results.items.length === 1 ? '' : 's'} match current filters
          </div>
          {!priceColumnExists && (
            <div className="text-[12px] text-brand-gold-700">
              This table doesn&apos;t expose <span className="font-mono">price_inr</span>.
            </div>
          )}
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
                <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="px-4 py-8 text-center text-[13px] text-surface-muted">
                    Loading…
                  </td>
                </tr>
              ) : results.items.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="px-4 py-8 text-center text-[13px] text-surface-muted">
                    Select some filters to see matching rows.
                  </td>
                </tr>
              ) : (
                results.items.map((row, idx) => {
                  const rid = String((row as any).row_id ?? idx)
                  const isEditing = editingRowId === rid
                  const currentPriceRaw = (row as any).price_inr as number | null | undefined
                  const currentPrice = currentPriceRaw == null ? null : Number(currentPriceRaw)

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
                        const isPrice = c === 'price_inr'
                        return (
                          <td key={c} className="px-4 py-3 text-surface-muted whitespace-nowrap">
                            {isPrice ? (
                              <span className={cn('font-mono', val == null ? 'text-brand-gold-700' : 'text-brand-gold-500')}>
                                {val == null ? '₹TBD' : formatCurrency(Number(val))}
                              </span>
                            ) : val == null || val === '' ? (
                              '—'
                            ) : (
                              String(val)
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {!priceColumnExists ? (
                          <span className="text-[12px] text-surface-muted">—</span>
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
                              disabled={updatePriceMutation.isPending}
                              onClick={() => {
                                const trimmed = draftPrice.trim()
                                const next =
                                  trimmed === '' ? null : Number.isFinite(Number(trimmed)) ? Number(trimmed) : null
                                updatePriceMutation.mutate({ row_id: rid, price_inr: next })
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

        {updatePriceMutation.isError && (
          <div className="border-t border-surface-border bg-white px-4 py-3 text-[13px] text-red-700">
            {(updatePriceMutation.error as Error)?.message || 'Update failed'}
          </div>
        )}
      </div>
    </div>
  )
}

