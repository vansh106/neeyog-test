'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Loader2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import EmptyState from '@/components/ui/EmptyState'
import { othersMastersHref } from '@/components/layout/OthersSidebarNav'
import { mastersApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { OthersCategory, OthersSheet, OthersSheetRow } from '@/types'

type DraftRow = {
  id?: string
  sr_no: string
  description: string
  price_inr: string
  isNew?: boolean
}

const EMPTY_CATEGORIES: OthersCategory[] = []
const EMPTY_SHEET_ROWS: OthersSheetRow[] = []

function rowsToDraft(rows: OthersSheetRow[]): DraftRow[] {
  return rows.map((r) => ({
    id: r.id,
    sr_no: r.sr_no != null ? String(r.sr_no) : '',
    description: r.description ?? '',
    price_inr: r.price_inr != null ? String(r.price_inr) : '',
  }))
}

function draftRowsEqual(a: DraftRow[], b: DraftRow[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (row, i) =>
      row.id === b[i].id &&
      row.sr_no === b[i].sr_no &&
      row.description === b[i].description &&
      row.price_inr === b[i].price_inr &&
      row.isNew === b[i].isNew,
  )
}

function parseNum(v: string): number | null {
  const n = Number(v.trim())
  return Number.isFinite(n) ? n : null
}

export default function OthersMastersTab() {
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const sheetIdFromUrl = searchParams.get('sheetId')
  const categoryIdFromUrl = searchParams.get('categoryId')

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    categoryIdFromUrl,
  )
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(sheetIdFromUrl)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSheetName, setNewSheetName] = useState('')
  const [draftRows, setDraftRows] = useState<DraftRow[]>([])
  const [dirty, setDirty] = useState(false)

  const { data: treeData, isPending: treeLoading } = useQuery({
    queryKey: ['othersMastersTree'],
    queryFn: () => mastersApi.getOthersTree<{ items: OthersCategory[] }>(),
    staleTime: 10_000,
  })

  const categories = treeData?.items ?? EMPTY_CATEGORIES

  const syncSelectionUrl = useCallback(
    (categoryId: string | null, sheetId: string | null) => {
      if (categoryId && sheetId) {
        router.replace(othersMastersHref(categoryId, sheetId), { scroll: false })
      } else if (categoryId) {
        const params = new URLSearchParams({ tab: 'others', categoryId })
        router.replace(`/masters?${params.toString()}`, { scroll: false })
      } else {
        router.replace('/masters?tab=others', { scroll: false })
      }
    },
    [router],
  )

  useEffect(() => {
    if (!categories.length) return
    if (sheetIdFromUrl) {
      setSelectedSheetId(sheetIdFromUrl)
      const cat =
        categories.find((c) => c.id === categoryIdFromUrl) ??
        categories.find((c) => c.sheets.some((s) => s.id === sheetIdFromUrl))
      if (cat) setSelectedCategoryId(cat.id)
      return
    }
    if (categoryIdFromUrl) {
      setSelectedCategoryId(categoryIdFromUrl)
      setSelectedSheetId(null)
    }
  }, [categories, sheetIdFromUrl, categoryIdFromUrl])

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  )

  const selectedSheet = useMemo(
    () => selectedCategory?.sheets.find((s) => s.id === selectedSheetId) ?? null,
    [selectedCategory, selectedSheetId],
  )

  const { data: rowsData, isPending: rowsLoading } = useQuery({
    queryKey: ['othersSheetRows', selectedSheetId],
    queryFn: () =>
      mastersApi.getOthersSheetRows<{ items: OthersSheetRow[] }>(selectedSheetId!),
    enabled: !!selectedSheetId,
    staleTime: 5_000,
  })

  const syncDraftFromRows = useCallback((rows: OthersSheetRow[]) => {
    const next = rowsToDraft(rows)
    setDraftRows((prev) => (draftRowsEqual(prev, next) ? prev : next))
    setDirty(false)
  }, [])

  const rows = rowsData?.items ?? EMPTY_SHEET_ROWS

  const invalidateTree = () => qc.invalidateQueries({ queryKey: ['othersMastersTree'] })

  const createCategoryMut = useMutation({
    mutationFn: (name: string) => mastersApi.createOthersCategory(name),
    onSuccess: (cat: OthersCategory) => {
      setNewCategoryName('')
      invalidateTree()
      setSelectedCategoryId(cat.id)
      setSelectedSheetId(null)
      setDraftRows([])
      syncSelectionUrl(cat.id, null)
    },
  })

  const deleteCategoryMut = useMutation({
    mutationFn: (id: string) => mastersApi.deleteOthersCategory(id),
    onSuccess: () => {
      invalidateTree()
      setSelectedCategoryId(null)
      setSelectedSheetId(null)
      setDraftRows([])
    },
  })

  const createSheetMut = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      mastersApi.createOthersSheet(categoryId, name),
    onSuccess: (sheet: OthersSheet) => {
      setNewSheetName('')
      invalidateTree()
      setSelectedCategoryId(sheet.category_id)
      setSelectedSheetId(sheet.id)
      setDraftRows([])
      setDirty(false)
      syncSelectionUrl(sheet.category_id, sheet.id)
    },
  })

  const deleteSheetMut = useMutation({
    mutationFn: (id: string) => mastersApi.deleteOthersSheet(id),
    onSuccess: () => {
      invalidateTree()
      setSelectedSheetId(null)
      setDraftRows([])
      qc.invalidateQueries({ queryKey: ['othersSheetRows'] })
    },
  })

  const saveRowsMut = useMutation({
    mutationFn: async () => {
      if (!selectedSheetId) return
      const existingIds = new Set(rows.map((r) => r.id))
      const draftIds = new Set(draftRows.filter((d) => d.id).map((d) => d.id!))

      for (const rid of existingIds) {
        if (!draftIds.has(rid)) {
          await mastersApi.deleteOthersRow(selectedSheetId, rid)
        }
      }

      for (const d of draftRows) {
        const desc = d.description.trim()
        if (!desc) continue
        const sr = parseNum(d.sr_no)
        const price = parseNum(d.price_inr)
        if (d.isNew || !d.id) {
          await mastersApi.createOthersRow(selectedSheetId, {
            sr_no: sr,
            description: desc,
            price_inr: price,
          })
        } else {
          await mastersApi.updateOthersRow(selectedSheetId, d.id, {
            sr_no: sr,
            description: desc,
            price_inr: price,
          })
        }
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['othersSheetRows', selectedSheetId] })
      await invalidateTree()
      setDraftRows([])
      setDirty(false)
    },
  })

  useEffect(() => {
    if (!selectedSheetId || rowsLoading || dirty) return
    const items = rowsData?.items
    if (!items) return
    syncDraftFromRows(items)
  }, [selectedSheetId, rowsData?.items, rowsLoading, dirty, syncDraftFromRows])

  const addRow = () => {
    setDraftRows((prev) => [
      ...prev,
      { sr_no: String(prev.length + 1), description: '', price_inr: '', isNew: true },
    ])
    setDirty(true)
  }

  const updateDraft = (index: number, patch: Partial<DraftRow>) => {
    setDraftRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  const removeDraftRow = (index: number) => {
    setDraftRows((prev) => prev.filter((_, i) => i !== index))
    setDirty(true)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-gold-200 bg-brand-gold-50/60 p-4 text-[13px] text-gray-800">
        <p className="font-semibold text-brand-gold-900">Others product family</p>
        <p className="mt-1 text-surface-muted">
          Create categorisations and master sheets here. Each sheet has Sr. no., Description, and
          Price. Valves and Hoses masters remain read-only via import — only Others is editable in
          the UI.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_220px_1fr]">
        {/* Categories */}
        <div className="rounded-xl border border-surface-border bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A9488]">
            Categorisations
          </p>
          <div className="mt-2 flex gap-1">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category"
              className="h-8 text-[13px]"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 px-2"
              disabled={!newCategoryName.trim() || createCategoryMut.isPending}
              onClick={() => createCategoryMut.mutate(newCategoryName.trim())}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <ul className="mt-2 max-h-[360px] space-y-1 overflow-y-auto">
            {treeLoading ? (
              <li className="flex items-center gap-2 py-2 text-[12px] text-surface-muted">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </li>
            ) : categories.length === 0 ? (
              <li className="py-2 text-[12px] text-surface-muted">No categories yet.</li>
            ) : (
              categories.map((cat) => (
                <li key={cat.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id)
                      setSelectedSheetId(null)
                      setDraftRows([])
                      setDirty(false)
                      syncSelectionUrl(cat.id, null)
                    }}
                    className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-[13px] ${
                      selectedCategoryId === cat.id
                        ? 'bg-brand-green-50 font-medium text-brand-green-800'
                        : 'hover:bg-surface-page'
                    }`}
                  >
                    {cat.name}
                  </button>
                  <button
                    type="button"
                    title="Delete category"
                    className="rounded p-1 text-surface-muted hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      if (window.confirm(`Delete category "${cat.name}" and all its sheets?`)) {
                        deleteCategoryMut.mutate(cat.id)
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Sheets */}
        <div className="rounded-xl border border-surface-border bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A9488]">Sheets</p>
          {!selectedCategory ? (
            <p className="mt-3 text-[12px] text-surface-muted">Select a category.</p>
          ) : (
            <>
              <div className="mt-2 flex gap-1">
                <Input
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  placeholder="New sheet"
                  className="h-8 text-[13px]"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0 px-2"
                  disabled={!newSheetName.trim() || createSheetMut.isPending}
                  onClick={() =>
                    createSheetMut.mutate({
                      categoryId: selectedCategory.id,
                      name: newSheetName.trim(),
                    })
                  }
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <ul className="mt-2 max-h-[360px] space-y-1 overflow-y-auto">
                {selectedCategory.sheets.length === 0 ? (
                  <li className="py-2 text-[12px] text-surface-muted">No sheets yet.</li>
                ) : (
                  selectedCategory.sheets.map((sheet) => (
                    <li key={sheet.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId(selectedCategory.id)
                          setSelectedSheetId(sheet.id)
                          setDraftRows([])
                          setDirty(false)
                          syncSelectionUrl(selectedCategory.id, sheet.id)
                        }}
                        className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-[13px] ${
                          selectedSheetId === sheet.id
                            ? 'bg-brand-green-50 font-medium text-brand-green-800'
                            : 'hover:bg-surface-page'
                        }`}
                      >
                        <span className="block truncate">{sheet.name}</span>
                        <span className="text-[11px] text-surface-muted">
                          {sheet.row_count ?? 0} row{(sheet.row_count ?? 0) === 1 ? '' : 's'}
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Delete sheet"
                        className="rounded p-1 text-surface-muted hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          if (window.confirm(`Delete sheet "${sheet.name}" and all rows?`)) {
                            deleteSheetMut.mutate(sheet.id)
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </div>

        {/* Rows editor */}
        <div className="rounded-xl border border-surface-border bg-white p-4 shadow-sm">
          {!selectedSheet ? (
            <EmptyState
              icon={FolderOpen}
              title="Select a sheet"
              description="Choose or create a sheet to edit Sr. no., Description, and Price rows."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[15px] font-semibold text-gray-900">{selectedSheet.name}</p>
                  <p className="text-[12px] text-surface-muted">
                    {selectedCategory?.name} · {selectedSheet.catalog_key}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addRow}>
                    <Plus className="mr-1 size-4" /> Add row
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!dirty || saveRowsMut.isPending}
                    className="bg-brand-green-500 text-white hover:bg-brand-green-600"
                    onClick={() => saveRowsMut.mutate()}
                  >
                    {saveRowsMut.isPending ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : null}
                    Save rows
                  </Button>
                </div>
              </div>

              {rowsLoading ? (
                <div className="mt-6 flex items-center gap-2 text-[13px] text-surface-muted">
                  <Loader2 className="size-4 animate-spin" /> Loading rows…
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-surface-border text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                        <th className="px-2 py-2 w-24">Sr. no.</th>
                        <th className="px-2 py-2">Description</th>
                        <th className="px-2 py-2 w-32">Price (INR)</th>
                        <th className="px-2 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {draftRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2 py-6 text-center text-surface-muted">
                            No rows — click Add row to start.
                          </td>
                        </tr>
                      ) : (
                        draftRows.map((row, i) => (
                          <tr key={row.id ?? `new-${i}`} className="border-b border-surface-border">
                            <td className="px-2 py-1.5">
                              <Input
                                value={row.sr_no}
                                onChange={(e) => updateDraft(i, { sr_no: e.target.value })}
                                className="h-8 font-mono"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                value={row.description}
                                onChange={(e) => updateDraft(i, { description: e.target.value })}
                                className="h-8"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={row.price_inr}
                                onChange={(e) => updateDraft(i, { price_inr: e.target.value })}
                                className="h-8 font-mono"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                className="rounded p-1 text-surface-muted hover:bg-red-50 hover:text-red-700"
                                onClick={() => removeDraftRow(i)}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {draftRows.some((r) => r.price_inr && parseNum(r.price_inr) != null) && (
                    <p className="mt-2 text-[12px] text-surface-muted">
                      Preview:{' '}
                      {draftRows
                        .filter((r) => r.description.trim())
                        .map((r) => {
                          const p = parseNum(r.price_inr)
                          return `${r.description.trim()}${p != null ? ` — ${formatCurrency(p)}` : ''}`
                        })
                        .join(' · ')}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
