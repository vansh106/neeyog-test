/**
 * Shared helpers: manual configurator (AssembledProduct) ↔ API ManualLineItem shape.
 */

import type {
  AssembledProduct,
  ManualLineItem,
  OperatorKey,
  ProductSizeOption,
  ValveProduct,
} from '@/types'
import { isPositivePrice } from '@/lib/utils'
import { isHoseCatalogCategory } from '@/lib/configuratorProductFlow'
import {
  formatHoseLength,
  hoseLengthToMeters,
  type HoseLengthUnit,
} from '@/lib/hoseLengthPricing'

const HOSE_CASCADE_KEYS = [
  'variant_type',
  'size_id_mm',
  'temperature_range',
  'wall_thickness',
] as const

const VALVE_CASCADE_KEYS = [
  'variant_type',
  'product_sheet',
  'construction',
  'valve_size',
  'bore_type',
  'end_connection',
  'pressure',
  'body',
  'ball_disc',
  'ball',
  'stem',
  'seat',
  'fasteners',
] as const

const FITTING_CASCADE_KEYS = [
  'variant_type',
  'end_connection_1',
  'end_connection_2',
  'size_mm',
  'hose_nipple_moc',
  'hose_cap_moc',
  'sms_nut_moc',
  'tc_od',
  'din_nut_moc',
  'swivel_nut_moc',
  'flange_nut_moc',
] as const

function productCascadeFields(
  product: ValveProduct,
  keys: readonly string[],
  keyPrefix = '',
): Record<string, string> {
  const out: Record<string, string> = {}
  const row = product as unknown as Record<string, string | null | undefined>
  for (const field of keys) {
    const raw = row[field]
    if (raw == null || String(raw).trim() === '') continue
    const cascadeKey = keyPrefix ? `${keyPrefix}_${field}` : field
    out[cascadeKey] = String(raw).trim()
  }
  return out
}

function assemblyProductTitle(p: AssembledProduct): string {
  const v = p.valve
  if (!v) return 'Assembly'
  if (isHoseCatalogCategory(v.catalog_category)) {
    const parts = [v.type, v.variant_type, v.size_id_mm].filter(Boolean)
    if (p.hose_length != null) {
      parts.push(formatHoseLength(p.hose_length, (p.hose_length_unit ?? 'm') as HoseLengthUnit))
    }
    return parts.join(' — ') || 'Hose'
  }
  return [v.type, v.construction, v.valve_size].filter(Boolean).join(' — ') || 'Product'
}

export function uuidv4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16)
}

