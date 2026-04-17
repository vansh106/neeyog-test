'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { mastersApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ProductCompletionContext, ProductCompletionItem } from '@/types'

const SELECT_EMPTY = '__none__'

function toSelectValue(v: string | null | undefined): string {
  return v != null && String(v).trim() !== '' ? String(v).trim() : SELECT_EMPTY
}

function fromSelectValue(v: string | null | undefined): string {
  return !v || v === SELECT_EMPTY ? '' : v
}

type Props = {
  enquiryId: string
  context: ProductCompletionContext
  isProcessing: boolean
  onFillSelf: (items: Array<{ index: number; category: string; selections: Record<string, string> }>) => void
  onAskClient: (ask: Record<string, Record<string, string[]>>) => void
}

function mergeCatalogAndInferredOptions(
  fromApi: string[],
  inferred: string | undefined,
): { options: string[]; inferredNotInCatalog: boolean } {
  const clean = (fromApi ?? []).filter((v) => v && v !== SELECT_EMPTY)
  const inf = inferred?.trim()
  if (!inf) return { options: clean, inferredNotInCatalog: false }
  if (clean.includes(inf)) return { options: clean, inferredNotInCatalog: false }
  return { options: [inf, ...clean], inferredNotInCatalog: true }
}

function CompletionRow({
  item,
  onChange,
}: {
  item: ProductCompletionItem
  onChange: (patch: Partial<ProductCompletionItem>) => void
}) {
  const schema = item.schema || []
  const firstMissingIndex = schema.findIndex((s) => (item.missing_keys ?? []).includes(s.key))
  // IMPORTANT: Unlike the previous iteration, we MUST let users adjust upstream fields.
  // Inferred selections from the parser may not exactly match DB values; if we start at
  // the first missing key, downstream options become empty ("__none__") and the user
  // cannot recover. So we show the full cascade (manual-dropdown style).
  const visibleSteps = schema
  const [stepOptions, setStepOptions] = useState<Record<string, string[]>>({})
  const [catalogEmpty, setCatalogEmpty] = useState(false)
  const [loading, setLoading] = useState(false)
  const matchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const next: Record<string, string[]> = {}
        const sel = { ...(item.selections || {}) }
        for (const step of visibleSteps) {
          const prior: Record<string, string> = {}
          const ix = schema.findIndex((s) => s.key === step.key)
          for (let i = 0; i < ix; i++) {
            const k = schema[i].key
            if (sel[k]) prior[k] = sel[k]
          }
          const res = await mastersApi.postCascadeValues<{ values: string[] }>({
            category: item.category,
            field: step.key,
            filters: prior,
          })
          if (cancelled) return
          next[step.key] = (res.values ?? []).filter((v) => v && v !== SELECT_EMPTY)
          if (!sel[step.key] && next[step.key].length === 1) {
            sel[step.key] = next[step.key][0]
          }
        }
        if (!cancelled) {
          setStepOptions(next)
          const firstKey = visibleSteps[0]?.key
          const firstLen = firstKey ? (next[firstKey]?.length ?? 0) : 0
          setCatalogEmpty(Boolean(firstKey && firstLen === 0))
          onChange({ selections: sel })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.category, JSON.stringify(item.selections), JSON.stringify(visibleSteps), JSON.stringify(schema)])

  useEffect(() => {
    if (matchTimer.current) clearTimeout(matchTimer.current)
    matchTimer.current = setTimeout(() => {
      mastersApi
        .postCascadeMatch<{ count: number; products: unknown[] }>({
          category: item.category,
          filters: item.selections,
        })
        .then((res) => {
          // When exactly one match, we still let user proceed; backend will resolve.
          void res
        })
        .catch(() => {
          /* ignore */
        })
    }, 250)
    return () => {
      if (matchTimer.current) clearTimeout(matchTimer.current)
    }
  }, [item.category, item.selections])

  return (
    <div className="rounded-xl border border-surface-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <div className="text-[13px] font-semibold text-gray-900">{item.product_description}</div>
        <div className="text-[12px] text-surface-muted">Category: {item.category}</div>
      </div>

      {catalogEmpty && !loading && (
        <div
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-950"
          role="status"
        >
          <p className="font-semibold text-amber-900">Product catalog has no rows in the database</p>
          <p className="mt-1 text-amber-900/90">
            These dropdowns are built from imported master data (per category sheet). Until the spreadsheet is
            imported, every option list stays empty.
          </p>
          <p className="mt-2 font-mono text-[11px] text-amber-950/90">
            From repo:{' '}
            <span className="whitespace-normal break-all">
              {'cd backend && python db/import_sheet_tables.py --file ../docs/Parth_valves_product_list.xlsx'}
            </span>
          </p>
          <p className="mt-1 font-mono text-[11px] text-amber-950/90">
            Docker (copy file in, then import):{' '}
            <span className="whitespace-normal break-all">
              {
                'docker compose cp ../docs/Parth_valves_product_list.xlsx cpq_api:/tmp/catalog.xlsx && docker compose exec api python db/import_sheet_tables.py --file /tmp/catalog.xlsx'
              }
            </span>
          </p>
        </div>
      )}

      {/* Show inferred values as chips, but keep them editable in the dropdowns below */}
      {firstMissingIndex > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-surface-muted">
          {schema.slice(0, firstMissingIndex).map((s) => {
            const v = item.selections?.[s.key]
            if (!v) return null
            return (
              <span key={s.key} className="rounded-full border border-[#E2E6DC] bg-[#F4F5F0] px-2 py-1">
                <span className="font-medium text-gray-700">{s.label}:</span> {v}
              </span>
            )
          })}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleSteps.map((step) => {
          const raw = stepOptions[step.key] ?? []
          const inferred = item.selections?.[step.key]
          const { options, inferredNotInCatalog } = mergeCatalogAndInferredOptions(raw, inferred)
          const disabled = false
          const value = toSelectValue(item.selections?.[step.key])
          return (
            <div key={step.key} className="space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">{step.label}</div>
              {inferredNotInCatalog && null}
              <Select
                value={value}
                onValueChange={(v) => {
                  const nextSel = { ...(item.selections || {}) }
                  const chosen = fromSelectValue(v)
                  if (chosen) nextSel[step.key] = chosen
                  else delete nextSel[step.key]
                  // Clear downstream keys when upstream changes
                  const ix = schema.findIndex((s) => s.key === step.key)
                  if (ix >= 0) {
                    for (let j = ix + 1; j < schema.length; j++) delete nextSel[schema[j].key]
                  }
                  onChange({ selections: nextSel })
                }}
                disabled={disabled}
              >
                <SelectTrigger className={cn('h-10 w-full min-w-0', step.key && item.missing_keys?.includes(step.key) ? 'border-brand-green-400' : '')}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_EMPTY}>—</SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ProductCompletionPanel({
  enquiryId,
  context,
  isProcessing,
  onFillSelf,
  onAskClient,
}: Props) {
  const [items, setItems] = useState<ProductCompletionItem[]>(context.items ?? [])
  const [mode, setMode] = useState<'fill_self' | 'ask_client'>('fill_self')

  useEffect(() => {
    setItems(context.items ?? [])
  }, [context])

  const askPayload = useMemo(() => {
    // Ask payload: { "<index>": { "<field>": [options...] } }
    // For now we ask for all missing keys; user can edit email later in HITL.
    const out: Record<string, Record<string, string[]>> = {}
    items.forEach((it) => {
      const per: Record<string, string[]> = {}
      ;(it.missing_keys ?? []).forEach((k) => {
        per[k] = [] // backend will show "Please specify" when empty
      })
      out[String(it.index)] = per
    })
    return out
  }, [items])

  return (
    <div className="rounded-xl border border-[#E2E6DC] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col gap-2">
        <h2 className="text-[18px] font-semibold text-gray-900">Complete product details</h2>
        <p className="text-[13px] text-surface-muted">{context.summary}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={mode === 'fill_self' ? 'default' : 'outline'}
          onClick={() => setMode('fill_self')}
          disabled={isProcessing}
        >
          Fill myself
        </Button>
        <Button
          type="button"
          variant={mode === 'ask_client' ? 'default' : 'outline'}
          onClick={() => setMode('ask_client')}
          disabled={isProcessing}
        >
          Ask client by email
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        {items.map((it) => (
          <CompletionRow
            key={`${enquiryId}-${it.index}`}
            item={it}
            onChange={(patch) =>
              setItems((prev) => prev.map((x) => (x.index === it.index ? ({ ...x, ...patch } as ProductCompletionItem) : x)))
            }
          />
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        {mode === 'fill_self' ? (
          <Button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              const payloadItems = items.map((it) => ({ index: it.index, category: it.category, selections: it.selections || {} }))
              onFillSelf(payloadItems)
            }}
          >
            {isProcessing ? 'Processing…' : 'Continue →'}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              onAskClient(askPayload)
            }}
          >
            {isProcessing ? 'Processing…' : 'Draft email →'}
          </Button>
        )}
      </div>
    </div>
  )
}

