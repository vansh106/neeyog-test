'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { useValveCatalog, type CatalogRow, computeDistinctOptions } from '@/hooks/useValveCatalog'
import { configuratorApi, mastersApi } from '@/lib/api'
import { useConfiguratorAccessories, useConfiguratorValveTypes } from '@/lib/queries'
import type {
  Accessories,
  AccessoryItem,
  AssembledProduct,
  CascadeStep,
  OperatorKey,
  OperatorModel,
  OperatorOption,
  OperatorsResponsePayload,
  SupplierResponse,
  ValveProduct,
  ValveSpecSelections,
} from '@/types'

const SELECT_EMPTY = '__none__'

const toSelectValue = (v: string | null | undefined): string =>
  v != null && String(v).trim() !== '' ? String(v).trim() : SELECT_EMPTY

const fromSelectValue = (v: string | null | undefined): string =>
  !v || v === SELECT_EMPTY ? '' : v

function catalogRowToValveProduct(
  row: CatalogRow,
  displayType: string,
  catalogCategory: string,
): ValveProduct {
  const priceRaw = row.price_inr
  const basePrice =
    priceRaw == null || priceRaw === ''
      ? null
      : typeof priceRaw === 'number'
        ? priceRaw
        : Number(priceRaw)
  const priceOk = basePrice != null && Number.isFinite(basePrice)
  const g = (k: string): string | null => {
    const v = row[k]
    if (v == null) return null
    const s = String(v).trim()
    return s || null
  }
  return {
    id: String(row.id ?? row.row_id ?? ''),
    type: displayType,
    catalog_category: catalogCategory,
    variant_type: g('variant_type'),
    construction: g('construction'),
    valve_size: g('valve_size'),
    bore_type: g('bore_type'),
    end_connection: g('end_connection'),
    pressure: g('pressure'),
    body: g('body'),
    ball_disc: g('ball_disc') ?? undefined,
    ball: g('ball') ?? undefined,
    stem: g('stem'),
    seat: g('seat'),
    fasteners: g('fasteners'),
    product_sheet: g('product_sheet') ?? undefined,
    base_price: priceOk ? basePrice : null,
    has_price: priceOk,
  }
}

type Stage = 'valve_specs' | 'operator' | 'actuator' | 'accessories' | 'supplier' | 'complete'

type SpecSeed = {
  catalog_category: string
  field_values: Record<string, string>
  /** When no ``initialProduct``, seeds qty from matcher RFQ line. */
  quantity?: number
}

type Props = {
  productIndex: number
  onProductComplete: (product: AssembledProduct) => void
  onProductRemove?: () => void
  initialProduct?: AssembledProduct
  /** When set without ``initialProduct``, pre-selects catalog sheet and cascade picks (matcher / re-entry). */
  initialSpecSeed?: SpecSeed | null
  suppliers?: SupplierResponse[]
}

type ComponentPricingEntry = {
  enabled: boolean
  supplier_id: string | null
  supplier_name: string | null
  temp_price: string
}

type ComponentPricingState = Record<string, ComponentPricingEntry>
const UNIT_OPTIONS = ['Nos', 'Pcs', 'Set', 'Pair', 'Meter', 'Kg'] as const
const ADDON_ENABLED_CATEGORIES = new Set(['butterfly_valve'])

function emptySpecs(): ValveSpecSelections {
  return { catalog_category: null, field_values: {} }
}

function inferCatalogCategoryFromValve(v: ValveProduct): string | null {
  if (v.catalog_category) return v.catalog_category
  const t = (v.type || '').toLowerCase()
  if (t.includes('butterfly')) return 'butterfly_valve'
  return null
}

/** Rehydrate step-1 state from a saved valve row (legacy rows may omit ``catalog_category``). */
function valveProductToSpecs(v: ValveProduct): ValveSpecSelections {
  const catalog_category = inferCatalogCategoryFromValve(v)
  const field_values: Record<string, string> = {}
  const pairs: [string, string | null | undefined][] = [
    ['variant_type', v.variant_type],
    ['product_sheet', v.product_sheet ?? null],
    ['construction', v.construction],
    ['valve_size', v.valve_size],
    ['bore_type', v.bore_type],
    ['end_connection', v.end_connection],
    ['pressure', v.pressure],
    ['body', v.body],
    ['ball_disc', v.ball_disc ?? null],
    ['ball', v.ball ?? null],
    ['stem', v.stem],
    ['seat', v.seat],
    ['fasteners', v.fasteners],
  ]
  for (const [k, val] of pairs) {
    if (val != null && String(val).trim() !== '') field_values[k] = String(val).trim()
  }
  return { catalog_category, field_values }
}

function priceText(v: number | null | undefined): string {
  if (v == null) return '₹TBD'
  return formatCurrency(v)
}

function stripMasconPrefix(label: string): string {
  return label.replace(/^Mascon\s*—\s*/i, '').trim()
}

function OperatorKeyLabel(key: OperatorKey | null): string {
  switch (key) {
    case 'bare_shaft':
      return 'Bare Shaft'
    case 'manual':
      return 'Manual'
    case 'gear_box':
      return 'Gear Box'
    case 'da':
      return 'Double Acting (DA)'
    case 'sa':
      return 'Single Acting (SA)'
    case 'electric_actuator':
      return 'Electric Actuator'
    default:
      return '—'
  }
}

