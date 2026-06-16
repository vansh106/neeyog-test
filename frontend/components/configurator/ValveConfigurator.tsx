'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  accessoryItemsForCategory,
  buildTemporaryAccessory,
  getConfiguratorAccessoryCategories,
  groupAccessoryItems,
  isTemporaryAccessory,
  TEMPORARY_ACCESSORY_ID_PREFIX,
  type AccessoryCatalogKey,
  type AccessorySubcategory,
} from '@/lib/accessoriesNav'
import { cn, formatCurrency, formatPriceOrTbd, isPositivePrice, PRICE_TBD_LABEL } from '@/lib/utils'
import { useValveCatalog, type CatalogRow, computeDistinctOptions } from '@/hooks/useValveCatalog'
import { configuratorApi, mastersApi } from '@/lib/api'
import {
  pickActiveSupplierId,
  resolveSupplierFromSheetDefaults,
} from '@/lib/sheetDefaultSupplier'
import {
  catalogPartForSupplierPrice,
  fetchSupplierListPriceInr,
  type SupplierPriceComponentKey,
} from '@/lib/supplierCatalogPrice'
import ConfiguratorCategoryPicker, {
  type ConfiguratorProductFamily,
} from '@/components/configurator/ConfiguratorCategoryPicker'
import {
  type ConfiguratorCatalogPick,
  configuratorLeafLabel,
  fittingCategoryLabel,
  BARE_FITTING_CATALOG_KEY,
  hoseFittingsSelectionComplete,
  hoseRequiresFittings,
  isBareFittingSelection,
  isHoseCatalogCategory,
  isOthersCatalogCategory,
  isTemporaryCatalogCategory,
  operatorValveTypeForCategory,
  supportsOperatorAccessoryFlowCategory,
  TEMPORARY_PRODUCT_CATALOG_KEY,
} from '@/lib/configuratorProductFlow'
import {
  formatHoseLength,
  hosePriceForLength,
  parseHoseLengthInput,
  type HoseLengthUnit,
} from '@/lib/hoseLengthPricing'
import DamperSpecFields from '@/components/configurator/DamperSpecFields'
import { HoseFittingEndPicker } from '@/components/configurator/HoseFittingEndPicker'
import {
  damperDisplayTitle,
  damperSpecsComplete,
  isDamperCatalogCategory,
  mergeDamperOperatorOptions,
} from '@/lib/damperSchema'
import { useConfiguratorAccessories, useSheetDefaultSuppliers } from '@/lib/queries'
import type {
  Accessories,
  AccessoryItem,
  AssembledProduct,
  CascadeStep,
  MasterSheetDefaultSupplier,
  OperatorKey,
  OperatorModel,
  OperatorOption,
  OperatorsResponsePayload,
  SupplierResponse,
  ValveProduct,
  ValveSpecSelections,
} from '@/types'

const SELECT_EMPTY = '__none__'
const EMPTY_SHEET_DEFAULT_SUPPLIERS: MasterSheetDefaultSupplier[] = []

function defaultSupplierForComponentKey(
  key: SupplierPriceComponentKey,
  suppliers: SupplierResponse[],
  sheetDefaults: MasterSheetDefaultSupplier[],
  specs: ValveSpecSelections,
  fittingEnd1Specs: ValveSpecSelections,
  fittingEnd2Specs: ValveSpecSelections,
): SupplierResponse | null {
  if (!suppliers.length) return null
  const masconSupplier =
    suppliers.find((s) => s.is_active && s.name.toLowerCase().includes('mascon')) ?? null

  let catalogTable: string | null = null
  let navSlug: string | null = null
  switch (key) {
    case 'valve':
      catalogTable = specs.catalog_category
      navSlug = specs.catalog_nav_slug ?? null
      if (catalogTable?.startsWith('fp_mascon') && masconSupplier) return masconSupplier
      break
    case 'fitting_end_1':
      catalogTable = fittingEnd1Specs.catalog_category
      navSlug = fittingEnd1Specs.catalog_nav_slug ?? null
      break
    case 'fitting_end_2':
      catalogTable = fittingEnd2Specs.catalog_category
      navSlug = fittingEnd2Specs.catalog_nav_slug ?? null
      break
    case 'operator':
      catalogTable = 'operator'
      break
    case 'sov':
      catalogTable = 'sov'
      break
    case 'lsb':
      catalogTable = 'limit_switch_box'
      break
    case 'positioner':
      catalogTable = 'positioner'
      break
    default:
      return null
  }
  if (!catalogTable) return null
  const id = resolveSupplierFromSheetDefaults(sheetDefaults, catalogTable, navSlug, suppliers)
  if (!id) return null
  return suppliers.find((s) => s.id === id) ?? null
}

const toSelectValue = (v: string | null | undefined): string =>
  v != null && String(v).trim() !== '' ? String(v).trim() : SELECT_EMPTY

const fromSelectValue = (v: string | null | undefined): string =>
  !v || v === SELECT_EMPTY ? '' : v

/** Long catalog spec labels: fixed-height trigger with ellipsis; full text in wide dropdown + title tooltip. */
const SPEC_SELECT_TRIGGER_CLASS =
  'h-10 w-full min-w-0 overflow-hidden py-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate *:data-[slot=select-value]:whitespace-nowrap *:data-[slot=select-value]:text-left'

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

type Stage =
  | 'valve_specs'
  | 'fittings'
  | 'operator'
  | 'actuator'
  | 'accessories'
  | 'supplier'
  | 'complete'

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

function componentPricingEntriesEqual(
  a: ComponentPricingEntry | undefined,
  b: ComponentPricingEntry,
): boolean {
  if (!a) return false
  return (
    a.enabled === b.enabled &&
    a.supplier_id === b.supplier_id &&
    a.supplier_name === b.supplier_name &&
    a.temp_price === b.temp_price
  )
}

const UNIT_OPTIONS = ['Nos', 'Pcs', 'Set', 'Pair', 'Meter', 'Kg'] as const

function emptySpecs(): ValveSpecSelections {
  return {
    catalog_category: null,
    catalog_variant_type: null,
    catalog_nav_slug: null,
    field_values: {},
  }
}

function inferCatalogCategoryFromValve(v: ValveProduct): string | null {
  if (v.catalog_category) return v.catalog_category
  const t = (v.type || '').toLowerCase()
  if (t.includes('butterfly')) return 'butterfly_valve'
  return null
}

