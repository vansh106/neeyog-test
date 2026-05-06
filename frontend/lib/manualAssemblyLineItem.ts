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

export function catalogPartsForAssembly(p: AssembledProduct): CatalogPart[] {
  const parts: CatalogPart[] = []
  const v = p.valve
  if (v?.id) {
    const ct = valveCatalogTable(v)
    if (ct) parts.push({ label: 'Valve', catalog_table: ct, catalog_row_id: v.id })
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
  if (!v) return 'Assembly'
  return [v.type, v.construction, v.valve_size].filter(Boolean).join(' — ')
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
export function assembledToLineItem(p: AssembledProduct, unitPriceOverride: number | null): ManualLineItem {
  const v = p.valve
  const materialParts = v
    ? [v.body, v.ball_disc ?? v.ball, v.stem, v.seat, v.fasteners].filter(Boolean)
    : []
  const material = materialParts.join(' / ') || ''
  const name = v
    ? [v.type, v.construction, v.valve_size].filter(Boolean).join(' — ')
    : 'Valve Assembly'

  const catalogTable = v ? valveCatalogTable(v) : null
  const rawCatalogId = v?.id ?? uuidv4()
  const catalogId =
    typeof rawCatalogId === 'string' && rawCatalogId.includes(':')
      ? rawCatalogId
      : catalogTable && rawCatalogId
        ? `${catalogTable}:${rawCatalogId}`
        : rawCatalogId

  const sel: ProductSizeOption = {
    id: catalogId,
    name,
    size_inch: parseSizeInch(v?.valve_size ?? null),
    size_mm: parseSizeMm(v?.valve_size ?? null),
    material,
    base_price:
      unitPriceOverride != null && Number.isFinite(unitPriceOverride) ? unitPriceOverride : (p.unit_price ?? 0),
    unit: 'Nos',
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
  }
}
