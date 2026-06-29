'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatCurrency, isPositivePrice } from '@/lib/utils'
import { computeDistinctOptions, useValveCatalog, type CatalogRow } from '@/hooks/useValveCatalog'
import { mastersApi } from '@/lib/api'
import {
  BARE_FITTING_CATALOG_KEY,
  filterFittingCascadeSteps,
  FITTING_CATALOG_OPTIONS,
  fittingCategoryLabel,
  HOSE_FITTING_SIZE_FIELD,
  isBareFittingSelection,
  isTemporaryFittingSelection,
  matchHoseSizeToFittingOption,
  TEMPORARY_FITTING_CATALOG_KEY,
} from '@/lib/configuratorProductFlow'
import type { CascadeStep, ValveProduct, ValveSpecSelections } from '@/types'

const SELECT_EMPTY = '__none__'
const SPEC_SELECT_TRIGGER_CLASS =
  'h-10 w-full min-w-0 overflow-hidden py-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate *:data-[slot=select-value]:whitespace-nowrap *:data-[slot=select-value]:text-left'

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
  const priceOk = isPositivePrice(basePrice)
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
    size_id_mm: g('size_id_mm'),
    size_mm: g('size_mm'),
    end_connection_1: g('end_connection_1'),
    end_connection_2: g('end_connection_2'),
    hose_nipple_moc: g('hose_nipple_moc'),
    hose_cap_moc: g('hose_cap_moc'),
    sms_nut_moc: g('sms_nut_moc'),
    tc_od: g('tc_od'),
    din_nut_moc: g('din_nut_moc'),
    swivel_nut_moc: g('swivel_nut_moc'),
    flange_nut_moc: g('flange_nut_moc'),
    rating: g('rating'),
    temperature_range: g('temperature_range'),
    wall_thickness: g('wall_thickness'),
    base_price: priceOk ? basePrice : null,
    has_price: priceOk,
  }
}

type Props = {
  title: string
  specs: ValveSpecSelections
  onSpecsChange: (specs: ValveSpecSelections) => void
  onResolvedChange: (product: ValveProduct | null) => void
  /** Hose ``size_id_mm`` — auto-select matching fittings size when available in masters. */
  hoseSizeForMatch?: string | null
  showQuantity?: boolean
  quantity?: 1 | 2
  onQuantityChange?: (qty: 1 | 2) => void
  listUnitPrice?: (base: number | null | undefined) => number | null
}