/** Rehydrate cascade state from a saved catalog row (legacy rows may omit ``catalog_category``). */
function valveProductToSpecs(v: ValveProduct): ValveSpecSelections {
  const catalog_category = v.catalog_category ?? inferCatalogCategoryFromValve(v)
  if (catalog_category && isDamperCatalogCategory(catalog_category)) {
    return {
      catalog_category,
      catalog_variant_type: null,
      catalog_nav_slug: null,
      field_values: { ...(v.damper_field_values ?? {}) },
    }
  }
  const field_values: Record<string, string> = {}
  const pairs: [string, string | null | undefined][] = [
    ['variant_type', v.variant_type],
    ['product_sheet', v.product_sheet ?? null],
    ['construction', v.construction],
    ['valve_size', v.valve_size],
    ['size_id_mm', v.size_id_mm ?? null],
    ['size_mm', v.size_mm ?? null],
    ['end_connection_1', v.end_connection_1 ?? null],
    ['end_connection_2', v.end_connection_2 ?? null],
    ['hose_nipple_moc', v.hose_nipple_moc ?? null],
    ['hose_cap_moc', v.hose_cap_moc ?? null],
    ['bore_type', v.bore_type],
    ['end_connection', v.end_connection],
    ['pressure', v.pressure],
    ['rating', v.rating ?? null],
    ['temperature_range', v.temperature_range ?? null],
    ['wall_thickness', v.wall_thickness ?? null],
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
  return formatPriceOrTbd(v)
}

function stripMasconPrefix(label: string): string {
  return label.replace(/^Mascon\s*—\s*/i, '').trim()
}

const PRICE_ON_REQUEST_OPERATOR_KEYS = new Set<OperatorKey>([
  'manual',
  'gear_box',
  'electric_actuator',
  'pneumatic_rack_pinion',
  'pneumatic_cylinder',
])

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
    case 'pneumatic_rack_pinion':
      return 'Pneumatic Rack and Pinion Actuator'
    case 'pneumatic_cylinder':
      return 'Pneumatic Cylinder'
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
        {product.is_temporary || isTemporaryCatalogCategory(v?.catalog_category) ? (
          <>
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-gold-700">
              Temporary product
            </p>
            <p className="font-semibold text-gray-900">
              {(v?.temporary_description ?? v?.type ?? 'Temporary product').trim()}
            </p>
          </>
        ) : (
          v && (
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
          )
        )}
        {product.supplier_name && (
          <p className="text-surface-muted">
            Supplier: <span className="font-medium text-gray-900">{product.supplier_name}</span>
          </p>
        )}
        <p className="text-surface-muted">
          Operator: {OperatorKeyLabel(product.operator_key)}
          {product.operator_model ? ` — ${product.operator_model.model_name}` : ''}
        </p>
        {product.sov && (
          <p className="text-surface-muted">
            SOV: {product.sov.type}
            {isTemporaryAccessory(product.sov) ? ' (custom)' : ''}
          </p>
        )}
        {product.limit_switch_box && (
          <p className="text-surface-muted">
            LSB: {product.limit_switch_box.type}
            {isTemporaryAccessory(product.limit_switch_box) ? ' (custom)' : ''}
          </p>
        )}
        {product.positioner && (
          <p className="text-surface-muted">
            Positioner: {product.positioner.type}
            {isTemporaryAccessory(product.positioner) ? ' (custom)' : ''}
          </p>
        )}
        {(product.fitting_end_1_bare || product.fitting_end_1 || product.fitting) && (
          <p className="text-surface-muted">
            Fitting (End 1):{' '}
            {product.fitting_end_1_bare
              ? 'Bare fitting'
              : [
                  (product.fitting_end_1 ?? product.fitting)?.variant_type,
                  (product.fitting_end_1 ?? product.fitting)?.size_mm,
                ]
                  .filter(Boolean)
                  .join(' — ')}
            {(product.fitting_end_1_qty ?? 1) === 2 ? ' ×2' : ''}
          </p>
        )}
        {(product.fitting_end_2_bare || product.fitting_end_2) && (
          <p className="text-surface-muted">
            Fitting (End 2):{' '}
            {product.fitting_end_2_bare
              ? 'Bare fitting'
              : [product.fitting_end_2?.variant_type, product.fitting_end_2?.size_mm]
                  .filter(Boolean)
                  .join(' — ')}
          </p>
        )}
        {product.hose_length != null && (
          <p className="text-surface-muted">
            Length:{' '}
            {formatHoseLength(product.hose_length, product.hose_length_unit ?? 'm')}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-2 text-[13px]">
        <span className="text-surface-muted">
          Qty: {product.quantity} {product.unit || 'Nos'}
        </span>
        <span className="font-mono text-brand-green-700">
          {isPositivePrice(product.unit_price) ? (
            <>
              {product.quantity} × {formatCurrency(product.unit_price!)} ={' '}
              {lineTotal != null ? formatCurrency(lineTotal) : PRICE_TBD_LABEL}
            </>
          ) : (
            PRICE_TBD_LABEL
          )}
        </span>
      </div>
      {product.has_unknown_prices && (
        <p className="mt-1 text-[12px] text-brand-gold-700">
          * Some components priced as {PRICE_TBD_LABEL}
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
  const [isTemporaryProduct, setIsTemporaryProduct] = useState(
    () =>
      initialProduct?.is_temporary === true ||
      isTemporaryCatalogCategory(initialProduct?.valve?.catalog_category),
  )
  const [temporaryDescription, setTemporaryDescription] = useState(() => {
    if (
      initialProduct?.is_temporary ||
      isTemporaryCatalogCategory(initialProduct?.valve?.catalog_category)
    ) {
      return (
        initialProduct?.valve?.temporary_description ??
        initialProduct?.valve?.type ??
        ''
      ).trim()
    }
    return ''
  })
  const [temporaryFamily, setTemporaryFamily] = useState<ConfiguratorProductFamily | null>(
    () => initialProduct?.temporary_product_family ?? null,
  )
  const temporaryProductIdRef = useRef(
    initialProduct?.valve?.id?.startsWith('temporary_product:')
      ? initialProduct.valve.id
      : `temporary_product:${crypto.randomUUID()}`,
  )
  const damperProductIdRef = useRef<string | null>(
    initialProduct?.valve?.catalog_category &&
      isDamperCatalogCategory(initialProduct.valve.catalog_category)
      ? initialProduct.valve.id
      : null,
  )
  const [specs, setSpecs] = useState<ValveSpecSelections>(() => {
    if (
      initialProduct?.is_temporary ||
      isTemporaryCatalogCategory(initialProduct?.valve?.catalog_category)
    ) {
      return {
        catalog_category: TEMPORARY_PRODUCT_CATALOG_KEY,
        catalog_variant_type: null,
        catalog_nav_slug: null,
        field_values: {},
      }
    }
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
  const [fittingEnd1Specs, setFittingEnd1Specs] = useState<ValveSpecSelections>(() => {
    if (initialProduct?.fitting_end_1_bare) {
      return { catalog_category: BARE_FITTING_CATALOG_KEY, field_values: {} }
    }
    const f = initialProduct?.fitting_end_1 ?? initialProduct?.fitting
    if (!f?.catalog_category) return emptySpecs()
    return valveProductToSpecs(f)
  })
  const [fittingEnd2Specs, setFittingEnd2Specs] = useState<ValveSpecSelections>(() => {
    if (initialProduct?.fitting_end_2_bare) {
      return { catalog_category: BARE_FITTING_CATALOG_KEY, field_values: {} }
    }
    const f = initialProduct?.fitting_end_2
    if (!f?.catalog_category) return emptySpecs()
    return valveProductToSpecs(f)
  })
  const [fittingEnd1Qty, setFittingEnd1Qty] = useState<1 | 2>(
    initialProduct?.fitting_end_1_qty ?? (initialProduct?.fitting_end_2 ? 1 : 1),
  )
  const [resolvedFittingEnd1, setResolvedFittingEnd1] = useState<ValveProduct | null>(
    initialProduct?.fitting_end_1 ?? initialProduct?.fitting ?? null,
  )
  const [resolvedFittingEnd2, setResolvedFittingEnd2] = useState<ValveProduct | null>(
    initialProduct?.fitting_end_2 ?? null,
  )
  const [hoseLength, setHoseLength] = useState<string>(
    initialProduct?.hose_length != null ? String(initialProduct.hose_length) : '1',
  )
  const [hoseLengthUnit, setHoseLengthUnit] = useState<HoseLengthUnit>(
    initialProduct?.hose_length_unit ?? 'm',
  )

  const requiresFittingsAddon =
    !isTemporaryProduct && hoseRequiresFittings(specs.catalog_category)
  const isHoseSelection = !isTemporaryProduct && isHoseCatalogCategory(specs.catalog_category)
  const isDamperSelection =
    !isTemporaryProduct && isDamperCatalogCategory(specs.catalog_category)
  /** Main product line (temporary or damper) has no catalog price — entered on review. */
  const requiresManualProductPrice = isTemporaryProduct || isDamperSelection
  const parsedHoseLength = useMemo(() => parseHoseLengthInput(hoseLength), [hoseLength])
  const hoseLengthValid = !isHoseSelection || parsedHoseLength != null
  const [operatorOptions, setOperatorOptions] = useState<OperatorOption[]>([])
  const [daOps, setDaOps] = useState<OperatorModel[]>([])
  const [saOps, setSaOps] = useState<OperatorModel[]>([])
  const [operatorKey, setOperatorKey] = useState<OperatorKey | null>(
    initialProduct?.operator_key ?? null,
  )
  const [operatorModel, setOperatorModel] = useState<OperatorModel | null>(
    initialProduct?.operator_model ?? null,
  )

  const { data: accessoriesData } = useConfiguratorAccessories()
  const accessories: Accessories | null = accessoriesData ?? null
  const { data: sheetDefaultSuppliers = EMPTY_SHEET_DEFAULT_SUPPLIERS } = useSheetDefaultSuppliers()

  const accessoryCategories = useMemo(() => getConfiguratorAccessoryCategories(), [])

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
    if (!specs.catalog_category || !(suppliers ?? []).length) return
    if (initialProduct?.supplier_id) return
    const id = resolveSupplierFromSheetDefaults(
      sheetDefaultSuppliers,
      specs.catalog_category,
      specs.catalog_nav_slug,
      suppliers ?? [],
    )
    if (id) setSupplierId(id)
  }, [
    specs.catalog_category,
    specs.catalog_nav_slug,
    suppliers,
    sheetDefaultSuppliers,
    initialProduct?.supplier_id,
  ])

  const [componentPricing, setComponentPricing] = useState<ComponentPricingState>(() => {
    const cp = initialProduct?.component_pricing
    if (!cp) return {}
    const out: ComponentPricingState = {}
    for (const [k, v] of Object.entries(cp)) {
      if (!v?.enabled) continue
      const key = k === 'fitting' ? 'fitting_end_1' : k
      out[key] = {
        enabled: v.enabled,
        supplier_id: v.supplier_id ?? null,
        supplier_name: v.supplier_name ?? null,
        temp_price: v.temp_price != null ? String(v.temp_price) : '',
      }
    }
    return out
  })
  /** List prices from ``supplier_product_prices`` when catalog rows have no ``price_inr``. */
  const [supplierListPrices, setSupplierListPrices] = useState<
    Partial<Record<SupplierPriceComponentKey, number>>
  >({})

  const categoryDisplayLabel = useMemo(() => {
    if (isTemporaryProduct) return 'Temporary product'
    if (!specs.catalog_category) return ''
    return stripMasconPrefix(
      configuratorLeafLabel(specs.catalog_category, {
        navSlug: specs.catalog_nav_slug,
        variantType: specs.catalog_variant_type,
        displayLabel: specs.catalog_display_label,
      }),
    )
  }, [
    isTemporaryProduct,
    specs.catalog_category,
    specs.catalog_nav_slug,
    specs.catalog_variant_type,
    specs.catalog_display_label,
  ])

  const categorySelection = useMemo(
    () => ({
      key: isTemporaryProduct ? null : specs.catalog_category,
      label: specs.catalog_display_label ?? null,
      variantType: specs.catalog_variant_type ?? null,
      navSlug: specs.catalog_nav_slug ?? null,
    }),
    [
      isTemporaryProduct,
      specs.catalog_category,
      specs.catalog_display_label,
      specs.catalog_variant_type,
      specs.catalog_nav_slug,
    ],
  )

  const {
    catalog: fullCatalog,
    isLoading: catalogLoading,
    error: catalogError,
    loadCatalog,
    getOptions,
    resolve,
    rowCount: fullRowCount,
  } = useValveCatalog(specs.catalog_category)

  const catalog = useMemo(() => {
    const vt = specs.catalog_variant_type?.trim()
    if (!vt || fullCatalog.length === 0) return fullCatalog
    return fullCatalog.filter((row) => String(row.variant_type ?? '').trim() === vt)
  }, [fullCatalog, specs.catalog_variant_type])

  const rowCount = catalog.length > 0 ? catalog.length : fullRowCount

  const fittingsComplete = hoseFittingsSelectionComplete(
    fittingEnd1Specs,
    resolvedFittingEnd1,
    fittingEnd2Specs,
    resolvedFittingEnd2,
    fittingEnd1Qty,
  )

  useEffect(() => {
    if (fittingEnd1Qty === 2) {
      setFittingEnd2Specs(emptySpecs())
      setResolvedFittingEnd2(null)
    }
  }, [fittingEnd1Qty])

  const handleResolvedFittingEnd1 = useCallback((product: ValveProduct | null) => {
    setResolvedFittingEnd1(product)
  }, [])

  const handleResolvedFittingEnd2 = useCallback((product: ValveProduct | null) => {
    setResolvedFittingEnd2(product)
  }, [])

  useEffect(() => {
    let cancelled = false
    const cat = specs.catalog_category
    if (!cat || isTemporaryCatalogCategory(cat) || isDamperCatalogCategory(cat)) {
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
      isTemporaryCatalogCategory(specs.catalog_category) ||
      isDamperCatalogCategory(specs.catalog_category)
    )
      return
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
    if (isTemporaryProduct) {
      const desc = temporaryDescription.trim()
      if (!desc) return null
      return {
        id: temporaryProductIdRef.current,
        type: desc,
        catalog_category: TEMPORARY_PRODUCT_CATALOG_KEY,
        temporary_description: desc,
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
    if (isDamperCatalogCategory(specs.catalog_category)) {
      const cat = specs.catalog_category!
      if (!damperSpecsComplete(cat, specs.field_values)) return null
      if (!damperProductIdRef.current) {
        damperProductIdRef.current = `${cat}:${crypto.randomUUID()}`
      }
      const fv = specs.field_values
      return {
        id: damperProductIdRef.current,
        type: damperDisplayTitle(cat, fv),
        catalog_category: cat,
        construction: null,
        valve_size: fv.size?.trim() || null,
        bore_type: null,
        end_connection: null,
        pressure: null,
        body: null,
        stem: null,
        seat: null,
        fasteners: null,
        damper_field_values: { ...fv },
        base_price: null,
        has_price: false,
      }
    }
    if (!specs.catalog_category || catalog.length === 0 || cascadeSteps.length === 0) return null
    const filters: Record<string, string> = {}
    for (const step of cascadeSteps) {
      const v = specs.field_values[step.key]
      if (!v) return null
      filters[step.key] = v
    }
    const row = resolve(filters)
    if (!row) return null
    const displayType = isOthersCatalogCategory(specs.catalog_category)
      ? String(row.description ?? categoryDisplayLabel).trim() || categoryDisplayLabel
      : categoryDisplayLabel || specs.catalog_category
    return catalogRowToValveProduct(row, displayType, specs.catalog_category)
  }, [isTemporaryProduct, temporaryDescription, specs, catalog, resolve, cascadeSteps, categoryDisplayLabel])

  const fittingsHoseSize = useMemo(
    () => resolvedValve?.size_id_mm?.trim() || specs.field_values.size_id_mm?.trim() || null,
    [resolvedValve?.size_id_mm, specs.field_values.size_id_mm],
  )

  const pricingCtx = useMemo(
    () => ({
      resolvedValve,
      resolvedFittingEnd1,
      resolvedFittingEnd2,
      operatorModel,
      operatorKey,
      sov,
      lsb,
      positioner,
    }),
    [resolvedValve, resolvedFittingEnd1, resolvedFittingEnd2, operatorModel, operatorKey, sov, lsb, positioner],
  )

  const supplierPriceFetchSig = useMemo(() => {
    const keys: SupplierPriceComponentKey[] = [
      'valve',
      'fitting_end_1',
      'fitting_end_2',
      'operator',
      'sov',
      'lsb',
      'positioner',
    ]
    const sig: Record<string, string | null> = {}
    for (const key of keys) {
      const cfg = componentPricing[key]
      if (!cfg?.enabled) {
        sig[key] = null
        continue
      }
      const sid = (cfg.supplier_id ?? supplierId ?? '').trim()
      const part = catalogPartForSupplierPrice(key, pricingCtx)
      sig[key] = sid && part ? `${sid}|${part.catalog_table}|${part.catalog_row_id}` : null
    }
    return JSON.stringify(sig)
  }, [componentPricing, supplierId, pricingCtx])

  useEffect(() => {
    let cancelled = false
    const keys: SupplierPriceComponentKey[] = [
      'valve',
      'fitting_end_1',
      'fitting_end_2',
      'operator',
      'sov',
      'lsb',
      'positioner',
    ]
    ;(async () => {
      const nextPrices: Partial<Record<SupplierPriceComponentKey, number>> = {}
      for (const key of keys) {
        const cfg = componentPricing[key]
        if (!cfg?.enabled) continue
        const sid = (cfg.supplier_id ?? supplierId ?? '').trim()
        const part = catalogPartForSupplierPrice(key, pricingCtx)
        if (!sid || !part) continue
        const inr = await fetchSupplierListPriceInr(sid, part.catalog_table, part.catalog_row_id)
        if (cancelled) return
        if (inr != null) {
          nextPrices[key] = inr
          setComponentPricing((prev) => {
            const cur = prev[key]
            if (!cur) return prev
            const existing = (cur.temp_price ?? '').trim()
            if (existing && Number(existing) > 0) return prev
            let priceToSet = inr
            if (
              key === 'valve' &&
              isHoseSelection &&
              parsedHoseLength != null
            ) {
              const adjusted = hosePriceForLength(inr, parsedHoseLength, hoseLengthUnit)
              if (adjusted != null) priceToSet = adjusted
            }
            return { ...prev, [key]: { ...cur, temp_price: String(priceToSet) } }
          })
        }
      }
      if (!cancelled) setSupplierListPrices((prev) => ({ ...prev, ...nextPrices }))
    })()
    return () => {
      cancelled = true
    }
  }, [supplierPriceFetchSig, pricingCtx, isHoseSelection, parsedHoseLength, hoseLengthUnit])

  const componentListPrice = useCallback(
    (key: SupplierPriceComponentKey, catalogBase: number | null | undefined): number | null => {
      if (isPositivePrice(catalogBase)) return catalogBase
      const fromSupplier = supplierListPrices[key]
      return isPositivePrice(fromSupplier) ? fromSupplier : null
    },
    [supplierListPrices],
  )

  // Supplier list price for hoses is per meter — keep review temp_price in sync with length.
  useEffect(() => {
    if (!isHoseSelection || parsedHoseLength == null) return
    const perMeter = supplierListPrices.valve
    if (!isPositivePrice(perMeter)) return
    const adjusted = hosePriceForLength(perMeter, parsedHoseLength, hoseLengthUnit)
    if (adjusted == null) return
    const next = String(Math.round(adjusted * 100) / 100)
    setComponentPricing((prev) => {
      const cur = prev.valve
      if (!cur?.enabled) return prev
      if (cur.temp_price === next) return prev
      return { ...prev, valve: { ...cur, temp_price: next } }
    })
  }, [isHoseSelection, parsedHoseLength, hoseLengthUnit, supplierListPrices.valve])

  useEffect(() => {
    const activeSuppliers = suppliers ?? []
    const operatorPricingEnabled = operatorKey != null && operatorKey !== 'bare_shaft'
    setComponentPricing((prev) => {
      const mk = (key: SupplierPriceComponentKey, enabled: boolean): ComponentPricingEntry => {
        const p = prev[key]
        const defaultSupplier = defaultSupplierForComponentKey(
          key,
          activeSuppliers,
          sheetDefaultSuppliers,
          specs,
          fittingEnd1Specs,
          fittingEnd2Specs,
        )
        return {
          enabled,
          supplier_id: p?.supplier_id ?? defaultSupplier?.id ?? null,
          supplier_name: p?.supplier_name ?? defaultSupplier?.name ?? null,
          temp_price: p?.temp_price != null ? String(p.temp_price) : '',
        }
      }
      const next: ComponentPricingState = {
        valve: mk('valve', !!resolvedValve),
        operator: mk('operator', operatorPricingEnabled),
        sov: mk('sov', !!sov),
        lsb: mk('lsb', !!lsb),
        positioner: mk('positioner', !!positioner),
        bracket: {
          enabled: false,
          supplier_id: prev.bracket?.supplier_id ?? null,
          supplier_name: prev.bracket?.supplier_name ?? null,
          temp_price: prev.bracket?.temp_price != null ? String(prev.bracket.temp_price) : '',
        },
        fitting_end_1: mk('fitting_end_1', !!resolvedFittingEnd1),
        fitting_end_2: mk('fitting_end_2', fittingEnd1Qty === 1 && !!resolvedFittingEnd2),
      }
      const keys = Object.keys(next) as Array<keyof typeof next>
      if (keys.every((k) => componentPricingEntriesEqual(prev[k], next[k]))) return prev
      return next
    })
  }, [
    resolvedValve,
    resolvedFittingEnd1,
    resolvedFittingEnd2,
    fittingEnd1Qty,
    operatorKey,
    sov,
    lsb,
    positioner,
    suppliers,
    sheetDefaultSuppliers,
    specs.catalog_category,
    specs.catalog_nav_slug,
    fittingEnd1Specs.catalog_category,
    fittingEnd1Specs.catalog_nav_slug,
    fittingEnd2Specs.catalog_category,
    fittingEnd2Specs.catalog_nav_slug,
  ])

  useEffect(() => {
    if (
      isTemporaryProduct ||
      isDamperSelection ||
      catalogLoading ||
      !specs.catalog_category ||
      isTemporaryCatalogCategory(specs.catalog_category) ||
      catalog.length === 0 ||
      cascadeSteps.length === 0
    )
      return
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
  }, [isTemporaryProduct, specs.catalog_category, specs.field_values, catalog, catalogLoading, cascadeSteps])

  // ── Fetch operators once the valve is resolved (and we're past specs) ─
  useEffect(() => {
    if (stage === 'valve_specs' || stage === 'complete') return
    if (!resolvedValve) return
    ;(async () => {
      try {
        const res = await configuratorApi.getOperators<OperatorsResponsePayload>(
          operatorValveTypeForCategory(
            resolvedValve.catalog_category ?? specs.catalog_category,
            resolvedValve.type,
          ),
          resolvedValve.construction ?? '',
          resolvedValve.valve_size ?? '',
          resolvedValve.catalog_category ?? specs.catalog_category ?? null,
        )
        setOperatorOptions(
          mergeDamperOperatorOptions(
            res.operator_options ?? [],
            resolvedValve.catalog_category ?? specs.catalog_category,
          ),
        )
        setDaOps(res.da_operators ?? [])
        setSaOps(res.sa_operators ?? [])
      } catch {
        setOperatorOptions([])
        setDaOps([])
        setSaOps([])
      }
    })()
  }, [stage, resolvedValve, specs.catalog_category])

  // ── Derived: running unit price (pure on frontend) ────────────────────
  const priceInfo = useMemo(() => {
    const valvePricePerMeter = componentListPrice('valve', resolvedValve?.base_price)
    const valvePrice =
      isHoseSelection && parsedHoseLength != null
        ? hosePriceForLength(valvePricePerMeter, parsedHoseLength, hoseLengthUnit)
        : isHoseSelection
          ? null
          : valvePricePerMeter
    const opPrice = componentListPrice('operator', operatorModel?.base_price)
    const sovPrice = sov?.price ?? null
    const lsbPrice = lsb?.price ?? null
    const posPrice = positioner?.price ?? null

    let subtotal = 0
    const breakdown: Array<{
      component: string
      price: number | null
      pricing_key: SupplierPriceComponentKey | 'bracket'
    }> = []

    const push = (
      component: string,
      price: number | null,
      pricingKey: SupplierPriceComponentKey | 'bracket',
    ) => {
      if (price != null) subtotal += price
      breakdown.push({ component, price, pricing_key: pricingKey })
    }

    if (resolvedValve) {
      const sizeLabel = resolvedValve.valve_size ?? resolvedValve.size_id_mm ?? ''
      const lengthSuffix =
        isHoseSelection && parsedHoseLength != null
          ? ` — ${formatHoseLength(parsedHoseLength, hoseLengthUnit)}`
          : ''
      const valveLabel = isTemporaryProduct
        ? temporaryDescription.trim() || 'Temporary product'
        : `${categoryDisplayLabel || resolvedValve.type}${sizeLabel ? ` ${sizeLabel}` : ''}${lengthSuffix}`
      push(valveLabel, valvePrice, 'valve')
    }
    if (resolvedFittingEnd1) {
      const unit = componentListPrice('fitting_end_1', resolvedFittingEnd1.base_price)
      const linePrice = unit != null ? unit * fittingEnd1Qty : null
      const fitLabel = [
        fittingCategoryLabel(resolvedFittingEnd1.catalog_category),
        resolvedFittingEnd1.size_mm,
      ]
        .filter(Boolean)
        .join(' ')
      push(
        `Fitting End 1${fittingEnd1Qty === 2 ? ' (×2)' : ''}${fitLabel ? `: ${fitLabel}` : ''}`,
        linePrice,
        'fitting_end_1',
      )
    }
    if (fittingEnd1Qty === 1 && resolvedFittingEnd2) {
      const fitLabel = [
        fittingCategoryLabel(resolvedFittingEnd2.catalog_category),
        resolvedFittingEnd2.size_mm,
      ]
        .filter(Boolean)
        .join(' ')
      push(
        `Fitting End 2${fitLabel ? `: ${fitLabel}` : ''}`,
        componentListPrice('fitting_end_2', resolvedFittingEnd2.base_price),
        'fitting_end_2',
      )
    }
    if (operatorKey === 'da' || operatorKey === 'sa') {
      const label =
        operatorModel?.model_name ??
        (operatorKey === 'da' ? 'DA actuator' : 'SA actuator')
      push(label, opPrice, 'operator')
    } else if (operatorKey === 'manual') push('Manual operator', null, 'operator')
    else if (operatorKey === 'gear_box') push('Gear box', null, 'operator')
    else if (operatorKey === 'electric_actuator') push('Electric actuator', null, 'operator')
    else if (operatorKey === 'pneumatic_rack_pinion') {
      push('Pneumatic Rack and Pinion Actuator', null, 'operator')
    } else if (operatorKey === 'pneumatic_cylinder') {
      push('Pneumatic Cylinder', null, 'operator')
    }

    if (sov) push('SOV', sovPrice, 'sov')
    if (lsb) push('Limit switch box', lsbPrice, 'lsb')
    if (positioner) push('Positioner', posPrice, 'positioner')

    const fitEnd1Unit = componentListPrice('fitting_end_1', resolvedFittingEnd1?.base_price)
    const fitEnd2Unit = componentListPrice('fitting_end_2', resolvedFittingEnd2?.base_price)
    const componentBaseByKey: Record<string, number | null> = {
      valve: valvePrice,
      fitting_end_1:
        fitEnd1Unit != null && resolvedFittingEnd1 ? fitEnd1Unit * fittingEnd1Qty : fitEnd1Unit,
      fitting_end_2: fitEnd2Unit,
      operator: operatorKey === 'da' || operatorKey === 'sa' ? opPrice : null,
      sov: componentListPrice('sov', sovPrice),
      lsb: componentListPrice('lsb', lsbPrice),
      positioner: componentListPrice('positioner', posPrice),
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
        if (key === 'fitting_end_1') return !!resolvedFittingEnd1
        if (key === 'fitting_end_2') return fittingEnd1Qty === 1 && !!resolvedFittingEnd2
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
      let resolved = temp ?? base
      if (key === 'valve' && isHoseSelection && parsedHoseLength != null && temp != null) {
        const perMeter =
          supplierListPrices.valve ?? componentListPrice('valve', resolvedValve?.base_price)
        if (perMeter != null && Math.abs(temp - perMeter) < 0.015) {
          resolved = hosePriceForLength(perMeter, parsedHoseLength, hoseLengthUnit) ?? base
        }
      }
      componentFinalByKey[key] = resolved
    }
    const componentUnknowns = Object.entries(componentFinalByKey)
      .filter(([, price]) => price == null)
      .map(([k]) => k)
    const unknownKeyLabels: Record<string, string> = {
      valve: isTemporaryProduct
        ? 'Product'
        : isDamperSelection
          ? 'Damper'
          : requiresFittingsAddon
            ? 'Hose'
            : 'Valve',
      fitting_end_1: 'Fitting (End 1)',
      fitting_end_2: 'Fitting (End 2)',
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
  }, [
    resolvedValve,
    resolvedFittingEnd1,
    resolvedFittingEnd2,
    fittingEnd1Qty,
    categoryDisplayLabel,
    isTemporaryProduct,
    isDamperSelection,
    temporaryDescription,
    requiresFittingsAddon,
    isHoseSelection,
    parsedHoseLength,
    hoseLengthUnit,
    operatorKey,
    operatorModel,
    sov,
    lsb,
    positioner,
    componentPricing,
    componentListPrice,
    supplierListPrices.valve,
    customerDiscountPct,
  ])

  const isDaSa = operatorKey === 'da' || operatorKey === 'sa'
  const supportsOperatorAccessoryFlow =
    !isTemporaryProduct && supportsOperatorAccessoryFlowCategory(specs.catalog_category)
  const operatorUnlocksAccessories =
    supportsOperatorAccessoryFlow && operatorKey !== null && operatorKey !== 'bare_shaft'
  const canFinishNow = supportsOperatorAccessoryFlow && operatorKey === 'bare_shaft'
  const availableModels: OperatorModel[] = useMemo(() => {
    const list = operatorKey === 'da' ? daOps : operatorKey === 'sa' ? saOps : []
    return list
  }, [operatorKey, daOps, saOps])

  useEffect(() => {
    if (supportsOperatorAccessoryFlow) return
    if (stage === 'operator' || stage === 'actuator' || stage === 'accessories') {
      setStage('supplier')
    }
  }, [supportsOperatorAccessoryFlow, stage])

  // ── Handlers ──────────────────────────────────────────────────────────
  const clearTemporaryProduct = () => {
    setIsTemporaryProduct(false)
    setTemporaryDescription('')
    setTemporaryFamily(null)
    setCascadeSteps([])
    setSpecs(emptySpecs())
    setComponentPricing({})
  }

  const pickTemporaryProduct = (family: ConfiguratorProductFamily) => {
    setIsTemporaryProduct(true)
    setTemporaryFamily(family)
    setTemporaryDescription('')
    setCascadeSteps([])
    setFittingEnd1Specs(emptySpecs())
    setFittingEnd2Specs(emptySpecs())
    setFittingEnd1Qty(1)
    setResolvedFittingEnd1(null)
    setResolvedFittingEnd2(null)
    setHoseLength('1')
    setHoseLengthUnit('m')
    setOperatorKey(null)
    setOperatorModel(null)
    setSov(null)
    setLsb(null)
    setPositioner(null)
    setSpecs({
      catalog_category: TEMPORARY_PRODUCT_CATALOG_KEY,
      catalog_variant_type: null,
      catalog_nav_slug: null,
      field_values: {},
    })
    setComponentPricing({})
  }

  const clearCatalogSelection = () => {
    if (isTemporaryProduct) {
      clearTemporaryProduct()
      return
    }
    damperProductIdRef.current = null
    setCascadeSteps([])
    setSpecs(emptySpecs())
  }

  const pickCatalogCategory = (pick: ConfiguratorCatalogPick) => {
    setIsTemporaryProduct(false)
    setTemporaryDescription('')
    setTemporaryFamily(null)
    setCascadeSteps([])
    setFittingEnd1Specs(emptySpecs())
    setFittingEnd2Specs(emptySpecs())
    setFittingEnd1Qty(1)
    setResolvedFittingEnd1(null)
    setResolvedFittingEnd2(null)
    setHoseLength('1')
    setHoseLengthUnit('m')
    damperProductIdRef.current = isDamperCatalogCategory(pick.key)
      ? `${pick.key}:${crypto.randomUUID()}`
      : null
    const field_values: Record<string, string> = {}
    if (pick.variantType) field_values.variant_type = pick.variantType
    setSpecs({
      catalog_category: pick.key,
      catalog_variant_type: pick.variantType ?? null,
      catalog_nav_slug: pick.navSlug ?? null,
      catalog_display_label: pick.label ?? null,
      field_values,
    })
    if (!isDamperCatalogCategory(pick.key)) {
      void loadCatalog(pick.key, true)
    }
    const id =
      resolveSupplierFromSheetDefaults(
        sheetDefaultSuppliers,
        pick.key,
        pick.navSlug ?? null,
        suppliers ?? [],
      ) ?? pickActiveSupplierId(suppliers ?? [], null)
    if (id) setSupplierId(id)
    setComponentPricing({})
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

  const pickDamperField = (field: string, value: string) => {
    setSpecs((prev) => ({
      ...prev,
      field_values: { ...prev.field_values, [field]: value },
    }))
  }

  const valveForAssembly = useMemo((): ValveProduct | null => {
    if (!resolvedValve) return null
    const price = componentListPrice('valve', resolvedValve.base_price)
    return {
      ...resolvedValve,
      base_price: price,
      has_price: price != null,
    }
  }, [resolvedValve, componentListPrice])

  const fittingEnd1ForAssembly = useMemo((): ValveProduct | null => {
    if (!resolvedFittingEnd1) return null
    const price = componentListPrice('fitting_end_1', resolvedFittingEnd1.base_price)
    return {
      ...resolvedFittingEnd1,
      base_price: price,
      has_price: price != null,
    }
  }, [resolvedFittingEnd1, componentListPrice])

  const fittingEnd2ForAssembly = useMemo((): ValveProduct | null => {
    if (!resolvedFittingEnd2 || fittingEnd1Qty !== 1) return null
    const price = componentListPrice('fitting_end_2', resolvedFittingEnd2.base_price)
    return {
      ...resolvedFittingEnd2,
      base_price: price,
      has_price: price != null,
    }
  }, [resolvedFittingEnd2, fittingEnd1Qty, componentListPrice])

  const buildAssembled = (): AssembledProduct => ({
    id: initialProduct?.id ?? crypto.randomUUID(),
    valve: valveForAssembly,
    fitting: requiresFittingsAddon ? fittingEnd1ForAssembly : null,
    fitting_end_1:
      requiresFittingsAddon && !isBareFittingSelection(fittingEnd1Specs.catalog_category)
        ? fittingEnd1ForAssembly
        : null,
    fitting_end_1_bare:
      requiresFittingsAddon && isBareFittingSelection(fittingEnd1Specs.catalog_category),
    fitting_end_2:
      requiresFittingsAddon &&
      fittingEnd1Qty === 1 &&
      !isBareFittingSelection(fittingEnd2Specs.catalog_category)
        ? fittingEnd2ForAssembly
        : null,
    fitting_end_2_bare:
      requiresFittingsAddon &&
      fittingEnd1Qty === 1 &&
      isBareFittingSelection(fittingEnd2Specs.catalog_category),
    fitting_end_1_qty: requiresFittingsAddon ? fittingEnd1Qty : undefined,
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
    hose_length: isHoseSelection && parsedHoseLength != null ? parsedHoseLength : undefined,
    hose_length_unit: isHoseSelection ? hoseLengthUnit : undefined,
    is_temporary: isTemporaryProduct,
    temporary_product_family: isTemporaryProduct ? temporaryFamily : null,
    quantity: Math.max(1, Math.floor(quantity || 1)),
    unit: unit || 'Nos',
    customer_discount_pct: Number.isFinite(Number(customerDiscountPct)) ? Number(customerDiscountPct) : null,
    unit_price: priceInfo.unit_price,
    has_unknown_prices: priceInfo.has_unknown_prices,
    unknown_components: priceInfo.unknown_components,
    price_breakdown: priceInfo.breakdown,
  })

  const finishAndEmit = () => {
    if (isTemporaryProduct || isDamperSelection) {
      if (isTemporaryProduct && !temporaryDescription.trim()) return
      if (!resolvedValve || priceInfo.has_unknown_prices) return
      onProductComplete(buildAssembled())
      setStage('complete')
      return
    }
    if (requiresFittingsAddon && !fittingsComplete) return
    if (!hoseLengthValid) return
    const requiredMissing = Object.values(componentPricing).some(
      (entry) => entry.enabled && (suppliers ?? []).length > 0 && !entry.supplier_id,
    )
    if (requiredMissing) return
    onProductComplete(buildAssembled())
    setStage('complete')
  }

  const goBackFromReview = () => {
    if (supportsOperatorAccessoryFlow) {
      if (isDaSa) setStage('actuator')
      else if (operatorUnlocksAccessories) setStage('accessories')
      else setStage('operator')
      return
    }
    if (requiresFittingsAddon) {
      setStage('fittings')
      return
    }
    setStage('valve_specs')
  }
  // ── Stage indicator ───────────────────────────────────────────────────
  // Supplier selection is always the last step before completion.
  const baseSteps = supportsOperatorAccessoryFlow
    ? isDaSa
      ? 4
      : operatorUnlocksAccessories
        ? 3
        : 2
    : requiresFittingsAddon
      ? 2
      : 1
  const totalSteps = baseSteps + 1
  const stageNumber =
    stage === 'valve_specs'
      ? 1
      : stage === 'fittings'
        ? 2
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
      ? isTemporaryProduct
        ? `Step 1 of ${totalSteps} — Temporary product`
        : `Step 1 of ${totalSteps} — Select ${
            specs.catalog_category && isHoseCatalogCategory(specs.catalog_category)
              ? 'Hose'
              : isDamperSelection
                ? 'Damper'
                : 'Product'
          } specifications`
      : stage === 'fittings'
        ? `Step 2 of ${totalSteps} — Select Fitting`
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
          <ConfiguratorCategoryPicker
            selection={categorySelection}
            onSelect={pickCatalogCategory}
            onClearSelection={clearCatalogSelection}
            temporaryActive={isTemporaryProduct}
            onSelectTemporary={pickTemporaryProduct}
            onClearTemporary={clearTemporaryProduct}
          />

          {isTemporaryProduct && (
            <div className="space-y-1.5">
              <label
                htmlFor={`temp-product-desc-${productIndex}`}
                className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]"
              >
                Product description
              </label>
              <Textarea
                id={`temp-product-desc-${productIndex}`}
                value={temporaryDescription}
                onChange={(e) => setTemporaryDescription(e.target.value)}
                placeholder="Describe the product (size, material, end connections, etc.)"
                rows={4}
                className="min-h-[96px] resize-y"
              />
            </div>
          )}

          {!isTemporaryProduct &&
            !isDamperSelection &&
            specs.catalog_category &&
            catalogError && (
            <p className="text-[12px] text-red-600">{catalogError}</p>
          )}

          {!isTemporaryProduct &&
            !isDamperSelection &&
            specs.catalog_category &&
            catalogLoading && (
            <div className="flex items-center gap-2 text-[12px] text-surface-muted">
              <Loader2 className="size-4 animate-spin" />
              Loading {categoryDisplayLabel || specs.catalog_category} catalog
              {rowCount > 0 ? ` (${rowCount} rows)` : '…'}
            </div>
          )}

          {isDamperSelection && specs.catalog_category && (
            <DamperSpecFields
              catalogKey={specs.catalog_category}
              fieldValues={specs.field_values}
              onFieldChange={pickDamperField}
            />
          )}

          {!isTemporaryProduct &&
            !isDamperSelection &&
            specs.catalog_category &&
            !catalogLoading &&
            cascadeSteps.length > 0 && (
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
                const selected = String(specs.field_values[field] ?? '').trim()
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
                        title={selected || undefined}
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

          {isHoseSelection && (
            <div className="grid gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-surface-muted">
                Length
              </span>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={hoseLength}
                  onChange={(e) => setHoseLength(e.target.value)}
                  placeholder="e.g. 10"
                  className="min-w-0 flex-1"
                />
                <Select
                  value={hoseLengthUnit}
                  onValueChange={(v) => setHoseLengthUnit(v as HoseLengthUnit)}
                >
                  <SelectTrigger className="w-[140px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m">meters (m)</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!hoseLengthValid && hoseLength.trim() !== '' && (
                <p className="text-[12px] text-red-600">Enter a length greater than 0.</p>
              )}
            </div>
          )}

          {resolvedValve && (
            <div
              className={cn(
                'rounded-xl border p-4',
                isTemporaryProduct
                  ? 'border-brand-gold-200 bg-brand-gold-50'
                  : 'border-brand-green-200 bg-brand-green-50',
              )}
            >
              <p
                className={cn(
                  'text-[13px] font-semibold',
                  isTemporaryProduct ? 'text-brand-gold-800' : 'text-brand-green-700',
                )}
              >
                <Check className="mr-1 inline size-4" />
                {isTemporaryProduct
                  ? 'Temporary product ready for review'
                  : resolvedValve.type}
                {!isTemporaryProduct && resolvedValve.construction
                  ? ` — ${resolvedValve.construction}`
                  : ''}
              </p>
              {isTemporaryProduct ? (
                <p className="mt-1 text-[12px] text-gray-800">{resolvedValve.type}</p>
              ) : (
                <>
                  <p className="mt-1 text-[12px] text-gray-800">
                    {resolvedValve.valve_size ? <>Size: {resolvedValve.valve_size}</> : null}
                    {resolvedValve.body ? <> | Body: {resolvedValve.body}</> : null}
                  </p>
                  <p className="text-[12px] text-gray-800">
                    {[resolvedValve.end_connection, resolvedValve.pressure].filter(Boolean).join(' | ') || '—'}
                  </p>
                </>
              )}
              {!isTemporaryProduct && !isDamperSelection && (
              <p className="mt-2 font-mono text-[13px] text-brand-green-700">
                {isHoseSelection ? (
                  <>
                    List price: {priceText(componentListPrice('valve', resolvedValve.base_price))} / m
                    {parsedHoseLength != null && (
                      <>
                        {' '}
                        · Hose price ({formatHoseLength(parsedHoseLength, hoseLengthUnit)}):{' '}
                        {priceText(
                          hosePriceForLength(
                            componentListPrice('valve', resolvedValve.base_price),
                            parsedHoseLength,
                            hoseLengthUnit,
                          ),
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>Base Price: {priceText(componentListPrice('valve', resolvedValve.base_price))}</>
                )}
              </p>
              )}
              {isDamperSelection && (
                <p className="mt-2 text-[12px] text-brand-gold-800">
                  No catalog price — enter unit price on the review step.
                </p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-surface-muted">
              {isTemporaryProduct
                ? 'Enter a description, then continue to set price on review.'
                : isDamperSelection
                  ? 'Pick specs from each column (ME fields are optional), then choose operator.'
                  : specs.catalog_category
                    ? 'Pick each spec to narrow down.'
                    : 'Choose family, then type and product sheet (one step at a time).'}
            </span>
            <Button
              type="button"
              onClick={() =>
                setStage(
                  isTemporaryProduct
                    ? 'supplier'
                    : supportsOperatorAccessoryFlow
                      ? 'operator'
                      : requiresFittingsAddon
                        ? 'fittings'
                        : 'supplier',
                )
              }
              disabled={!resolvedValve || (!isTemporaryProduct && !isDamperSelection && !hoseLengthValid)}
              className="bg-brand-green-500 text-white hover:bg-brand-green-600"
            >
              {isTemporaryProduct
                ? 'Next: Review'
                : supportsOperatorAccessoryFlow
                  ? 'Next'
                  : requiresFittingsAddon
                    ? 'Next: Fittings'
                    : 'Next: Review'}{' '}
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STAGE 2: Hose fittings (two ends) ───────────────────────── */}
      {stage === 'fittings' && requiresFittingsAddon && (
        <div className="mt-4 space-y-4">
          <p className="text-[12px] text-surface-muted">
            A hose has two ends — pick a fitting for each end, or choose Bare Fitting for an end with
            no fitting. Set quantity to 2 on End 1 if both ends use the same choice, or quantity 1
            and then select End 2 separately.
          </p>

          <HoseFittingEndPicker
            title="Hose fitting — End 1"
            specs={fittingEnd1Specs}
            onSpecsChange={setFittingEnd1Specs}
            onResolvedChange={handleResolvedFittingEnd1}
            hoseSizeForMatch={fittingsHoseSize}
            showQuantity
            quantity={fittingEnd1Qty}
            onQuantityChange={setFittingEnd1Qty}
            listUnitPrice={(base) => componentListPrice('fitting_end_1', base)}
          />
          {fittingEnd1Qty === 1 && (
            <>
              <HoseFittingEndPicker
                title="Hose fitting — End 2"
                specs={fittingEnd2Specs}
                onSpecsChange={setFittingEnd2Specs}
                onResolvedChange={handleResolvedFittingEnd2}
                hoseSizeForMatch={fittingsHoseSize}
                listUnitPrice={(base) => componentListPrice('fitting_end_2', base)}
              />
            </>
          )}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => setStage('valve_specs')}>
              <ChevronLeft className="mr-1 size-4" /> Change Hose
            </Button>
            <Button
              type="button"
              onClick={() => setStage('supplier')}
              disabled={!fittingsComplete}
              className="bg-brand-green-500 text-white hover:bg-brand-green-600"
            >
              Next: Review <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STAGE 2: Operator type ──────────────────────────────────── */}
      {stage === 'operator' && supportsOperatorAccessoryFlow && (
        <div className="mt-4 space-y-4">
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
                  {PRICE_ON_REQUEST_OPERATOR_KEYS.has(opt.key) && (
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
                        ? `${models.length} actuator model${models.length === 1 ? '' : 's'} available`
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
              <ChevronLeft className="mr-1 size-4" />{' '}
              {isDamperSelection ? 'Change Damper' : 'Change Valve'}
            </Button>
            {isDaSa && (
              <Button
                type="button"
                onClick={() => setStage('actuator')}
                disabled={availableModels.length === 0}
                className="bg-brand-green-500 text-white hover:bg-brand-green-600 disabled:opacity-50"
              >
                Next: Pick Actuator <ChevronRight className="ml-1 size-4" />
              </Button>
            )}
            {operatorKey === 'electric_actuator' && (
              <Button
                type="button"
                onClick={() => setStage('accessories')}
                className="bg-brand-green-500 text-white hover:bg-brand-green-600"
              >
                Next: Accessories <ChevronRight className="ml-1 size-4" />
              </Button>
            )}
            {(operatorKey === 'manual' ||
              operatorKey === 'gear_box' ||
              operatorKey === 'pneumatic_rack_pinion' ||
              operatorKey === 'pneumatic_cylinder') && (
              <Button
                type="button"
                onClick={() => setStage('accessories')}
                className="bg-brand-green-500 text-white hover:bg-brand-green-600"
              >
                Next: Accessories <ChevronRight className="ml-1 size-4" />
              </Button>
            )}
            {canFinishNow && (
              <Button
                type="button"
                onClick={() => setStage('supplier')}
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
            Pick the {operatorKey === 'da' ? 'Double Acting' : 'Single Acting'} actuator model.
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
              <SelectTrigger
                className={SPEC_SELECT_TRIGGER_CLASS}
                title={
                  operatorModel
                    ? `${operatorModel.model_name}${operatorModel.size ? ` — ${operatorModel.size}` : ''}`
                    : undefined
                }
              >
                <SelectValue placeholder="Select an actuator model">
                  {operatorModel?.model_name ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent variant="wide" align="start">
                <SelectItem value={SELECT_EMPTY}>
                  <span className="text-muted-foreground">Select…</span>
                </SelectItem>
                {availableModels.map((m) => (
                  <SelectItem
                    key={m.id}
                    value={m.id}
                    title={`${m.model_name}${m.size ? ` — ${m.size}` : ''}`}
                  >
                    {m.model_name}
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
              </p>
              <p className="mt-1 font-mono text-brand-green-700">
                {componentListPrice('operator', operatorModel.base_price) != null
                  ? `${formatCurrency(componentListPrice('operator', operatorModel.base_price)!)} added`
                  : '₹TBD'}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => setStage('operator')}>
              <ChevronLeft className="mr-1 size-4" /> Change Operator
            </Button>
            <Button
              type="button"
              onClick={() => setStage('accessories')}
              disabled={!operatorModel}
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
              {accessoryCategories.map((cat) => {
                const items = accessoryItemsForCategory(accessories, cat.catalogKey)
                const value =
                  cat.catalogKey === 'sov'
                    ? sov
                    : cat.catalogKey === 'limit_switch_box'
                      ? lsb
                      : positioner
                const onChange =
                  cat.catalogKey === 'sov'
                    ? setSov
                    : cat.catalogKey === 'limit_switch_box'
                      ? setLsb
                      : setPositioner
                return (
                  <div key={cat.catalogKey}>
                    <AccessoryToggleRow
                      label={cat.uiLabel}
                      catalogKey={cat.catalogKey}
                      items={items}
                      subcategories={cat.subcategories}
                      value={value}
                      onChange={onChange}
                    />
                  </div>
                )
              })}
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

          {!isTemporaryProduct &&
            !isDamperSelection &&
            (suppliers ?? []).length > 0 &&
            Object.entries(componentPricing)
              .filter(([, cfg]) => cfg.enabled && !cfg.supplier_id)
              .map(([k]) => (
                <p key={k} className="text-[12px] text-red-600">
                  Missing supplier for {k}.
                </p>
              ))}
          {requiresManualProductPrice && priceInfo.has_unknown_prices && (
            <p className="text-[12px] text-red-600">
              Enter a unit price for the product in the running total below.
            </p>
          )}

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
            <Button type="button" variant="outline" onClick={goBackFromReview}>
              <ChevronLeft className="mr-1 size-4" /> Back
            </Button>
            <Button
              type="button"
              onClick={finishAndEmit}
              disabled={
                isTemporaryProduct || isDamperSelection
                  ? (isTemporaryProduct && !temporaryDescription.trim()) ||
                    !resolvedValve ||
                    priceInfo.has_unknown_prices
                  : (suppliers ?? []).length > 0 &&
                    Object.values(componentPricing).some(
                      (entry) => entry.enabled && !entry.supplier_id,
                    )
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
  catalogKey,
  items,
  subcategories,
  value,
  onChange,
}: {
  label: string
  catalogKey: AccessoryCatalogKey
  items: AccessoryItem[]
  subcategories: AccessorySubcategory[]
  value: AccessoryItem | null
  onChange: (v: AccessoryItem | null) => void
}) {
  const [open, setOpen] = useState<boolean>(value != null)
  const active = open || value != null
  const [mode, setMode] = useState<'catalog' | 'custom'>(() =>
    value && isTemporaryAccessory(value) ? 'custom' : 'catalog',
  )
  const [customDescription, setCustomDescription] = useState(() =>
    value && isTemporaryAccessory(value) ? value.type : '',
  )
  const [customPrice, setCustomPrice] = useState(() =>
    value && isTemporaryAccessory(value) && value.price != null ? String(value.price) : '',
  )
  const customIdRef = useRef(
    value && isTemporaryAccessory(value)
      ? value.id
      : `${TEMPORARY_ACCESSORY_ID_PREFIX}${catalogKey}:${crypto.randomUUID()}`,
  )

  const groups = useMemo(
    () => groupAccessoryItems(items, subcategories),
    [items, subcategories],
  )

  useEffect(() => {
    if (!open) onChange(null)
  }, [open, onChange])

  useEffect(() => {
    if (!value || !isTemporaryAccessory(value)) return
    setMode('custom')
    setCustomDescription(value.type)
    setCustomPrice(value.price != null ? String(value.price) : '')
    customIdRef.current = value.id
  }, [value])

  useEffect(() => {
    if (!active || mode !== 'custom') return
    const desc = customDescription.trim()
    const price = Number((customPrice || '').trim())
    if (!desc || !Number.isFinite(price) || price <= 0) {
      onChange(null)
      return
    }
    onChange(buildTemporaryAccessory(desc, price, customIdRef.current))
  }, [active, mode, customDescription, customPrice, onChange])

  const switchToCatalog = () => {
    setMode('catalog')
    setCustomDescription('')
    setCustomPrice('')
    onChange(null)
  }

  const switchToCustom = () => {
    setMode('custom')
    onChange(null)
    customIdRef.current = `${TEMPORARY_ACCESSORY_ID_PREFIX}${catalogKey}:${crypto.randomUUID()}`
  }

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
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={switchToCatalog}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
                mode === 'catalog'
                  ? 'border-brand-green-500 bg-brand-green-50 text-brand-green-800'
                  : 'border-surface-border bg-white text-surface-muted hover:border-brand-green-400',
              )}
            >
              From catalog
            </button>
            <button
              type="button"
              onClick={switchToCustom}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
                mode === 'custom'
                  ? 'border-brand-gold-500 bg-brand-gold-50 text-brand-gold-800'
                  : 'border-surface-border bg-white text-surface-muted hover:border-brand-gold-400',
              )}
            >
              Custom temporary
            </button>
          </div>

          {mode === 'catalog' ? (
            groups.length === 0 ? (
              <p className="text-[12px] text-surface-muted">No models available for this category.</p>
            ) : (
              <Select
                value={value && !isTemporaryAccessory(value) ? value.id : SELECT_EMPTY}
                onValueChange={(raw) => {
                  const id = fromSelectValue(raw)
                  const item = items.find((x) => x.id === id) ?? null
                  onChange(item)
                }}
              >
                <SelectTrigger
                  className={SPEC_SELECT_TRIGGER_CLASS}
                  title={value && !isTemporaryAccessory(value) ? value.type : undefined}
                >
                  <SelectValue placeholder={`Select ${label}`} />
                </SelectTrigger>
                <SelectContent variant="wide" align="start">
                  <SelectItem value={SELECT_EMPTY}>
                    <span className="text-muted-foreground">Select…</span>
                  </SelectItem>
                  {groups.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel className="text-[11px] font-semibold uppercase tracking-wide text-[#8A9488]">
                        {group.label}
                      </SelectLabel>
                      {group.items.map((item) => {
                        const optLabel = `${item.type} — ${
                          item.price != null ? formatCurrency(item.price) : '₹TBD'
                        }`
                        return (
                          <SelectItem key={item.id} value={item.id} multiline title={optLabel}>
                            {optLabel}
                          </SelectItem>
                        )
                      })}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )
          ) : (
            <div className="space-y-2 rounded-lg border border-brand-gold-200 bg-brand-gold-50/50 p-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                  Description
                </label>
                <Textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder={`Describe this ${label.toLowerCase()}`}
                  rows={2}
                  className="min-h-[64px] resize-y bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                  Price (INR)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="e.g. 5000"
                  className="bg-white font-mono"
                />
              </div>
            </div>
          )}

          {value && (
            <p className="font-mono text-[12px] text-brand-green-700">
              {value.type}
              {isTemporaryAccessory(value) ? ' (custom)' : ''} —{' '}
              {value.price != null ? `${formatCurrency(value.price)} added` : '₹TBD'}
            </p>
          )}
          {mode === 'custom' && active && !value && (
            <p className="text-[12px] text-brand-gold-700">
              Enter a description and price to include this accessory.
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
    breakdown: Array<{
      component: string
      price: number | null
      pricing_key?: SupplierPriceComponentKey | 'bracket'
    }>
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
                value={
                  row.pricing_key
                    ? (componentPricing[row.pricing_key]?.temp_price ?? '')
                    : ''
                }
                onChange={(e) => {
                  const key = row.pricing_key
                  if (!key) return
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