// ── Completed compact summary card (exported for reuse) ──────────────────
export function CompletedProductCard({
  product,
  index,
  onEdit,
  onRemove,
}: {
  product: AssembledProduct
  index: number
  onEdit: () => void
  onRemove?: () => void
}) {
  const v = product.valve
  const mat = v
    ? [v.body, v.ball_disc ?? v.ball, v.stem, v.seat, v.fasteners].filter(Boolean).join(' / ')
    : ''
  const lineTotal = product.unit_price != null ? product.unit_price * product.quantity : null

  return (
    <div className="rounded-xl border border-surface-border bg-surface-page p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-green-100 font-mono text-[12px] text-brand-green-700">
            {index + 1}
          </span>
          <span className="rounded-full bg-brand-green-50 px-3 py-1 text-[12px] font-medium text-brand-green-700">
            ✓ Product {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-[12px] text-surface-muted hover:text-gray-900"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 text-[12px] text-surface-muted hover:text-red-700"
            >
              <Trash2 className="size-3.5" /> Remove
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-[13px]">
        {v && (
          <>
            <p className="font-semibold text-gray-900">
              {v.type}, {v.construction ?? ''}
              {v.valve_size ? `, ${v.valve_size}` : ''}
            </p>
            {mat && <p className="text-surface-muted">{mat}</p>}
            <p className="text-surface-muted">
              {[v.end_connection, v.pressure].filter(Boolean).join(' | ')}
            </p>
          </>
        )}
        {product.supplier_name && (
          <p className="text-surface-muted">
            Supplier: <span className="font-medium text-gray-900">{product.supplier_name}</span>
          </p>
        )}
        <p className="text-surface-muted">
          Operator: {OperatorKeyLabel(product.operator_key)}
          {product.operator_model
            ? ` — ${product.operator_model.model_name}${
                product.operator_model.size ? ` (${product.operator_model.size})` : ''
              }`
            : ''}
        </p>
        {product.sov && <p className="text-surface-muted">SOV: {product.sov.type}</p>}
        {product.limit_switch_box && (
          <p className="text-surface-muted">LSB: {product.limit_switch_box.type}</p>
        )}
        {product.positioner && (
          <p className="text-surface-muted">Positioner: {product.positioner.type}</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-2 text-[13px]">
        <span className="text-surface-muted">
          Qty: {product.quantity} {product.unit || 'Nos'}
        </span>
        <span className="font-mono text-brand-green-700">
          {product.unit_price != null ? (
            <>
              {product.quantity} × {formatCurrency(product.unit_price)} ={' '}
              {lineTotal != null ? formatCurrency(lineTotal) : '—'}
            </>
          ) : (
            'Price on request'
          )}
        </span>
      </div>
      {product.has_unknown_prices && (
        <p className="mt-1 text-[12px] text-brand-gold-700">
          * Some prices pending confirmation
        </p>
      )}
    </div>
  )
}

// ── Main ValveConfigurator component ─────────────────────────────────────
export function ValveConfigurator({
  productIndex,
  onProductComplete,
  onProductRemove,
  initialProduct,
  initialSpecSeed,
  suppliers = [],
}: Props) {
  const [stage, setStage] = useState<Stage>('valve_specs')
  const [specs, setSpecs] = useState<ValveSpecSelections>(() => {
    if (initialProduct?.valve) return valveProductToSpecs(initialProduct.valve)
    if (initialSpecSeed?.catalog_category) {
      return {
        catalog_category: initialSpecSeed.catalog_category,
        field_values: { ...initialSpecSeed.field_values },
      }
    }
    return emptySpecs()
  })
  const [cascadeSteps, setCascadeSteps] = useState<CascadeStep[]>([])

  const { data: valveCategories = [], isPending: valveCategoriesPending } = useConfiguratorValveTypes()
  const [operatorOptions, setOperatorOptions] = useState<OperatorOption[]>([])
  const [daOps, setDaOps] = useState<OperatorModel[]>([])
  const [saOps, setSaOps] = useState<OperatorModel[]>([])
  const [constructWay, setConstructWay] = useState<string | null>(null)
  const [operatorKey, setOperatorKey] = useState<OperatorKey | null>(
    initialProduct?.operator_key ?? null,
  )
  const [operatorModel, setOperatorModel] = useState<OperatorModel | null>(
    initialProduct?.operator_model ?? null,
  )

  const { data: accessoriesData } = useConfiguratorAccessories()
  const accessories: Accessories | null = accessoriesData ?? null

  const [sov, setSov] = useState<AccessoryItem | null>(initialProduct?.sov ?? null)
  const [lsb, setLsb] = useState<AccessoryItem | null>(
    initialProduct?.limit_switch_box ?? null,
  )
  const [positioner, setPositioner] = useState<AccessoryItem | null>(
    initialProduct?.positioner ?? null,
  )
  const [quantity, setQuantity] = useState<number>(
    initialProduct?.quantity ?? initialSpecSeed?.quantity ?? 1,
  )
  const [unit, setUnit] = useState<string>(initialProduct?.unit ?? 'Nos')
  const [customerDiscountPct, setCustomerDiscountPct] = useState<string>(
    initialProduct?.customer_discount_pct != null ? String(initialProduct.customer_discount_pct) : '',
  )

  const [supplierId, setSupplierId] = useState<string | null>(initialProduct?.supplier_id ?? null)

  useEffect(() => {
    if (supplierId) return
    const active = (suppliers ?? []).filter((s) => s.is_active)
    if (!active.length) return
    const pref = active.find((s) => s.is_preferred)
    setSupplierId(pref?.id ?? active[0].id)
  }, [supplierId, suppliers])

  const [componentPricing, setComponentPricing] = useState<ComponentPricingState>({})

  const categoryDisplayLabel = useMemo(() => {
    if (!specs.catalog_category) return ''
    const raw = valveCategories.find((c) => c.key === specs.catalog_category)?.label ?? specs.catalog_category
    return stripMasconPrefix(raw)
  }, [specs.catalog_category, valveCategories])

  const {
    catalog,
    isLoading: catalogLoading,
    error: catalogError,
    loadCatalog,
    getOptions,
    resolve,
    rowCount,
  } = useValveCatalog(specs.catalog_category)

  useEffect(() => {
    let cancelled = false
    const cat = specs.catalog_category
    if (!cat) {
      setCascadeSteps([])
      return
    }
    mastersApi
      .getCascadeSchema<CascadeStep[]>(cat)
      .then((s) => {
        if (!cancelled) setCascadeSteps(Array.isArray(s) ? s : [])
      })
      .catch(() => {
        if (!cancelled) setCascadeSteps([])
      })
    return () => {
      cancelled = true
    }
  }, [specs.catalog_category])

  useEffect(() => {
    if (!specs.catalog_category) return
    void loadCatalog(specs.catalog_category)
  }, [specs.catalog_category, loadCatalog])

  const stepOptions = useMemo(() => {
    if (!specs.catalog_category || catalog.length === 0 || cascadeSteps.length === 0)
      return {} as Record<string, string[]>
    const o: Record<string, string[]> = {}
    for (const step of cascadeSteps) {
      const field = step.key
      const prior: Record<string, string> = {}
      for (const pc of cascadeSteps) {
        if (pc.key === field) break
        const v = specs.field_values[pc.key]
        if (v) prior[pc.key] = v
      }
      o[field] = getOptions(field, prior)
    }
    return o
  }, [specs, catalog, getOptions, cascadeSteps])

  const resolvedValve = useMemo((): ValveProduct | null => {
    if (!specs.catalog_category || catalog.length === 0 || cascadeSteps.length === 0) return null
    const filters: Record<string, string> = {}
    for (const step of cascadeSteps) {
      const v = specs.field_values[step.key]
      if (!v) return null
      filters[step.key] = v
    }
    const row = resolve(filters)
    if (!row) return null
    return catalogRowToValveProduct(row, categoryDisplayLabel || specs.catalog_category, specs.catalog_category)
  }, [specs, catalog, resolve, cascadeSteps, categoryDisplayLabel])

  useEffect(() => {
    const activeSupplier = supplierId
      ? (suppliers ?? []).find((s) => s.id === supplierId) ?? null
      : null
    setComponentPricing((prev) => {
      const mk = (key: string, enabled: boolean): ComponentPricingEntry => {
        const p = prev[key]
        return {
          enabled,
          supplier_id: p?.supplier_id ?? activeSupplier?.id ?? null,
          supplier_name: p?.supplier_name ?? activeSupplier?.name ?? null,
          temp_price: p?.temp_price != null ? String(p.temp_price) : '',
        }
      }
      const operatorPricingEnabled =
        operatorKey != null && operatorKey !== 'bare_shaft'
      return {
        valve: mk('valve', !!resolvedValve),
        operator: mk('operator', operatorPricingEnabled),
        sov: mk('sov', !!sov),
        lsb: mk('lsb', !!lsb),
        positioner: mk('positioner', !!positioner),
        bracket: mk('bracket', false),
      }
    })
  }, [resolvedValve, operatorKey, sov, lsb, positioner, supplierId, suppliers])

  useEffect(() => {
    if (catalogLoading || !specs.catalog_category || catalog.length === 0 || cascadeSteps.length === 0) return
    setSpecs((prev) => {
      if (!prev.catalog_category) return prev
      let nextFv = { ...prev.field_values }
      let changed = false
      for (const step of cascadeSteps) {
        const field = step.key
        if (nextFv[field]) continue
        const prior: Record<string, string> = {}
        for (const pc of cascadeSteps) {
          if (pc.key === field) break
          const v = nextFv[pc.key]
          if (v) prior[pc.key] = v
        }
        const opts = computeDistinctOptions(catalog, field, prior)
        if (opts.length === 1) {
          nextFv[field] = opts[0]
          changed = true
        } else {
          break
        }
      }
      return changed ? { ...prev, field_values: nextFv } : prev
    })
  }, [specs.catalog_category, specs.field_values, catalog, catalogLoading, cascadeSteps])

  // ── Fetch operators once the valve is resolved (and we're past specs) ─
  useEffect(() => {
    if (stage === 'valve_specs' || stage === 'complete') return
    if (!resolvedValve) return
    if (!resolvedValve.construction && !resolvedValve.valve_size) return
    ;(async () => {
      try {
        const res = await configuratorApi.getOperators<OperatorsResponsePayload>(
          resolvedValve.type,
          resolvedValve.construction ?? '',
          resolvedValve.valve_size ?? '',
          resolvedValve.catalog_category ?? null,
        )
        setOperatorOptions(res.operator_options ?? [])
        setDaOps(res.da_operators ?? [])
        setSaOps(res.sa_operators ?? [])
        setConstructWay(res.construct_way ?? null)
      } catch {
        setOperatorOptions([])
        setDaOps([])
        setSaOps([])
        setConstructWay(null)
      }
    })()
  }, [stage, resolvedValve])

  // ── Derived: running unit price (pure on frontend) ────────────────────
  const priceInfo = useMemo(() => {
    const valvePrice = resolvedValve?.base_price ?? null
    const opPrice = operatorModel?.base_price ?? null
    const sovPrice = sov?.price ?? null
    const lsbPrice = lsb?.price ?? null
    const posPrice = positioner?.price ?? null

    let subtotal = 0
    const breakdown: Array<{ component: string; price: number | null }> = []

    const push = (component: string, price: number | null) => {
      if (price != null) subtotal += price
      breakdown.push({ component, price })
    }

    if (resolvedValve) {
      push(
        `${resolvedValve.type}${resolvedValve.valve_size ? ` ${resolvedValve.valve_size}` : ''}${resolvedValve.body ? ` ${resolvedValve.body}` : ''}`,
        valvePrice,
      )
    }
    if (operatorKey === 'da' || operatorKey === 'sa') {
      const label =
        operatorModel?.model_name ??
        (operatorKey === 'da' ? 'DA actuator' : 'SA actuator')
      push(label, opPrice)
    } else if (operatorKey === 'manual') push('Manual operator', null)
    else if (operatorKey === 'gear_box') push('Gear box', null)
    else if (operatorKey === 'electric_actuator') push('Electric actuator', null)

    if (sov) push('SOV', sovPrice)
    if (lsb) push('Limit switch box', lsbPrice)
    if (positioner) push('Positioner', posPrice)

    const componentBaseByKey: Record<string, number | null> = {
      valve: valvePrice,
      operator: operatorKey === 'da' || operatorKey === 'sa' ? opPrice : null,
      sov: sovPrice,
      lsb: lsbPrice,
      positioner: posPrice,
      bracket: null,
    }
    const parseTemp = (x: string): number | null => {
      const n = Number((x || '').trim())
      return Number.isFinite(n) && n > 0 ? n : null
    }
    const componentFinalByKey: Record<string, number | null> = {}
    for (const [key, base] of Object.entries(componentBaseByKey)) {
      const cfg = componentPricing[key]
      const enabled = (() => {
        if (key === 'valve') return !!resolvedValve
        if (key === 'operator')
          return operatorKey != null && operatorKey !== 'bare_shaft'
        if (key === 'sov') return !!sov
        if (key === 'lsb') return !!lsb
        if (key === 'positioner') return !!positioner
        if (key === 'bracket') return false
        return false
      })()
      if (!enabled) continue
      const temp = cfg ? parseTemp(cfg.temp_price) : null
      componentFinalByKey[key] = temp ?? base
    }
    const componentUnknowns = Object.entries(componentFinalByKey)
      .filter(([, price]) => price == null)
      .map(([k]) => k)
    const unknownKeyLabels: Record<string, string> = {
      valve: 'Valve',
      operator: 'Operator',
      sov: 'SOV',
      lsb: 'Limit switch box',
      positioner: 'Positioner',
      bracket: 'Bracket & Coupler',
    }
    const componentSubtotal = Object.values(componentFinalByKey).reduce<number>(
      (sum, v) => sum + (v ?? 0),
      0,
    )
    const productDiscount = Math.max(0, Math.min(100, Number(customerDiscountPct || 0)))
    const discountedUnit = componentSubtotal * (1 - productDiscount / 100)
    return {
      unit_price: componentUnknowns.length > 0 ? null : discountedUnit,
      subtotal,
      // Master list prices can be null while Step 5 temp prices still resolve the line — only block on unresolved totals.
      has_unknown_prices: componentUnknowns.length > 0,
      unknown_components: componentUnknowns.map((k) => unknownKeyLabels[k] ?? k),
      breakdown,
      component_final_prices: componentFinalByKey,
      component_subtotal: componentSubtotal,
      product_discount_pct: productDiscount,
    }
  }, [resolvedValve, operatorKey, operatorModel, sov, lsb, positioner, componentPricing, customerDiscountPct])

  const isDaSa = operatorKey === 'da' || operatorKey === 'sa'
  const supportsOperatorAccessoryFlow = !!specs.catalog_category && ADDON_ENABLED_CATEGORIES.has(specs.catalog_category)
  const operatorUnlocksAccessories =
    supportsOperatorAccessoryFlow && operatorKey !== null && operatorKey !== 'bare_shaft'
  const canFinishNow = supportsOperatorAccessoryFlow && operatorKey === 'bare_shaft'
  const availableModels: OperatorModel[] =
    operatorKey === 'da' ? daOps : operatorKey === 'sa' ? saOps : []

  useEffect(() => {
    if (supportsOperatorAccessoryFlow) return
    if (stage === 'operator' || stage === 'actuator' || stage === 'accessories') {
      setStage('supplier')
    }
  }, [supportsOperatorAccessoryFlow, stage])

  // ── Handlers ──────────────────────────────────────────────────────────
  const pickCatalogCategory = (key: string) => {
    setCascadeSteps([])
    setSpecs({ catalog_category: key, field_values: {} })
    void loadCatalog(key, true)
  }

  const pickSpec = (field: string, value: string) => {
    const ix = cascadeSteps.findIndex((s) => s.key === field)
    if (ix < 0) return
    const nextFv = { ...specs.field_values, [field]: value || '' }
    for (const after of cascadeSteps.slice(ix + 1)) {
      delete nextFv[after.key]
    }
    setSpecs({ ...specs, field_values: nextFv })
  }

  const buildAssembled = (): AssembledProduct => ({
    id: initialProduct?.id ?? crypto.randomUUID(),
    valve: resolvedValve,
    operator_key: operatorKey,
    operator_model:
      operatorKey === 'da' || operatorKey === 'sa' ? operatorModel : null,
    supplier_id:
      componentPricing.valve?.supplier_id ??
      Object.values(componentPricing).find((x) => x.enabled && x.supplier_id)?.supplier_id ??
      supplierId,
    supplier_name:
      componentPricing.valve?.supplier_name ??
      Object.values(componentPricing).find((x) => x.enabled && x.supplier_name)?.supplier_name ??
      (suppliers ?? []).find((s) => s.id === supplierId)?.name ??
      null,
    component_pricing: Object.fromEntries(
      Object.entries(componentPricing).map(([k, v]) => {
        const base = priceInfo.component_final_prices?.[k]
        return [
          k,
          {
            enabled: v.enabled,
            supplier_id: v.supplier_id,
            supplier_name: v.supplier_name,
            final_price: base ?? null,
            temp_price: Number.isFinite(Number(v.temp_price)) ? Number(v.temp_price) : null,
          },
        ]
      }),
    ),
    sov,
    limit_switch_box: lsb,
    positioner,
    bracket: null,
    include_bracket: false,
    quantity: Math.max(1, Math.floor(quantity || 1)),
    unit: unit || 'Nos',
    customer_discount_pct: Number.isFinite(Number(customerDiscountPct)) ? Number(customerDiscountPct) : null,
    unit_price: priceInfo.unit_price,
    has_unknown_prices: priceInfo.has_unknown_prices,
    unknown_components: priceInfo.unknown_components,
    price_breakdown: priceInfo.breakdown,
  })

  const finishAndEmit = () => {
    const requiredMissing = Object.values(componentPricing).some(
      (entry) => entry.enabled && (suppliers ?? []).length > 0 && !entry.supplier_id,
    )
    if (requiredMissing) return
    onProductComplete(buildAssembled())
    setStage('complete')
  }
  const hasSuppliers = (suppliers ?? []).length > 0
  const componentNeedsSupplier = (key: string): boolean =>
    hasSuppliers && !!componentPricing[key]?.enabled && !componentPricing[key]?.supplier_id

  const renderComponentPricing = (key: string, title: string) => {
    const cfg = componentPricing[key]
    if (!cfg?.enabled) return null
    return (
      <div className="rounded-lg border border-surface-border bg-surface-page p-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-brand-navy-500">
          {title} supplier & pricing
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select
            value={toSelectValue(cfg.supplier_id ?? '')}
            onValueChange={(raw) =>
              setComponentPricing((prev) => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  supplier_id: fromSelectValue(raw) || null,
                  supplier_name:
                    (suppliers ?? []).find((s) => s.id === fromSelectValue(raw))?.name ?? null,
                },
              }))
            }
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select supplier">
                {cfg.supplier_name}
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
          <div className="sm:col-span-2 rounded-md border border-surface-border bg-white px-3 py-2 text-[12px] text-surface-muted">
            Temporary price is editable in Step 5 Review.
          </div>
        </div>
      </div>
    )
  }

  // ── Stage indicator ───────────────────────────────────────────────────
  // Supplier selection is always the last step before completion.
  const baseSteps = supportsOperatorAccessoryFlow
    ? isDaSa
      ? 4
      : operatorUnlocksAccessories
        ? 3
        : 2
    : 1
  const totalSteps = baseSteps + 1
  const stageNumber =
    stage === 'valve_specs'
      ? 1
      : !supportsOperatorAccessoryFlow
        ? totalSteps
        : stage === 'operator'
          ? 2
          : stage === 'actuator'
            ? 3
            : stage === 'accessories'
              ? isDaSa
                ? 4
                : 3
              : stage === 'supplier'
                ? totalSteps
                : totalSteps
  const stageTitle =
    stage === 'valve_specs'
      ? `Step 1 of ${totalSteps} — Select Valve Specifications`
      : !supportsOperatorAccessoryFlow
        ? `Step ${totalSteps} of ${totalSteps} — Review & Add`
      : stage === 'operator'
        ? `Step 2 of ${totalSteps} — Select Operator Type`
        : stage === 'actuator'
          ? `Step 3 of ${totalSteps} — Select ${operatorKey === 'da' ? 'Double Acting' : 'Single Acting'} Actuator`
          : stage === 'accessories'
            ? `Step ${isDaSa ? 4 : 3} of ${totalSteps} — Optional Accessories`
            : `Step ${totalSteps} of ${totalSteps} — Review & Add`

  // ── Render ────────────────────────────────────────────────────────────
  if (stage === 'complete') {
    return (
      <CompletedProductCard
        product={buildAssembled()}
        index={productIndex}
        onEdit={() => setStage('supplier')}
        onRemove={onProductRemove}
      />
    )
  }

  return (
    <div className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-brand-navy-500">
            Product {productIndex + 1}
          </p>
          <h3 className="text-[15px] font-semibold text-gray-900">{stageTitle}</h3>
        </div>
        {onProductRemove && (
          <button
            type="button"
            onClick={onProductRemove}
            className="text-[12px] text-surface-muted hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>

      {/* Step dots */}
      <div className="mt-3 flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            className={cn(
              'h-1.5 w-8 rounded-full',
              n <= stageNumber ? 'bg-brand-green-500' : 'bg-surface-border',
            )}
          />
        ))}
      </div>

      {/* ── STAGE 1 ─────────────────────────────────────────────────── */}
      {stage === 'valve_specs' && (
        <div className="mt-4 space-y-4">
          {valveCategoriesPending && (
            <div className="flex items-center gap-2 text-[12px] text-surface-muted">
              <Loader2 className="size-4 animate-spin" />
              Loading valve categories…
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-[280px] overflow-y-auto pr-1">
            {valveCategories.map((c) => {
              const active = specs.catalog_category === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => pickCatalogCategory(c.key)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition',
                    active
                      ? 'border-2 border-brand-green-500 bg-brand-green-50'
                      : 'border-surface-border bg-white hover:bg-surface-page',
                  )}
                >
                  <p className="text-[13px] font-semibold text-gray-900 leading-snug">
                    {stripMasconPrefix(c.label)}
                  </p>
                </button>
              )
            })}
          </div>

          {specs.catalog_category && catalogError && (
            <p className="text-[12px] text-red-600">{catalogError}</p>
          )}

          {specs.catalog_category && catalogLoading && (
            <div className="flex items-center gap-2 text-[12px] text-surface-muted">
              <Loader2 className="size-4 animate-spin" />
              Loading {categoryDisplayLabel || specs.catalog_category} catalog
              {rowCount > 0 ? ` (${rowCount} rows)` : '…'}
            </div>
          )}

          {specs.catalog_category && !catalogLoading && cascadeSteps.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cascadeSteps.map((step, idx) => {
                const field = step.key
                const opts = stepOptions[field] ?? []
                const priorOk =
                  idx === 0 ||
                  cascadeSteps.slice(0, idx).every((p) => {
                    const pOpts = stepOptions[p.key] ?? []
                    if (pOpts.length <= 1) return true
                    return !!(specs.field_values[p.key] && String(specs.field_values[p.key]).trim())
                  })
                return (
                  <div key={field} className="space-y-1.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                      {step.label}
                    </div>
                    <Select
                      value={toSelectValue(specs.field_values[field] ?? '')}
                      onValueChange={(raw) => pickSpec(field, fromSelectValue(raw ?? ''))}
                      disabled={!priorOk}
                    >
                      <SelectTrigger className="h-10 w-full min-w-0">
                        <SelectValue
                          placeholder={!priorOk ? 'Complete fields above' : `Select ${step.label}`}
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
          )}

          {resolvedValve && (
            <div className="rounded-xl border border-brand-green-200 bg-brand-green-50 p-4">
              <p className="text-[13px] font-semibold text-brand-green-700">
                <Check className="mr-1 inline size-4" />
                {resolvedValve.type}
                {resolvedValve.construction ? ` — ${resolvedValve.construction}` : ''}
              </p>
              <p className="mt-1 text-[12px] text-gray-800">
                {resolvedValve.valve_size ? <>Size: {resolvedValve.valve_size}</> : null}
                {resolvedValve.body ? <> | Body: {resolvedValve.body}</> : null}
              </p>
              <p className="text-[12px] text-gray-800">
                {[resolvedValve.end_connection, resolvedValve.pressure].filter(Boolean).join(' | ') || '—'}
              </p>
              <p className="mt-2 font-mono text-[13px] text-brand-green-700">
                Base Price: {priceText(resolvedValve.base_price)}
              </p>
            </div>
          )}
          {resolvedValve && renderComponentPricing('valve', 'Valve')}

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-surface-muted">
              {specs.catalog_category
                ? 'Pick each spec to narrow down.'
                : 'Pick a valve category to begin.'}
            </span>
            <Button
              type="button"
              onClick={() => setStage(supportsOperatorAccessoryFlow ? 'operator' : 'supplier')}
              disabled={!resolvedValve || componentNeedsSupplier('valve')}
              className="bg-brand-green-500 text-white hover:bg-brand-green-600"
            >
              {supportsOperatorAccessoryFlow ? 'Next' : 'Next: Review'} <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STAGE 2: Operator type ──────────────────────────────────── */}
      {stage === 'operator' && supportsOperatorAccessoryFlow && (
        <div className="mt-4 space-y-4">
          {constructWay && (
            <div className="rounded-lg border border-surface-border bg-surface-page px-3 py-2 text-[12px] text-surface-muted">
              Valve construct: <span className="font-semibold text-gray-900">{constructWay}</span>.
              DA and SA actuators are listed by construct — you&apos;ll pick the exact model in the next step.
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {operatorOptions.map((opt) => {
              const selected = operatorKey === opt.key
              const models = opt.models ?? []
              const optIsDaSa = opt.key === 'da' || opt.key === 'sa'
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setOperatorKey(opt.key)
                    setOperatorModel(null)
                  }}
                  className={cn(
                    'rounded-xl border p-4 text-left transition',
                    selected
                      ? 'border-2 border-brand-green-500 bg-brand-green-50'
                      : 'border-surface-border bg-white hover:bg-surface-page',
                  )}
                >
                  <p className="text-[14px] font-semibold text-gray-900">{opt.label}</p>
                  <p className="mt-0.5 text-[12px] text-surface-muted">{opt.description}</p>
                  {opt.key === 'bare_shaft' && (
                    <p className="mt-2 font-mono text-[12px] text-brand-green-700">No additional cost</p>
                  )}
                  {(opt.key === 'manual' ||
                    opt.key === 'gear_box' ||
                    opt.key === 'electric_actuator') && (
                    <p className="mt-2 font-mono text-[12px] italic text-brand-gold-700">
                      Price on request
                    </p>
                  )}
                  {optIsDaSa && (
                    <p
                      className={cn(
                        'mt-2 text-[12px]',
                        models.length > 0
                          ? 'text-brand-green-700'
                          : 'italic text-brand-gold-700',
                      )}
                    >
                      {models.length > 0
                        ? `${models.length} actuator model${models.length === 1 ? '' : 's'} available for ${constructWay ?? 'this construct'}`
                        : 'No actuator data — price on request'}
                    </p>
                  )}
                </button>
              )
            })}
          </div>

          {operatorKey && (
            <div className="rounded-lg border border-surface-border bg-surface-page p-3 text-[12px]">
              Selected: <span className="font-semibold">{OperatorKeyLabel(operatorKey)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => setStage('valve_specs')}>
              <ChevronLeft className="mr-1 size-4" /> Change Valve
            </Button>
            {isDaSa && (
              <Button
                type="button"
                onClick={() => setStage('actuator')}
                disabled={availableModels.length === 0 || componentNeedsSupplier('operator')}
                className="bg-brand-green-500 text-white hover:bg-brand-green-600 disabled:opacity-50"
              >
                Next: Pick Actuator <ChevronRight className="ml-1 size-4" />
              </Button>
            )}
            {operatorKey === 'electric_actuator' && (
              <Button
                type="button"
                onClick={() => setStage('accessories')}
                disabled={componentNeedsSupplier('operator')}
                className="bg-brand-green-500 text-white hover:bg-brand-green-600"
              >
                Next: Accessories <ChevronRight className="ml-1 size-4" />
              </Button>
            )}
            {(operatorKey === 'manual' || operatorKey === 'gear_box') && (
              <Button
                type="button"
                onClick={() => setStage('accessories')}
                disabled={componentNeedsSupplier('operator')}
                className="bg-brand-green-500 text-white hover:bg-brand-green-600"
              >
                Next: Accessories <ChevronRight className="ml-1 size-4" />
              </Button>
            )}
            {canFinishNow && (
              <Button
                type="button"
                onClick={() => setStage('supplier')}
                disabled={componentNeedsSupplier('operator')}
                className="bg-brand-green-500 text-white hover:bg-brand-green-600"
              >
                Next <ChevronRight className="ml-1 size-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── STAGE 3: Actuator model (DA/SA only) ────────────────────── */}
      {stage === 'actuator' && isDaSa && supportsOperatorAccessoryFlow && (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-surface-border bg-surface-page px-3 py-2 text-[12px]">
            Pick the {operatorKey === 'da' ? 'Double Acting' : 'Single Acting'} actuator for a{' '}
            <span className="font-semibold text-gray-900">{constructWay ?? ''}</span> valve. Actuator
            sizes are independent of the valve port size — choose the one the client needs.
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
              {operatorKey === 'da' ? 'DA Actuator' : 'SA Actuator'} Model
            </div>
            <Select
              value={toSelectValue(operatorModel?.id ?? '')}
              onValueChange={(raw) => {
                const id = fromSelectValue(raw)
                const m = availableModels.find((x) => x.id === id) ?? null
                setOperatorModel(m)
              }}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select an actuator model">
                  {operatorModel
                    ? `${operatorModel.model_name}${operatorModel.size ? ` — ${operatorModel.size}` : ''}`
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_EMPTY}>
                  <span className="text-muted-foreground">Select…</span>
                </SelectItem>
                {availableModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.model_name}
                    {m.size ? ` — ${m.size}` : ''} —{' '}
                    {m.base_price != null ? formatCurrency(m.base_price) : '₹TBD'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {operatorModel && (
            <div className="rounded-xl border border-brand-green-200 bg-brand-green-50 p-4 text-[13px]">
              <p className="font-semibold text-brand-green-700">
                <Check className="mr-1 inline size-4" />
                {operatorModel.model_name}
                {operatorModel.size ? ` — ${operatorModel.size}` : ''}
              </p>
              <p className="mt-1 font-mono text-brand-green-700">
                {operatorModel.base_price != null
                  ? `${formatCurrency(operatorModel.base_price)} added`
                  : '₹TBD'}
              </p>
            </div>
          )}
          {operatorKey && renderComponentPricing('operator', 'Operator')}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => setStage('operator')}>
              <ChevronLeft className="mr-1 size-4" /> Change Operator
            </Button>
            <Button
              type="button"
              onClick={() => setStage('accessories')}
              disabled={!operatorModel || componentNeedsSupplier('operator')}
              className="bg-brand-green-500 text-white hover:bg-brand-green-600 disabled:opacity-50"
            >
              Next: Accessories <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STAGE 4 (or 3 for electric): Accessories ────────────────── */}
      {stage === 'accessories' && supportsOperatorAccessoryFlow && (
        <div className="mt-4 space-y-4">
          <p className="text-[12px] text-surface-muted">
            All accessories are optional. Select any combination.
          </p>

          {operatorUnlocksAccessories && (
            <>
              <AccessoryToggleRow
                label="Solenoid Valve (SOV)"
                items={accessories?.sov ?? []}
                value={sov}
                onChange={setSov}
              />
              {sov && renderComponentPricing('sov', 'SOV')}
              <AccessoryToggleRow
                label="Limit Switch Box (LSB)"
                items={accessories?.limit_switch_boxes ?? []}
                value={lsb}
                onChange={setLsb}
              />
              {lsb && renderComponentPricing('lsb', 'LSB')}
              <AccessoryToggleRow
                label="Positioner"
                items={accessories?.positioners ?? []}
                value={positioner}
                onChange={setPositioner}
              />
              {positioner && renderComponentPricing('positioner', 'Positioner')}
            </>
          )}

          <PriceSummary
            price={priceInfo}
            quantity={quantity}
            unit={unit}
            onQuantityChange={setQuantity}
            onUnitChange={setUnit}
            editableComponentPrices={false}
            componentPricing={componentPricing}
            setComponentPricing={setComponentPricing}
            customerDiscountPct={customerDiscountPct}
            onCustomerDiscountPctChange={setCustomerDiscountPct}
          />

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStage(isDaSa ? 'actuator' : 'operator')}
            >
              <ChevronLeft className="mr-1 size-4" />{' '}
              {isDaSa ? 'Change Actuator' : 'Change Operator'}
            </Button>
            <Button
              type="button"
              onClick={() => setStage('supplier')}
              className="bg-brand-green-500 text-white hover:bg-brand-green-600"
            >
              Next: Review <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      )}

      {stage === 'supplier' && (
        <div className="mt-4 space-y-4">
          <p className="text-[12px] text-surface-muted">
            Review total and add this assembled product to quotation.
          </p>

          {(suppliers ?? []).length > 0 &&
            Object.entries(componentPricing)
              .filter(([, cfg]) => cfg.enabled && !cfg.supplier_id)
              .map(([k]) => (
                <p key={k} className="text-[12px] text-red-600">
                  Missing supplier for {k}.
                </p>
              ))}

          <PriceSummary
            price={priceInfo}
            quantity={quantity}
            unit={unit}
            onQuantityChange={setQuantity}
            onUnitChange={setUnit}
            editableComponentPrices={true}
            componentPricing={componentPricing}
            setComponentPricing={setComponentPricing}
            customerDiscountPct={customerDiscountPct}
            onCustomerDiscountPctChange={setCustomerDiscountPct}
          />

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStage(operatorUnlocksAccessories ? 'accessories' : 'operator')}
            >
              <ChevronLeft className="mr-1 size-4" /> Back
            </Button>
            <Button
              type="button"
              onClick={finishAndEmit}
              disabled={
                ((suppliers ?? []).length > 0 &&
                  Object.values(componentPricing).some((entry) => entry.enabled && !entry.supplier_id)) ||
                priceInfo.has_unknown_prices
              }
              className="bg-brand-green-500 text-white hover:bg-brand-green-600 disabled:opacity-50"
            >
              <Check className="mr-1 size-4" /> Add to Quote
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────
function AccessoryToggleRow({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: AccessoryItem[]
  value: AccessoryItem | null
  onChange: (v: AccessoryItem | null) => void
}) {
  const [open, setOpen] = useState<boolean>(value != null)
  const active = open || value != null

  useEffect(() => {
    if (!open) onChange(null)
  }, [open, onChange])

  return (
    <div className="rounded-xl border border-surface-border bg-surface-page p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-gray-900">{label}</p>
        <label className="inline-flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setOpen(e.target.checked)}
          />
          <span>{active ? 'Included' : 'Not included'}</span>
        </label>
      </div>
      {active && (
        <div className="mt-2">
          <Select
            value={toSelectValue(value?.id ?? '')}
            onValueChange={(raw) => {
              const id = fromSelectValue(raw)
              const item = items.find((x) => x.id === id) ?? null
              onChange(item)
            }}
          >
            <SelectTrigger className="h-10 w-full min-w-0">
              <SelectValue placeholder={`Select ${label}`}>
                {value?.type ?? null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_EMPTY}>
                <span className="text-muted-foreground">Select…</span>
              </SelectItem>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.type} —{' '}
                  {item.price != null ? formatCurrency(item.price) : '₹TBD'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {value && (
            <p className="mt-1 font-mono text-[12px] text-brand-green-700">
              {value.type} —{' '}
              {value.price != null ? `${formatCurrency(value.price)} added` : '₹TBD'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function PriceSummary({
  price,
  quantity,
  unit,
  onQuantityChange,
  onUnitChange,
  editableComponentPrices,
  componentPricing,
  setComponentPricing,
  customerDiscountPct,
  onCustomerDiscountPctChange,
}: {
  price: {
    unit_price: number | null
    subtotal: number
    has_unknown_prices: boolean
    unknown_components: string[]
    breakdown: Array<{ component: string; price: number | null }>
    component_subtotal?: number
    product_discount_pct?: number
  }
  quantity: number
  unit: string
  onQuantityChange: (q: number) => void
  onUnitChange: (u: string) => void
  editableComponentPrices: boolean
  componentPricing: ComponentPricingState
  setComponentPricing: (updater: (prev: ComponentPricingState) => ComponentPricingState) => void
  customerDiscountPct: string
  onCustomerDiscountPctChange: (v: string) => void
}) {
  const keyForComponent = (name: string): string => {
    const s = name.toLowerCase()
    if (s.includes('limit switch')) return 'lsb'
    if (s.includes('positioner')) return 'positioner'
    if (s.includes('sov')) return 'sov'
    if (s.includes('bracket')) return 'bracket'
    if (s.includes('gear')) return 'operator'
    if (s.includes('da') || s.includes('sa') || s.includes('operator') || s.includes('actuator')) return 'operator'
    return 'valve'
  }
  return (
    <div className="sticky bottom-3 rounded-xl border border-surface-border bg-white p-4 shadow-sm">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-brand-navy-500">
        Running Total
      </p>
      <ul className="mt-2 space-y-1 text-[13px]">
        {price.breakdown.map((row, i) => (
          <li key={`${row.component}-${i}`} className="flex items-center justify-between gap-2">
            <span>{row.component}</span>
            {editableComponentPrices ? (
              <Input
                value={componentPricing[keyForComponent(row.component)]?.temp_price ?? ''}
                onChange={(e) => {
                  const key = keyForComponent(row.component)
                  setComponentPricing((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], temp_price: e.target.value },
                  }))
                }}
                placeholder={row.price != null ? formatCurrency(row.price) : 'TBD'}
                className="h-8 w-28 font-mono"
              />
            ) : (
              <span className="font-mono">
                {row.price != null ? formatCurrency(row.price) : '₹TBD'}
              </span>
            )}
          </li>
        ))}
      </ul>
      {editableComponentPrices && (
        <div className="mt-3 border-t border-surface-border pt-2 text-[13px]">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Customer discount (%)</div>
          <Input
            value={customerDiscountPct}
            onChange={(e) => onCustomerDiscountPctChange(e.target.value)}
            placeholder="Optional"
            className="mt-1 h-9 w-28 font-mono"
          />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-2 text-[13px]">
        <span className="font-semibold">Unit price</span>
        <span className="font-mono text-brand-green-700">
          {price.unit_price != null ? formatCurrency(price.unit_price) : '₹TBD'}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="text-surface-muted">Qty</span>
          <Input
            type="number"
            min={1}
            max={9999}
            value={quantity}
            onChange={(e) => onQuantityChange(Math.max(1, Number(e.target.value || 1)))}
            className="h-9 w-20"
          />
          <Select
            value={toSelectValue(unit)}
            onValueChange={(v) => onUnitChange(fromSelectValue(v) || 'Nos')}
          >
            <SelectTrigger className="h-9 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="font-mono text-brand-green-700">
          Total:{' '}
          {price.unit_price != null ? formatCurrency(price.unit_price * quantity) : '₹TBD'}
        </div>
      </div>
      {price.has_unknown_prices && (
        <p className="mt-1 text-[12px] text-brand-gold-700">
          * Some prices pending confirmation ({price.unknown_components.join(', ')})
        </p>
      )}
    </div>
  )
}

export default ValveConfigurator
