'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { suppliersApi } from '@/lib/api'
import { SIDEBAR_MASTER_CATEGORIES } from '@/lib/masterCatalogCategories'
import { cn } from '@/lib/utils'
import type {
  ResolvedSupplierCategoryPricing,
  SupplierCategoryPricing,
  SupplierResponse,
} from '@/types'

const CATEGORIES: { id: string; label: string; key: string }[] = [
  { id: 'all', label: 'All', key: 'all' },
  ...SIDEBAR_MASTER_CATEGORIES.map((c) => ({ id: c.key, label: c.label, key: c.key })),
]

export default function SupplierPricingTab() {
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([])
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [categoryTab, setCategoryTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadingVars, setLoadingVars] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [resolved, setResolved] = useState<ResolvedSupplierCategoryPricing | null>(null)
  const [savedRow, setSavedRow] = useState<SupplierCategoryPricing | null>(null)

  const [margin, setMargin] = useState<string>('')
  const [discount, setDiscount] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const list = await suppliersApi.getSuppliers(false)
      const active = list.filter((s) => s.is_active)
      setSuppliers(active)
      setSupplierId((cur) => {
        if (cur && active.some((s) => s.id === cur)) return cur
        const pref = active.find((s) => s.is_preferred)
        return pref?.id ?? active[0]?.id ?? null
      })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSuppliers()
  }, [loadSuppliers])

  const activeKey = useMemo(() => {
    const c = CATEGORIES.find((x) => x.id === categoryTab)
    return c?.key ?? 'all'
  }, [categoryTab])

  useEffect(() => {
    if (!supplierId) return
    let cancelled = false
    async function run() {
      setLoadingVars(true)
      setErr(null)
      try {
        const sid = supplierId
        if (!sid) return
        const [res, list] = await Promise.all([
          suppliersApi.getResolvedCategoryPricing(sid, activeKey),
          suppliersApi.listCategoryPricing(sid),
        ])
        if (cancelled) return
        setResolved(res)
        const found = list.find((r) => r.category_key === activeKey) ?? null
        setSavedRow(found)
        setMargin(found?.margin_multiplier != null ? String(found.margin_multiplier) : '')
        setDiscount(found?.supplier_discount_pct != null ? String(found.supplier_discount_pct) : '')
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load pricing')
      } finally {
        if (!cancelled) setLoadingVars(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [supplierId, activeKey])

  if (loading) return <p className="text-[14px] text-surface-muted">Loading…</p>

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-2 lg:w-[280px]">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Suppliers</p>
        <div className="max-h-[420px] space-y-1 overflow-y-auto rounded-xl border border-surface-border bg-white p-2">
          {suppliers.length === 0 ? (
            <p className="p-2 text-[13px] text-surface-muted">No active suppliers.</p>
          ) : (
            suppliers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSupplierId(s.id)}
                className={cn(
                  'flex w-full flex-col rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
                  s.id === supplierId ? 'bg-brand-navy-500 text-white' : 'hover:bg-[#F4F5F0]',
                )}
              >
                <span className="font-medium">{s.name}</span>
                <span
                  className={cn(
                    'text-[11px]',
                    s.id === supplierId ? 'text-white/80' : 'text-surface-muted',
                  )}
                >
                  {s.is_preferred ? 'Preferred' : '\u00a0'}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-3">
        {err && <p className="text-[13px] text-red-600">{err}</p>}
        <div className="flex flex-wrap items-center gap-2 border-b border-surface-border pb-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryTab(c.id)}
              className={cn(
                'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                categoryTab === c.id
                  ? 'bg-brand-green-500 text-white'
                  : 'bg-[#F4F5F0] text-gray-700 hover:bg-[#E8EAE4]',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {!supplierId ? (
          <p className="text-[14px] text-surface-muted">Select a supplier to edit category pricing.</p>
        ) : loadingVars ? (
          <p className="text-[14px] text-surface-muted">Loading…</p>
        ) : (
          <div className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold text-gray-900">Supplier pricing (per category)</p>
                <p className="mt-1 text-[13px] text-surface-muted">
                  Editing overrides for <span className="font-medium text-gray-900">{activeKey}</span>. If empty, it
                  falls back to <span className="font-medium text-gray-900">all</span>.
                </p>
              </div>
              <Button
                type="button"
                disabled={saving}
                onClick={async () => {
                  if (!supplierId) return
                  setSaving(true)
                  setErr(null)
                  try {
                    const payload: Record<string, unknown> = {}
                    if (margin.trim() !== '') payload.margin_multiplier = Number(margin)
                    if (discount.trim() !== '') payload.supplier_discount_pct = Number(discount)
                    const saved = await suppliersApi.upsertCategoryPricing(supplierId, activeKey, payload)
                    setSavedRow(saved)
                    const res = await suppliersApi.getResolvedCategoryPricing(supplierId, activeKey)
                    setResolved(res)
                  } catch (e: unknown) {
                    setErr(e instanceof Error ? e.message : 'Save failed')
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Margin (x)</p>
                <Input
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                  placeholder={String(resolved?.margin_multiplier ?? 1.4)}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Discount (%)</p>
                <Input
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder={String(resolved?.supplier_discount_pct ?? 0)}
                />
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-surface-border bg-surface-page p-3 text-[13px] text-surface-muted">
              <p>
                <span className="font-medium text-gray-900">Resolved:</span> margin{' '}
                <span className="font-mono">{resolved?.margin_multiplier ?? 1.4}</span> · discount{' '}
                <span className="font-mono">{resolved?.supplier_discount_pct ?? 0}</span>%
              </p>
              {savedRow ? (
                <p className="mt-1">
                  Saved override row: <span className="font-mono">{savedRow.category_key}</span>
                </p>
              ) : (
                <p className="mt-1">No override saved for this category (falls back to all/defaults).</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

