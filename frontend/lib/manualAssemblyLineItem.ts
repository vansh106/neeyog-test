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
  if (label.toLowerCase().includes('fitting (end 1') && (p.fitting_end_1_qty ?? 1) === 2) return 2
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
    ? [v.type, v.construction, v.valve_size ?? v.size_id_mm].filter(Boolean).join(' — ')
    : ''
  const fit1Part = f1
    ? [f1.variant_type, f1.size_mm as string | undefined].filter(Boolean).join(' — ')
    : ''
  const fit2Part = f2
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
  const hoseName = v
    ? [v.type, v.construction, v.valve_size].filter(Boolean).join(' — ')
    : ''
  const f1 = p.fitting_end_1 ?? p.fitting
  const f2 = p.fitting_end_2
  const fittingName = f1
    ? [
        [f1.variant_type, f1.size_mm].filter(Boolean).join(' — '),
        (p.fitting_end_1_qty ?? 1) === 2 ? '×2 same end' : null,
        f2 ? [f2.variant_type, f2.size_mm].filter(Boolean).join(' — ') : null,
      ]
        .filter(Boolean)
        .join(' + ')
    : ''
  const name =
    hoseName && fittingName
      ? `${hoseName} + ${fittingName}`
      : hoseName || fittingName || 'Assembly'

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
    size_mm: parseSizeMm(v?.valve_size ?? null),
    material,
    base_price: resolvedUnit,
    unit: p.unit || 'Nos',
    display_label: name,
  }

  const cascade: Record<string, string> = {}
  if (v) {
    if (v.variant_type) cascade.variant_type = v.variant_type
    if (v.product_sheet) cascade.product_sheet = v.product_sheet
    if (v.construction) cascade.construction = v.construction
    if (v.valve_size) cascade.valve_size = v.valve_size
    if (v.bore_type) cascade.bore_type = v.bore_type
    if (v.end_connection) cascade.end_connection = v.end_connection
    if (v.pressure) cascade.pressure = v.pressure
    if (v.body) cascade.body = v.body
    if (v.ball_disc) cascade.ball_disc = v.ball_disc
    if (v.ball) cascade.ball = v.ball
    if (v.stem) cascade.stem = v.stem
    if (v.seat) cascade.seat = v.seat
    if (v.fasteners) cascade.fasteners = v.fasteners
  }
  const fit1 = p.fitting_end_1 ?? p.fitting
  if (fit1) {
    if (fit1.variant_type) cascade.fitting_end_1_variant_type = fit1.variant_type
    if (fit1.size_mm) cascade.fitting_end_1_size_mm = fit1.size_mm
    if (fit1.hose_nipple_moc) cascade.fitting_end_1_hose_nipple_moc = fit1.hose_nipple_moc
    if (fit1.hose_cap_moc) cascade.fitting_end_1_hose_cap_moc = fit1.hose_cap_moc
    if (p.fitting_end_1_qty) cascade.fitting_end_1_qty = String(p.fitting_end_1_qty)
  }
  const fit2 = p.fitting_end_2
  if (fit2) {
    if (fit2.variant_type) cascade.fitting_end_2_variant_type = fit2.variant_type
    if (fit2.size_mm) cascade.fitting_end_2_size_mm = fit2.size_mm
    if (fit2.hose_nipple_moc) cascade.fitting_end_2_hose_nipple_moc = fit2.hose_nipple_moc
    if (fit2.hose_cap_moc) cascade.fitting_end_2_hose_cap_moc = fit2.hose_cap_moc
  }
  cascade.operator = operatorLabel(p.operator_key)
  if (p.operator_model) {
    cascade.operator_model = p.operator_model.model_name
    if (p.operator_model.size) cascade.operator_size = p.operator_model.size
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