export function HoseFittingEndPicker({
  title,
  specs,
  onSpecsChange,
  onResolvedChange,
  hoseSizeForMatch,
  showQuantity = false,
  quantity = 1,
  onQuantityChange,
  listUnitPrice,
}: Props) {
  const temporaryFittingIdRef = useRef(`temporary_fitting:${crypto.randomUUID()}`)
  const [cascadeSteps, setCascadeSteps] = useState<CascadeStep[]>([])
  const visibleCascadeSteps = useMemo(
    () => filterFittingCascadeSteps(cascadeSteps),
    [cascadeSteps],
  )

  const {
    catalog,
    isLoading: catalogLoading,
    error: catalogError,
    loadCatalog,
    getOptions,
    resolve,
    rowCount,
  } = useValveCatalog(
    specs.catalog_category &&
      !isBareFittingSelection(specs.catalog_category) &&
      !isTemporaryFittingSelection(specs.catalog_category)
      ? specs.catalog_category
      : null,
  )

  const bareSelected = isBareFittingSelection(specs.catalog_category)
  const temporarySelected = isTemporaryFittingSelection(specs.catalog_category)
  const temporaryDescription = String(specs.field_values.temporary_description ?? '').trim()

  const categoryLabel = useMemo(
    () => fittingCategoryLabel(specs.catalog_category),
    [specs.catalog_category],
  )

  useEffect(() => {
    let cancelled = false
    const cat = specs.catalog_category
    if (!cat || isBareFittingSelection(cat) || isTemporaryFittingSelection(cat)) {
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
    if (
      !specs.catalog_category ||
      isBareFittingSelection(specs.catalog_category) ||
      isTemporaryFittingSelection(specs.catalog_category)
    ) {
      return
    }
    void loadCatalog(specs.catalog_category)
  }, [specs.catalog_category, loadCatalog])

  const stepOptions = useMemo(() => {
    if (!specs.catalog_category || catalog.length === 0 || visibleCascadeSteps.length === 0) {
      return {} as Record<string, string[]>
    }
    const o: Record<string, string[]> = {}
    for (const step of visibleCascadeSteps) {
      const field = step.key
      const prior: Record<string, string> = {}
      for (const pc of visibleCascadeSteps) {
        if (pc.key === field) break
        const v = specs.field_values[pc.key]
        if (v) prior[pc.key] = v
      }
      o[field] = getOptions(field, prior)
    }
    return o
  }, [specs, catalog, getOptions, visibleCascadeSteps])

  const resolved = useMemo((): ValveProduct | null => {
    if (isTemporaryFittingSelection(specs.catalog_category)) {
      if (!temporaryDescription) return null
      return {
        id: temporaryFittingIdRef.current,
        type: temporaryDescription,
        catalog_category: TEMPORARY_FITTING_CATALOG_KEY,
        temporary_description: temporaryDescription,
        construction: null,
        valve_size: null,
        bore_type: null,
        end_connection: null,
        pressure: null,
        body: null,
        stem: null,
        seat: null,
        fasteners: null,
        base_price: null,
        has_price: false,
      }
    }
    if (
      !specs.catalog_category ||
      isBareFittingSelection(specs.catalog_category) ||
      catalog.length === 0 ||
      visibleCascadeSteps.length === 0
    ) {
      return null
    }
    const filters: Record<string, string> = {}
    for (const step of visibleCascadeSteps) {
      const v = specs.field_values[step.key]
      if (!v) return null
      filters[step.key] = v
    }
    const row = resolve(filters)
    if (!row) return null
    return catalogRowToValveProduct(
      row,
      categoryLabel || specs.catalog_category,
      specs.catalog_category,
    )
  }, [specs, catalog, resolve, visibleCascadeSteps, categoryLabel, temporaryDescription])

  useEffect(() => {
    onResolvedChange(resolved)
  }, [resolved, onResolvedChange])

  useEffect(() => {
    if (catalogLoading || !specs.catalog_category || catalog.length === 0 || visibleCascadeSteps.length === 0) {
      return
    }
    let nextFv = { ...specs.field_values }
    let changed = false
    for (const step of visibleCascadeSteps) {
      const field = step.key
      if (nextFv[field]) continue
      const prior: Record<string, string> = {}
      for (const pc of visibleCascadeSteps) {
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
    if (changed) onSpecsChange({ ...specs, field_values: nextFv })
  }, [specs, catalog, catalogLoading, visibleCascadeSteps, onSpecsChange])

  useEffect(() => {
    const hoseSize = hoseSizeForMatch?.trim()
    if (
      !hoseSize ||
      catalogLoading ||
      !specs.catalog_category ||
      isBareFittingSelection(specs.catalog_category) ||
      isTemporaryFittingSelection(specs.catalog_category) ||
      catalog.length === 0 ||
      visibleCascadeSteps.length === 0
    ) {
      return
    }
    if (specs.field_values[HOSE_FITTING_SIZE_FIELD]) return

    const sizeStepIdx = visibleCascadeSteps.findIndex((s) => s.key === HOSE_FITTING_SIZE_FIELD)
    if (sizeStepIdx < 0) return

    const prior: Record<string, string> = {}
    for (const step of visibleCascadeSteps) {
      if (step.key === HOSE_FITTING_SIZE_FIELD) break
      const v = specs.field_values[step.key]
      if (!v?.trim()) return
      prior[step.key] = v
    }

    const sizeOpts = computeDistinctOptions(catalog, HOSE_FITTING_SIZE_FIELD, prior)
    const matched = matchHoseSizeToFittingOption(hoseSize, sizeOpts)
    if (!matched) return

    onSpecsChange({
      ...specs,
      field_values: { ...specs.field_values, [HOSE_FITTING_SIZE_FIELD]: matched },
    })
  }, [
    hoseSizeForMatch,
    specs,
    catalog,
    catalogLoading,
    visibleCascadeSteps,
    onSpecsChange,
  ])

  const pickCategory = (key: string) => {
    onSpecsChange({ catalog_category: key, field_values: {} })
    void loadCatalog(key, true)
  }

  const pickBareFitting = () => {
    onSpecsChange({ catalog_category: BARE_FITTING_CATALOG_KEY, field_values: {} })
  }

  const pickTemporaryFitting = () => {
    onSpecsChange({
      catalog_category: TEMPORARY_FITTING_CATALOG_KEY,
      field_values: { temporary_description: '' },
    })
  }

  const setTemporaryDescription = (value: string) => {
    onSpecsChange({
      ...specs,
      field_values: { ...specs.field_values, temporary_description: value },
    })
  }

  const pickSpec = (field: string, value: string) => {
    const ix = visibleCascadeSteps.findIndex((s) => s.key === field)
    if (ix < 0) return
    const nextFv = { ...specs.field_values, [field]: value || '' }
    for (const after of visibleCascadeSteps.slice(ix + 1)) {
      delete nextFv[after.key]
    }
    onSpecsChange({ ...specs, field_values: nextFv })
  }

  const unitPrice = listUnitPrice ? listUnitPrice(resolved?.base_price) : resolved?.base_price ?? null

  return (
    <div className="space-y-4 rounded-xl border border-surface-border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-gray-900">{title}</p>
        {showQuantity && onQuantityChange && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
              Qty for this end
            </span>
            <div className="flex overflow-hidden rounded-lg border border-surface-border">
              {([1, 2] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onQuantityChange(q)}
                  className={cn(
                    'px-3 py-1.5 text-[12px] font-medium transition',
                    quantity === q
                      ? 'bg-brand-green-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-surface-page',
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FITTING_CATALOG_OPTIONS.map((c) => {
          const active = specs.catalog_category === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => pickCategory(c.key)}
              className={cn(
                'rounded-xl border p-3 text-left transition',
                active
                  ? 'border-2 border-brand-green-500 bg-brand-green-50'
                  : 'border-surface-border bg-white hover:bg-surface-page',
              )}
            >
              <p className="text-[13px] font-semibold text-gray-900 leading-snug">
                Fittings — {c.label}
              </p>
            </button>
          )
        })}
        <button
          type="button"
          onClick={pickBareFitting}
          className={cn(
            'rounded-xl border p-3 text-left transition',
            bareSelected
              ? 'border-2 border-brand-green-500 bg-brand-green-50'
              : 'border-surface-border bg-white hover:bg-surface-page',
          )}
        >
          <p className="text-[13px] font-semibold text-gray-900 leading-snug">Bare Fitting</p>
          <p className="mt-0.5 text-[11px] text-surface-muted">No fitting on this hose end</p>
        </button>
        <button
          type="button"
          onClick={pickTemporaryFitting}
          className={cn(
            'rounded-xl border p-3 text-left transition',
            temporarySelected
              ? 'border-2 border-brand-gold-500 bg-brand-gold-50'
              : 'border-surface-border bg-white hover:bg-surface-page',
          )}
        >
          <p className="text-[13px] font-semibold text-gray-900 leading-snug">Ingest temporary product</p>
          <p className="mt-0.5 text-[11px] text-surface-muted">Free-text description — price on review step</p>
        </button>
      </div>

      {temporarySelected && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
            Fitting description
          </label>
          <Textarea
            value={String(specs.field_values.temporary_description ?? '')}
            onChange={(e) => setTemporaryDescription(e.target.value)}
            placeholder="Describe the hose fitting (type, size, end connections, material, etc.)"
            rows={3}
            className="min-h-[72px] resize-y"
          />
        </div>
      )}

      {temporarySelected && resolved && (
        <div className="rounded-xl border border-brand-gold-200 bg-brand-gold-50 p-4">
          <p className="text-[13px] font-semibold text-brand-gold-800">
            <Check className="mr-1 inline size-4" />
            Temporary fitting
            {showQuantity && quantity === 2 ? ' (×2, both hose ends)' : ''}
          </p>
          <p className="mt-1 text-[12px] text-brand-gold-900">{temporaryDescription}</p>
          <p className="mt-2 font-mono text-[13px] text-brand-gold-800">
            Unit price: {unitPrice != null ? formatCurrency(unitPrice) : '₹TBD — enter on review step'}
          </p>
        </div>
      )}

      {bareSelected && (
        <div className="rounded-xl border border-brand-green-200 bg-brand-green-50 p-4">
          <p className="text-[13px] font-semibold text-brand-green-700">
            <Check className="mr-1 inline size-4" />
            Bare fitting — no fitting on this hose end
            {showQuantity && quantity === 2 ? ' (both ends)' : ''}
          </p>
        </div>
      )}

      {specs.catalog_category && !bareSelected && !temporarySelected && catalogError && (
        <p className="text-[12px] text-red-600">{catalogError}</p>
      )}

      {specs.catalog_category && !bareSelected && !temporarySelected && catalogLoading && (
        <div className="flex items-center gap-2 text-[12px] text-surface-muted">
          <Loader2 className="size-4 animate-spin" />
          Loading {categoryLabel || specs.catalog_category} catalog
          {rowCount > 0 ? ` (${rowCount} rows)` : '…'}
        </div>
      )}

      {specs.catalog_category && !bareSelected && !temporarySelected && !catalogLoading && visibleCascadeSteps.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleCascadeSteps.map((step, idx) => {
            const field = step.key
            const opts = stepOptions[field] ?? []
            const priorOk =
              idx === 0 ||
              visibleCascadeSteps.slice(0, idx).every((p) => {
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
                  <SelectTrigger
                    className={SPEC_SELECT_TRIGGER_CLASS}
                    title={String(specs.field_values[field] ?? '').trim() || undefined}
                  >
                    <SelectValue
                      placeholder={!priorOk ? 'Complete fields above' : `Select ${step.label}`}
                    />
                  </SelectTrigger>
                  <SelectContent variant="wide" align="start">
                    <SelectItem value={SELECT_EMPTY}>
                      <span className="text-muted-foreground">Select…</span>
                    </SelectItem>
                    {opts.map((o) => (
                      <SelectItem key={`${field}:${o}`} value={o} multiline title={o}>
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

      {resolved && !temporarySelected && (
        <div className="rounded-xl border border-brand-green-200 bg-brand-green-50 p-4">
          <p className="text-[13px] font-semibold text-brand-green-700">
            <Check className="mr-1 inline size-4" />
            {categoryLabel}
            {resolved.size_mm ? ` — ${resolved.size_mm}` : ''}
            {showQuantity && quantity === 2 ? ' (×2, both hose ends)' : ''}
          </p>
          <p className="mt-2 font-mono text-[13px] text-brand-green-700">
            Unit price:{' '}
            {unitPrice != null ? formatCurrency(unitPrice) : '₹TBD'}
            {showQuantity && quantity === 2 && unitPrice != null
              ? ` · Line: ${formatCurrency(unitPrice * 2)}`
              : ''}
          </p>
        </div>
      )}
    </div>
  )
}
