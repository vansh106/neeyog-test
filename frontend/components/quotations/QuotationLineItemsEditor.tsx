'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'

import { ValveConfigurator, CompletedProductCard } from '@/components/configurator/ValveConfigurator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  assemblyLabel,
  assemblyPartComponentKey,
  assemblyPartUnitMultiplier,
  assembledToLineItem,
  catalogPartsForAssembly,
  uuidv4,
} from '@/lib/manualAssemblyLineItem'
import { quotationsApi, suppliersApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { AssembledProduct, PriceCalculationResult, SupplierResponse } from '@/types'

type ProductPricingCalc = {
  productId: string
  label: string
  supplierName: string | null
  ok: boolean
  missing: string[]
  rows: Array<{ component: string; calc: PriceCalculationResult; unitMult?: number }>
  assemblyUnit: number
  lineTotal: number
}

type Props = {
  quotationId: string
  /** Bumps on each Edit open — keeps cascade + pricing effects in sync with server prefill. */
  prefillRevision: number
  initialAssembledProducts: AssembledProduct[]
  onCancel: () => void
  onSaved: () => void | Promise<void>
}

export default function QuotationLineItemsEditor({
  quotationId,
  prefillRevision,
  initialAssembledProducts,
  onCancel,
  onSaved,
}: Props) {
  const [assembledProducts, setAssembledProducts] = useState<AssembledProduct[]>(initialAssembledProducts)
  const [activeConfigIds, setActiveConfigIds] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([])
  const [productCalcs, setProductCalcs] = useState<ProductPricingCalc[]>([])
  /** Start true when we open with lines so we never paint the pricing table before rows exist (avoids missing temp-price cells). */
  const [pricingLoading, setPricingLoading] = useState(() => initialAssembledProducts.length > 0)
  const [tempQuoteUnitByProduct, setTempQuoteUnitByProduct] = useState<Record<string, string>>({})
  const [customerDiscountByProduct, setCustomerDiscountByProduct] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const cloned = initialAssembledProducts.map(
      (p) => JSON.parse(JSON.stringify(p)) as AssembledProduct,
    )
    setAssembledProducts(cloned)
    setActiveConfigIds(cloned.length ? [] : [uuidv4()])
    setEditingId(null)
    setTempQuoteUnitByProduct({})
    setCustomerDiscountByProduct({})
    setErrors({})
    if (cloned.length > 0) {
      setProductCalcs([])
      setPricingLoading(true)
    }
  }, [initialAssembledProducts, prefillRevision])

  useEffect(() => {
    if (assembledProducts.length === 0 && activeConfigIds.length === 0) {
      setActiveConfigIds([uuidv4()])
    }
  }, [assembledProducts.length, activeConfigIds.length])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sList = await suppliersApi.getSuppliers(true)
        if (!cancelled) setSuppliers(sList)
      } catch {
        if (!cancelled) setSuppliers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (assembledProducts.length === 0) {
      setProductCalcs([])
      setPricingLoading(false)
      return
    }
    let cancelled = false
    setPricingLoading(true)
    ;(async () => {
      const out: ProductPricingCalc[] = []
      for (const p of assembledProducts) {
        const supplierId = p.supplier_id
        const componentKeyForPart = assemblyPartComponentKey
        const parts = catalogPartsForAssembly(p)
        const missing: string[] = []
        if (parts.length === 0) missing.push('Valve configuration')
        if (suppliers.length > 0 && !supplierId) missing.push('Supplier selection')
        const rows: Array<{ component: string; calc: PriceCalculationResult; unitMult?: number }> = []
        if (supplierId || p.component_pricing) {
          for (const part of parts) {
            const compKey = componentKeyForPart(part.label)
            const partSupplierId = compKey
              ? (p.component_pricing?.[compKey]?.supplier_id ?? supplierId)
              : supplierId
            if (!partSupplierId) {
              missing.push(`${part.label} supplier`)
              continue
            }
            const pr = await suppliersApi.getProductPrice(partSupplierId, part.catalog_table, part.catalog_row_id)
            if (!pr) {
              missing.push(part.label)
              continue
            }
            const vars = await suppliersApi.getResolvedCategoryPricing(partSupplierId, part.catalog_table)
            const calc = await suppliersApi.calculatePrice({
              list_price: pr.list_price_inr,
              supplier_discount_pct: vars.supplier_discount_pct,
              margin_multiplier: vars.margin_multiplier,
              customer_discount_pct: 0,
              quantity: p.quantity,
            })
            const unitMult = assemblyPartUnitMultiplier(part.label, p)
            rows.push({ component: part.label, calc, unitMult })
          }
        }
        const ok = parts.length > 0 && missing.length === 0
        const assemblyUnit = ok
          ? rows.reduce((sum, r) => sum + r.calc.final_unit_price * (r.unitMult ?? 1), 0)
          : 0
        const lineTotal = ok ? rows.reduce((sum, r) => sum + r.calc.line_total, 0) : 0
        out.push({
          productId: p.id,
          label: assemblyLabel(p),
          supplierName: p.supplier_name ?? null,
          ok,
          missing,
          rows,
          assemblyUnit,
          lineTotal,
        })
      }
      if (!cancelled) setProductCalcs(out)
    })()
      .catch(() => {
        if (!cancelled) {
          setProductCalcs(
            assembledProducts.map((p) => ({
              productId: p.id,
              label: assemblyLabel(p),
              supplierName: p.supplier_name ?? null,
              ok: false,
              missing: ['Could not load supplier prices'],
              rows: [],
              assemblyUnit: 0,
              lineTotal: 0,
            })),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setPricingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [assembledProducts, suppliers])

  const pricingTotals = useMemo(() => {
    const parseOverride = (id: string): number | null => {
      const raw = (tempQuoteUnitByProduct[id] ?? '').trim()
      if (!raw) return null
      const n = Number(raw)
      if (!Number.isFinite(n) || n <= 0) return null
      return n
    }

    if (!productCalcs.length) return null
    if (assembledProducts.length === 0) return null

    const parseDiscount = (id: string): number => {
      const raw = (customerDiscountByProduct[id] ?? '').trim()
      const n = Number(raw)
      if (raw && Number.isFinite(n) && n >= 0) return Math.min(n, 100)
      return 0
    }
    let subtotal = 0
    for (const p of assembledProducts) {
      const ov = parseOverride(p.id)
      const discountFactor = 1 - parseDiscount(p.id) / 100
      if (ov != null) {
        subtotal += ov * discountFactor * p.quantity
        continue
      }
      const pc = productCalcs.find((c) => c.productId === p.id)
      if (!pc) return null
      if (!pc.ok) return null
      subtotal += pc.assemblyUnit * discountFactor * p.quantity
    }
    const gst = subtotal * 0.18
    const pf = subtotal * 0.03
    const grand = subtotal + gst + pf
    return { subtotal, gst, pf, grand }
  }, [assembledProducts, customerDiscountByProduct, productCalcs, tempQuoteUnitByProduct])

  const supplierRequired = suppliers.length > 0
  const pricingReady = useMemo(() => {
    if (assembledProducts.length === 0) return false
    if (!supplierRequired) return true
    return assembledProducts.every((p) => Boolean(p.supplier_id))
  }, [assembledProducts, supplierRequired])

  const handleProductComplete = useCallback(
    (configId: string) => (product: AssembledProduct) => {
      setAssembledProducts((prev) => {
        const existing = prev.find((p) => p.id === product.id)
        if (existing) {
          return prev.map((p) => (p.id === product.id ? product : p))
        }
        return [...prev, product]
      })
      setActiveConfigIds((ids) => ids.filter((x) => x !== configId))
      setEditingId(null)
    },
    [],
  )

  const removeActiveConfig = (configId: string) => {
    setActiveConfigIds((ids) => (ids.length > 1 ? ids.filter((x) => x !== configId) : ids))
  }

  const removeProduct = (id: string) => {
    setAssembledProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const startEdit = (productId: string) => {
    setEditingId(productId)
  }

  const canAddMore =
    assembledProducts.length + activeConfigIds.length < 10 && assembledProducts.length > 0

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (assembledProducts.length === 0) {
      e.products = 'Please complete at least one valve configurator'
    }
    if (supplierRequired) {
      const missingSupplier = assembledProducts.some((p) => !p.supplier_id)
      if (missingSupplier) e.supplier = 'Please select a supplier for each product'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function save() {
    if (!validate()) return
    const lineItems = assembledProducts.map((p) =>
      assembledToLineItem(
        p,
        null,
        p.customer_discount_pct ?? null,
      ),
    )

    setSaving(true)
    setErrors({})
    try {
      await quotationsApi.updateLineItems(quotationId, { lineItems: lineItems })
      await Promise.resolve(onSaved())
    } catch (err: unknown) {
      setErrors({
        save: err instanceof Error ? err.message : 'Failed to update quotation',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-surface-border bg-white p-4 shadow-sm border-t-2 border-t-brand-gold-200">
        <h2 className="text-[15px] font-semibold text-gray-900">Products Requested</h2>
        <p className="mt-1 text-[12px] text-surface-muted">
          Same manual dropdown flow as Upload — edit lines, then save to refresh totals and PDF.
        </p>

        <div className="mt-4 space-y-4">
          {assembledProducts.map((p, idx) =>
            editingId === p.id ? (
              <ValveConfigurator
                key={`${prefillRevision}-edit-${p.id}`}
                productIndex={idx}
                initialProduct={p}
                suppliers={suppliers}
                onProductComplete={(updated) => {
                  setAssembledProducts((prev) => prev.map((x) => (x.id === p.id ? updated : x)))
                  setEditingId(null)
                }}
                onProductRemove={() => {
                  removeProduct(p.id)
                  setEditingId(null)
                }}
              />
            ) : (
              <CompletedProductCard
                key={`${prefillRevision}-card-${p.id}`}
                product={p}
                index={idx}
                onEdit={() => startEdit(p.id)}
                onRemove={() => removeProduct(p.id)}
              />
            ),
          )}

          {activeConfigIds.map((cid, idx) => (
            <ValveConfigurator
              key={`${prefillRevision}-new-${cid}`}
              productIndex={assembledProducts.length + idx}
              suppliers={suppliers}
              onProductComplete={handleProductComplete(cid)}
              onProductRemove={
                assembledProducts.length > 0 || activeConfigIds.length > 1
                  ? () => removeActiveConfig(cid)
                  : undefined
              }
            />
          ))}

          {errors.products && <p className="text-[12px] text-red-600">{errors.products}</p>}
          {errors.supplier && <p className="text-[12px] text-red-600">{errors.supplier}</p>}
          {errors.pricing && <p className="text-[12px] text-red-600">{errors.pricing}</p>}

          {canAddMore && activeConfigIds.length === 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveConfigIds((ids) => [...ids, uuidv4()])}
              className="h-10 w-full border-dashed text-brand-green-700"
            >
              <Plus className="mr-2 size-4" />
              Add Another Product
            </Button>
          )}
        </div>
      </section>

      {false && assembledProducts.length > 0 && (
        <section className="rounded-xl border border-surface-border bg-white p-4 shadow-sm border-t-2 border-t-brand-navy-200">
          <h2 className="text-[15px] font-semibold text-gray-900">Pricing &amp; supplier</h2>
          <p className="mt-1 text-[13px] text-surface-muted">
            Totals use margin / supplier discount from supplier pricing. Customer discount is set per quote line.
          </p>
          {suppliers.length === 0 ? (
            <p className="mt-3 text-[13px] text-surface-muted">
              No active suppliers configured — quotes use assembly estimates only.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {pricingLoading ? (
                <p className="text-[13px] text-surface-muted">Loading supplier prices…</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-surface-border">
                  <table className="w-full min-w-[560px] border-collapse text-left text-[12px]">
                    <thead>
                      <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                        <th className="px-2 py-2">Product</th>
                        <th className="px-2 py-2">Supplier price</th>
                        <th className="px-2 py-2">Cost to Parth</th>
                        <th className="px-2 py-2">Selling (unit)</th>
                        <th className="px-2 py-2">Quote unit (temp)</th>
                        <th className="px-2 py-2">Customer discount (%)</th>
                        <th className="px-2 py-2 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assembledProducts.map((p) => {
                        const pc = productCalcs.find((c) => c.productId === p.id)
                        const overrideRaw = (tempQuoteUnitByProduct[p.id] ?? '').trim()
                        const overrideNum =
                          overrideRaw && Number.isFinite(Number(overrideRaw)) && Number(overrideRaw) > 0
                            ? Number(overrideRaw)
                            : null
                        if (!pc) {
                          return (
                            <tr key={p.id} className="border-b border-[#E2E6DC]">
                              <td className="px-2 py-2">{assemblyLabel(p)}</td>
                              <td colSpan={3} className="px-2 py-2 text-surface-muted">
                                {pricingLoading ? 'Loading prices…' : '—'}
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  value={tempQuoteUnitByProduct[p.id] ?? ''}
                                  onChange={(e) =>
                                    setTempQuoteUnitByProduct((cur) => ({ ...cur, [p.id]: e.target.value }))
                                  }
                                  className="h-8 min-w-[7rem] max-w-[9rem] font-mono text-[12px]"
                                  placeholder="e.g. 3345"
                                />
                                <p className="mt-1 text-[10px] leading-snug text-surface-muted">
                                  Temporary quote unit (doesn&apos;t change Masters)
                                </p>
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  value={customerDiscountByProduct[p.id] ?? ''}
                                  onChange={(e) =>
                                    setCustomerDiscountByProduct((cur) => ({ ...cur, [p.id]: e.target.value }))
                                  }
                                  className="h-8 min-w-[7rem] max-w-[9rem] font-mono text-[12px]"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-surface-muted">
                                {overrideNum != null
                                  ? formatCurrency(
                                      overrideNum *
                                        p.quantity *
                                        (1 - (Math.max(0, Math.min(100, Number(customerDiscountByProduct[p.id] ?? '') || 0)) / 100)),
                                    )
                                  : '—'}
                              </td>
                            </tr>
                          )
                        }
                        if (!pc.ok) {
                          return (
                            <tr key={p.id} className="border-b border-[#E2E6DC]">
                              <td className="px-2 py-2">{pc.label}</td>
                              <td colSpan={3} className="px-2 py-2 text-amber-800">
                                Price not configured — {pc.missing.join(', ')}
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  value={tempQuoteUnitByProduct[p.id] ?? ''}
                                  onChange={(e) =>
                                    setTempQuoteUnitByProduct((cur) => ({ ...cur, [p.id]: e.target.value }))
                                  }
                                  className="h-8 min-w-[7rem] max-w-[9rem] font-mono text-[12px]"
                                  placeholder="e.g. 12500"
                                />
                                <p className="mt-1 text-[10px] leading-snug text-surface-muted">
                                  Temporary quote unit (doesn&apos;t change Masters)
                                </p>
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  value={customerDiscountByProduct[p.id] ?? ''}
                                  onChange={(e) =>
                                    setCustomerDiscountByProduct((cur) => ({ ...cur, [p.id]: e.target.value }))
                                  }
                                  className="h-8 min-w-[7rem] max-w-[9rem] font-mono text-[12px]"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-surface-muted">
                                {overrideNum != null
                                  ? formatCurrency(
                                      overrideNum *
                                        p.quantity *
                                        (1 - (Math.max(0, Math.min(100, Number(customerDiscountByProduct[p.id] ?? '') || 0)) / 100)),
                                    )
                                  : '—'}
                              </td>
                            </tr>
                          )
                        }
                        const listSum = pc.rows.reduce((s, r) => s + r.calc.list_price, 0)
                        const costSum = pc.rows.reduce((s, r) => s + r.calc.cost_to_parth, 0)
                        const discountPct = Math.max(
                          0,
                          Math.min(100, Number(customerDiscountByProduct[p.id] ?? '') || 0),
                        )
                        const effectiveUnit = (overrideNum ?? pc.assemblyUnit) * (1 - discountPct / 100)
                        const effectiveLine = effectiveUnit * p.quantity
                        return (
                          <tr key={p.id} className="border-b border-[#E2E6DC]">
                            <td className="px-2 py-2 font-medium text-gray-900">{pc.label}</td>
                            <td className="px-2 py-2 font-mono">{formatCurrency(listSum)}</td>
                            <td className="px-2 py-2 font-mono">{formatCurrency(costSum)}</td>
                            <td className="px-2 py-2 font-mono">{formatCurrency(pc.assemblyUnit)}</td>
                            <td className="px-2 py-2">
                              <Input
                                value={tempQuoteUnitByProduct[p.id] ?? ''}
                                onChange={(e) =>
                                  setTempQuoteUnitByProduct((cur) => ({ ...cur, [p.id]: e.target.value }))
                                }
                                className="h-8 min-w-[7rem] max-w-[9rem] font-mono text-[12px]"
                                placeholder="(optional)"
                              />
                              <p className="mt-1 text-[10px] leading-snug text-surface-muted">
                                Override calculated selling price if needed
                              </p>
                            </td>
                            <td className="px-2 py-2">
                              <Input
                                value={customerDiscountByProduct[p.id] ?? ''}
                                onChange={(e) =>
                                  setCustomerDiscountByProduct((cur) => ({ ...cur, [p.id]: e.target.value }))
                                }
                                className="h-8 min-w-[7rem] max-w-[9rem] font-mono text-[12px]"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-2 py-2 text-right font-mono">{formatCurrency(effectiveLine)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {pricingTotals && (
                <div className="rounded-lg border border-surface-border bg-surface-page p-3 text-[12px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(pricingTotals?.subtotal ?? 0)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-surface-muted">
                    <span>GST @ 18%</span>
                    <span className="font-mono">{formatCurrency(pricingTotals?.gst ?? 0)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-surface-muted">
                    <span>P&amp;F @ 3%</span>
                    <span className="font-mono">{formatCurrency(pricingTotals?.pf ?? 0)}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-surface-border pt-2 font-semibold text-gray-900">
                    <span>Grand total</span>
                    <span className="font-mono">{formatCurrency(pricingTotals?.grand ?? 0)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {errors.save && <p className="text-[12px] text-red-600">{errors.save}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || (supplierRequired && !pricingReady)}
          className="bg-brand-green-500 text-white hover:bg-brand-green-600"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save quotation'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