export function operatorLabel(k: OperatorKey | null): string {
  switch (k) {
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

export type CatalogPart = { label: string; catalog_table: string; catalog_row_id: string }

export function valveTypeToLegacyCatalogTable(
  valveType: string | null | undefined,
): 'butterfly_valve' | 'ball_valve' | null {
  const t = (valveType || '').toLowerCase()
  if (t.includes('butterfly')) return 'butterfly_valve'
  if (t.includes('ball')) return 'ball_valve'
  return null
}

export function valveCatalogTable(v: ValveProduct | null | undefined): string | null {
  if (v?.catalog_category) return v.catalog_category
  return valveTypeToLegacyCatalogTable(v?.type)
}

/** Maps ``catalogPartsForAssembly`` label → ``component_pricing`` key. */
export function assemblyPartComponentKey(label: string): string {
  const l = label.toLowerCase()
  if (l === 'valve' || l === 'hose') return 'valve'
  if (l.includes('fitting (end 1')) return 'fitting_end_1'
  if (l.includes('fitting (end 2')) return 'fitting_end_2'
  if (l === 'operator') return 'operator'
  if (l === 'sov') return 'sov'
  if (l.includes('limit switch')) return 'lsb'
  if (l === 'positioner') return 'positioner'
  if (l.includes('bracket')) return 'bracket'
  return ''
}

/** Unit count for a catalog part on one hose assembly (End 1 qty 2 → multiplier 2). */
export function assemblyPartUnitMultiplier(label: string, p: AssembledProduct): number {
  const l = label.toLowerCase()
  if (l === 'hose' && p.hose_length != null && p.hose_length > 0) {
    return hoseLengthToMeters(p.hose_length, (p.hose_length_unit ?? 'm') as HoseLengthUnit)
  }
  if (l.includes('fitting (end 1') && (p.fitting_end_1_qty ?? 1) === 2) return 2
  return 1
}

export function catalogPartsForAssembly(p: AssembledProduct): CatalogPart[] {
  const parts: CatalogPart[] = []
  const v = p.valve
  if (v?.id) {
    const ct = valveCatalogTable(v)
    if (ct) parts.push({ label: 'Hose', catalog_table: ct, catalog_row_id: v.id })
  }
  const f1 = p.fitting_end_1 ?? p.fitting
  if (f1?.id && f1.catalog_category) {
    const qty = p.fitting_end_1_qty ?? 1
    parts.push({
      label: qty === 2 ? 'Fitting (End 1 ×2)' : 'Fitting (End 1)',
      catalog_table: f1.catalog_category,
      catalog_row_id: f1.id,
    })
  }
  const f2 = p.fitting_end_2
  if (f2?.id && f2.catalog_category) {
    parts.push({
      label: 'Fitting (End 2)',
      catalog_table: f2.catalog_category,
      catalog_row_id: f2.id,
    })
  }
  if ((p.operator_key === 'da' || p.operator_key === 'sa') && p.operator_model?.id) {
    parts.push({ label: 'Operator', catalog_table: 'operator', catalog_row_id: p.operator_model.id })
  }
  if (p.sov?.id) parts.push({ label: 'SOV', catalog_table: 'sov', catalog_row_id: p.sov.id })
  if (p.limit_switch_box?.id) {
    parts.push({
      label: 'Limit switch',
      catalog_table: 'limit_switch_box',
      catalog_row_id: p.limit_switch_box.id,
    })
  }
  if (p.positioner?.id) {
    parts.push({ label: 'Positioner', catalog_table: 'positioner', catalog_row_id: p.positioner.id })
  }
  if (p.include_bracket && p.bracket?.id) {
    parts.push({
      label: 'Bracket / coupler',
      catalog_table: 'brackets_coupler',
      catalog_row_id: p.bracket.id,
    })
  }
  return parts
}

export function assemblyLabel(p: AssembledProduct): string {
  const v = p.valve
  const f1 = p.fitting_end_1 ?? p.fitting
  const f2 = p.fitting_end_2
  if (!v && !f1 && !f2) return 'Assembly'
  const hosePart = v
    ? [
        [v.type, v.construction, v.valve_size ?? v.size_id_mm].filter(Boolean).join(' — '),
        p.hose_length != null
          ? formatHoseLength(p.hose_length, (p.hose_length_unit ?? 'm') as HoseLengthUnit)
          : null,
      ]
        .filter(Boolean)
        .join(' — ')
    : ''
  const fit1Part = p.fitting_end_1_bare
    ? 'Bare fitting'
    : f1
      ? [f1.variant_type, f1.size_mm as string | undefined].filter(Boolean).join(' — ')
      : ''
  const fit2Part = p.fitting_end_2_bare
    ? 'Bare fitting'
    : f2
      ? [f2.variant_type, f2.size_mm as string | undefined].filter(Boolean).join(' — ')
      : ''
  const fitPart =
    fit1Part && fit2Part
      ? `${fit1Part} + ${fit2Part}`
      : fit1Part
        ? `${fit1Part}${(p.fitting_end_1_qty ?? 1) === 2 ? ' (×2)' : ''}`
        : fit2Part
  if (hosePart && fitPart) return `${hosePart} + ${fitPart}`
  return hosePart || fitPart || 'Assembly'
}

/** Parse leading inch size like `2"` or `1 1/2"` from valve_size text. */
export function parseSizeInch(valveSize: string | null | undefined): number | null {
  if (!valveSize) return null
  const m = valveSize.trim().match(/^(\d+)\s+(\d+)\/(\d+)\s*"?$/)
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3])
  const m2 = valveSize.trim().match(/^(\d+)\/(\d+)\s*"?$/)
  if (m2) return Number(m2[1]) / Number(m2[2])
  const m3 = valveSize.trim().match(/^(\d+(?:\.\d+)?)\s*"?$/)
  if (m3) return Number(m3[1])
  return null
}

export function parseSizeMm(valveSize: string | null | undefined): number | null {
  if (!valveSize) return null
  const mDn = valveSize.match(/DN\s*(\d+)/i)
  if (mDn) return Number(mDn[1])
  const mMm = valveSize.match(/(\d+)\s*MM/i)
  if (mMm) return Number(mMm[1])
  return null
}

/** Adapt an AssembledProduct into the ManualLineItem request shape. */
export function assembledToLineItem(
  p: AssembledProduct,
  unitPriceOverride: number | null,
  customerDiscountPct: number | null = null,
): ManualLineItem {
  const v = p.valve
  const materialParts = v
    ? [v.body, v.ball_disc ?? v.ball, v.stem, v.seat, v.fasteners].filter(Boolean)
    : []
  const material = materialParts.join(' / ') || ''
  const name = assemblyProductTitle(p)

  const catalogTable = v ? valveCatalogTable(v) : null
  const rawCatalogId = v?.id ?? uuidv4()
  const catalogId =
    typeof rawCatalogId === 'string' && rawCatalogId.includes(':')
      ? rawCatalogId
      : catalogTable && rawCatalogId
        ? `${catalogTable}:${rawCatalogId}`
        : rawCatalogId

  const resolvedUnit =
    unitPriceOverride != null && isPositivePrice(unitPriceOverride)
      ? unitPriceOverride
      : isPositivePrice(p.unit_price)
        ? p.unit_price
        : null
  const priceTbd = p.has_unknown_prices || !isPositivePrice(resolvedUnit)

  const sel: ProductSizeOption = {
    id: catalogId,
    name,
    size_inch: parseSizeInch(v?.valve_size ?? null),
    size_mm: parseSizeMm(v?.valve_size ?? v?.size_id_mm ?? null),
    material,
    base_price: resolvedUnit,
    unit: p.unit || 'Nos',
    display_label: name,
  }

  const cascade: Record<string, string> = {}
  if (v) {
    if (isHoseCatalogCategory(v.catalog_category)) {
      Object.assign(cascade, productCascadeFields(v, HOSE_CASCADE_KEYS))
    } else {
      Object.assign(cascade, productCascadeFields(v, VALVE_CASCADE_KEYS))
    }
  }
  if (p.hose_length != null) {
    cascade.hose_length = formatHoseLength(
      p.hose_length,
      (p.hose_length_unit ?? 'm') as HoseLengthUnit,
    )
  }
  if (p.fitting_end_1_bare) {
    cascade.fitting_end_1 = 'Bare fitting'
  } else {
    const fit1 = p.fitting_end_1 ?? p.fitting
    if (fit1) {
      Object.assign(cascade, productCascadeFields(fit1, FITTING_CASCADE_KEYS, 'fitting_end_1'))
      if ((p.fitting_end_1_qty ?? 1) === 2) cascade.fitting_end_1_qty = '2'
    }
  }
  if (p.fitting_end_2_bare) {
    cascade.fitting_end_2 = 'Bare fitting'
  } else {
    const fit2 = p.fitting_end_2
    if (fit2) {
      Object.assign(cascade, productCascadeFields(fit2, FITTING_CASCADE_KEYS, 'fitting_end_2'))
    }
  }
  if (p.operator_key) {
    cascade.operator = operatorLabel(p.operator_key)
    if (p.operator_model) {
      cascade.operator_model = p.operator_model.model_name
      if (p.operator_model.size) cascade.operator_size = p.operator_model.size
    }
  }
  if (p.sov) cascade.sov = p.sov.type
  if (p.limit_switch_box) cascade.limit_switch_box = p.limit_switch_box.type
  if (p.positioner) cascade.positioner = p.positioner.type
  if (p.include_bracket && p.bracket) cascade.bracket_coupler = `Included (${p.bracket.size})`
  if (p.supplier_name) cascade.supplier = p.supplier_name
  if (p.supplier_id) cascade.supplier_id = p.supplier_id

  return {
    id: p.id,
    category: catalogTable ?? 'unknown',
    cascadeSelections: cascade,
    selectedProduct: sel,
    quantity: p.quantity,
    customer_discount_pct:
      customerDiscountPct != null && Number.isFinite(customerDiscountPct) ? customerDiscountPct : undefined,
    price_tbd: priceTbd,
    component_pricing: p.component_pricing ?? undefined,
  }
}
