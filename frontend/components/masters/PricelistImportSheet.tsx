'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, CloudUpload, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { catalogSpecFieldsFor, smartMapExcelHeader } from '@/lib/constants'
import { SIDEBAR_MASTER_CATEGORIES } from '@/lib/masterCatalogCategories'
import { suppliersApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { ImportResult, PreviewResult, PreviewRow } from '@/types'
import { cn } from '@/lib/utils'

const IMPORT_CATEGORIES: { key: string; label: string }[] = SIDEBAR_MASTER_CATEGORIES.map(
  ({ key, label }) => ({ key, label }),
)

function hasSpecMapping(map: Record<string, string>): boolean {
  return Object.values(map).some(
    (v) => v && v !== 'price' && v !== 'discount_override' && v !== '__skip__',
  )
}

function hasPriceMapping(map: Record<string, string>): boolean {
  return Object.values(map).includes('price')
}

function excelPreviewText(data: Record<string, string>): string {
  return Object.entries(data)
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ')
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  supplierName: string
  defaultCatalogTable: string
  onImportComplete: () => void
  onViewTable?: () => void
}

export default function PricelistImportSheet({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  defaultCatalogTable,
  onImportComplete,
  onViewTable,
}: Props) {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [approxRows, setApproxRows] = useState(0)
  const [readError, setReadError] = useState<string | null>(null)
  const [importCategory, setImportCategory] = useState(defaultCatalogTable)
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [autoMapped, setAutoMapped] = useState(0)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [previewFilter, setPreviewFilter] = useState<'all' | 'ok' | 'fail'>('all')
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  const fieldOptions = useMemo(() => {
    return catalogSpecFieldsFor(importCategory)
  }, [importCategory])

  useEffect(() => {
    if (!open) return
    setStep(1)
    setFile(null)
    setHeaders([])
    setApproxRows(0)
    setReadError(null)
    setImportCategory(defaultCatalogTable)
    setColumnMap({})
    setAutoMapped(0)
    setPreview(null)
    setImportResult(null)
    setPreviewFilter('all')
    setBusy(false)
    setLocalErr(null)
  }, [open, defaultCatalogTable])

  useEffect(() => {
    if (headers.length === 0) return
    const next: Record<string, string> = {}
    let n = 0
    for (const h of headers) {
      const sm = smartMapExcelHeader(h)
      next[h] = sm ?? '__skip__'
      if (sm) n += 1
    }
    setColumnMap(next)
    setAutoMapped(n)
  }, [headers, importCategory])

  const readFile = useCallback(async (f: File) => {
    setReadError(null)
    setLocalErr(null)
    setFile(f)
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
        header: 1,
        defval: '',
      }) as (string | number | null)[][]
      const hdr = (rows[0] ?? []).map((c) => String(c ?? '').trim())
      setHeaders(hdr)
      setApproxRows(Math.max(0, rows.length - 1))
    } catch (e: unknown) {
      setReadError(e instanceof Error ? e.message : 'Could not read Excel')
      setHeaders([])
      setApproxRows(0)
    }
  }, [])

  const canGoPreview = file && hasPriceMapping(columnMap) && hasSpecMapping(columnMap) && !readError

  const filteredPreviewRows = useMemo(() => {
    if (!preview) return []
    if (previewFilter === 'all') return preview.preview_rows
    if (previewFilter === 'ok') {
      return preview.preview_rows.filter((r) => r.status === 'will_create' || r.status === 'will_update')
    }
    return preview.preview_rows.filter((r) => r.status === 'no_match')
  }, [preview, previewFilter])

  async function runPreview() {
    if (!file || !canGoPreview) return
    setBusy(true)
    setLocalErr(null)
    try {
      const res = await suppliersApi.previewPricelist(supplierId, importCategory, columnMap, file)
      setPreview(res)
      setStep(3)
    } catch (e: unknown) {
      setLocalErr(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    if (!file || !preview || preview.will_match === 0) return
    setBusy(true)
    setLocalErr(null)
    try {
      const res = await suppliersApi.importPricelist(supplierId, importCategory, columnMap, file)
      setImportResult(res)
      setStep(4)
      onImportComplete()
    } catch (e: unknown) {
      setLocalErr(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  function statusChip(row: PreviewRow) {
    if (row.status === 'will_create') {
      return (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
          Will create
        </span>
      )
    }
    if (row.status === 'will_update') {
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
          Will update
        </span>
      )
    }
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-900">No match</span>
    )
  }

  function noMatchTitle(row: PreviewRow): string {
    if (row.status !== 'no_match') return ''
    const parts = Object.entries(row.excel_data)
      .filter(([k]) => k !== 'price')
      .map(([k, v]) => `${k}='${v}'`)
      .slice(0, 8)
    return `No catalog row found for ${parts.join(', ')} — ${row.reason ?? ''}`
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-[700px] flex-col sm:max-w-[700px]">
        <SheetHeader>
          <SheetTitle>Import supplier pricelist</SheetTitle>
          <SheetDescription>
            Upload your supplier&apos;s Excel file — we match rows to our catalog by specs, then save list prices for{' '}
            <span className="font-medium text-foreground">{supplierName}</span>.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
            Step {step} of 4
          </p>
          {localErr && <p className="text-[13px] text-red-600">{localErr}</p>}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                  Product category
                </div>
                <Select
                  value={importCategory}
                  onValueChange={(v) => v && setImportCategory(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPORT_CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-border bg-[#F9FAF7] px-4 py-10 text-center transition-colors hover:border-brand-navy-300',
                  readError && 'border-red-200 bg-red-50/30',
                )}
              >
                <CloudUpload className="size-10 text-surface-muted" />
                <span className="text-[14px] font-medium text-gray-900">Drop Excel here or click to browse</span>
                <span className="text-[12px] text-surface-muted">.xlsx only — first sheet is used</span>
                <Input
                  type="file"
                  accept=".xlsx,.xlsm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void readFile(f)
                  }}
                />
              </label>
              {readError && <p className="text-[13px] text-red-600">{readError}</p>}
              {file && !readError && (
                <p className="text-[13px] text-surface-muted">
                  <span className="font-medium text-gray-900">{file.name}</span> — about {approxRows} data row
                  {approxRows === 1 ? '' : 's'}
                  {headers.length > 0 && (
                    <span className="mt-2 block text-[12px]">
                      Columns: {headers.filter(Boolean).join(', ')}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-[13px] text-surface-muted">
                Auto-mapped <span className="font-semibold text-gray-900">{autoMapped}</span> column
                {autoMapped === 1 ? '' : 's'}. Adjust any row — we need <span className="font-medium">price</span>{' '}
                plus at least one spec column.
              </p>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-lg border border-surface-border p-3">
                <div className="grid grid-cols-[1fr_minmax(180px,1fr)] gap-2 text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                  <span>Column in your file</span>
                  <span>Maps to</span>
                </div>
                {headers.map((h, idx) => (
                  <div
                    key={`${idx}-${h || 'col'}`}
                    className="grid grid-cols-[1fr_minmax(180px,1fr)] items-center gap-2 text-[13px]"
                  >
                    <span className="truncate font-mono text-[12px]" title={h}>
                      {h || '(empty)'}
                    </span>
                    <Select
                      value={columnMap[h] ?? '__skip__'}
                      onValueChange={(v) =>
                        setColumnMap((prev) => ({ ...prev, [h]: v != null && v !== '' ? v : '__skip__' }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldOptions.map((opt) => (
                          <SelectItem key={opt.key} value={opt.key}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 rounded-lg bg-[#F4F5F0] p-3 text-[13px]">
                <span className="text-emerald-800">✅ {preview.will_match} will import</span>
                <span className="text-red-700">❌ {preview.will_fail} could not match</span>
                {preview.will_update != null && (
                  <span className="text-amber-800">✏️ {preview.will_update} updates</span>
                )}
                {preview.will_create != null && (
                  <span className="text-emerald-800">＋ {preview.will_create} new</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'ok', 'fail'] as const).map((f) => (
                  <Button
                    key={f}
                    type="button"
                    size="sm"
                    variant={previewFilter === f ? 'default' : 'outline'}
                    onClick={() => setPreviewFilter(f)}
                  >
                    {f === 'all' ? 'All' : f === 'ok' ? 'Will import' : 'Failed'}
                  </Button>
                ))}
              </div>
              {preview.will_match === 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 text-[14px] text-red-900">
                  No rows could be matched to our catalog. Check category and column mapping.
                  <div className="mt-3">
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
                      <ChevronLeft className="mr-1 size-4" />
                      Back to mapping
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="max-h-[45vh] overflow-auto rounded-lg border border-surface-border">
                  <table className="w-full border-collapse text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-[#E2E6DC] bg-[#F4F5F0] text-[11px] uppercase tracking-wide text-[#8A9488]">
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Excel</th>
                        <th className="px-2 py-2">Matched</th>
                        <th className="px-2 py-2 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPreviewRows.map((row, i) => (
                        <tr key={i} className="border-b border-[#E2E6DC]">
                          <td className="px-2 py-2 align-top" title={noMatchTitle(row)}>
                            {statusChip(row)}
                          </td>
                          <td className="max-w-[180px] px-2 py-2 align-top text-surface-muted">
                            {excelPreviewText(row.excel_data)}
                          </td>
                          <td className="px-2 py-2 align-top text-gray-900">
                            {row.matched_catalog ? (
                              <span className="line-clamp-3">{row.matched_catalog.description}</span>
                            ) : (
                              <span className="text-red-700">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right font-mono align-top">
                            {row.price != null ? formatCurrency(row.price) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 4 && importResult && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100">
                <Check className="size-9 text-emerald-700" />
              </div>
              <h3 className="text-[18px] font-semibold text-gray-900">Import complete</h3>
              <div className="space-y-1 text-left text-[14px] text-gray-800">
                <p>✅ {importResult.created} new prices added</p>
                <p>✏️ {importResult.updated} prices updated</p>
                <p>❌ {importResult.unmatched} rows skipped</p>
              </div>
              {importResult.unmatched > 0 && (
                <details className="rounded-lg border border-surface-border bg-white p-3 text-left text-[12px]">
                  <summary className="cursor-pointer font-medium text-gray-900">View unmatched rows</summary>
                  <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-4 text-surface-muted">
                    {importResult.unmatched_rows.map((u, j) => (
                      <li key={j}>{JSON.stringify(u)}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="mt-auto flex flex-row flex-wrap gap-2 border-t border-surface-border pt-4">
          {step > 1 && step < 4 && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="mr-1 size-4" />
              Back
            </Button>
          )}
          {step === 1 && (
            <Button
              type="button"
              disabled={!file || !!readError || headers.length === 0}
              onClick={() => setStep(2)}
            >
              Next: Map columns
            </Button>
          )}
          {step === 2 && (
            <Button type="button" disabled={!canGoPreview || busy} onClick={() => void runPreview()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : 'Preview import →'}
            </Button>
          )}
          {step === 3 && preview && preview.will_match > 0 && (
            <Button type="button" disabled={busy} onClick={() => void runImport()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : `Import ${preview.will_match} prices`}
            </Button>
          )}
          {step === 4 && (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  onViewTable?.()
                }}
              >
                View pricing table
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
