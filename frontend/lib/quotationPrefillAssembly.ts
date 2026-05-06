/**
 * Rehydrate manual configurator state from enquiry JSON or quotation line rows.
 */

import { uuidv4 } from '@/lib/manualAssemblyLineItem'
import type {
  AccessoryItem,
  AssembledProduct,
  ManualLineItem,
  OperatorKey,
  OperatorModel,
  QuotationLineItem,
  ValveProduct,
} from '@/types'

const LABEL_TO_OPERATOR_KEY: Record<string, OperatorKey> = {
  'Bare Shaft': 'bare_shaft',
  Manual: 'manual',
  'Gear Box': 'gear_box',
  'Double Acting (DA)': 'da',
  'Single Acting (SA)': 'sa',
  'Electric Actuator': 'electric_actuator',
}

function accessoryFromType(t: string | undefined): AccessoryItem | null {
  if (!t?.trim()) return null
  const type = t.trim()
  return { id: `rehydrated-${type}`, sr_no: 0, type, price: null }
}

function buildValveFromManualLine(li: ManualLineItem): ValveProduct | null {
  const sp = li.selectedProduct
  if (!sp) return null
  const c = li.cascadeSelections || {}
  const name = (sp.name || '').trim()
  const parts = name.split(' — ').map((x) => x.trim())
  const type = parts[0] || name || 'Valve'
  const construction = (c.construction as string | undefined) ?? parts[1] ?? null
  const valve_size = (c.valve_size as string | undefined) ?? parts[2] ?? null

  const base = sp.base_price
  const basePrice = typeof base === 'number' && Number.isFinite(base) ? base : null

  const cat = (li.category || '').trim()
  const catalog_category = cat && cat !== 'unknown' ? cat : null

  return {
    id: typeof sp.id === 'string' ? sp.id : String(sp.id),
    type,
    catalog_category,
    variant_type: (c.variant_type as string | undefined) ?? null,
    construction,
    valve_size,
    bore_type: (c.bore_type as string | undefined) ?? null,
    end_connection: (c.end_connection as string | undefined) ?? null,
    pressure: (c.pressure as string | undefined) ?? null,
    body: (c.body as string | undefined) ?? null,
    ball_disc: (c.ball_disc as string | undefined) ?? (c.ball as string | undefined) ?? null,
    ball: (c.ball as string | undefined) ?? undefined,
    stem: (c.stem as string | undefined) ?? null,
    seat: (c.seat as string | undefined) ?? null,
    fasteners: (c.fasteners as string | undefined) ?? null,
    product_sheet: (c.product_sheet as string | undefined) ?? undefined,
    base_price: basePrice,
    has_price: basePrice != null,
  }
}

function operatorFromCascade(c: Record<string, string>): {
  operator_key: OperatorKey | null
  operator_model: OperatorModel | null
} {
  const label = (c.operator || '').trim()
  const operator_key = LABEL_TO_OPERATOR_KEY[label] ?? null
  if ((operator_key !== 'da' && operator_key !== 'sa') || !c.operator_model) {
    return { operator_key, operator_model: null }
  }
  return {
    operator_key,
    operator_model: {
      id: `rehydrated-op-${c.operator_model}`,
      model_name: c.operator_model,
      operator_type: operator_key,
      size: c.operator_size ?? null,
      base_price: null,
    },
  }
}

function bracketFromCascade(c: Record<string, string>): {
  include: boolean
  bracket: import('@/types').BracketCoupler | null
} {
  const raw = c.bracket_coupler || ''
  const m = raw.match(/Included\s*\(([^)]+)\)/i)
  if (!m) return { include: false, bracket: null }
  return {
    include: true,
    bracket: { id: 'rehydrated-bracket', size: m[1].trim(), price: null },
  }
}

/** Rebuild ``AssembledProduct[]`` from saved manual line items (for edit UI). */
export function manualLineItemsToAssembledProducts(items: ManualLineItem[]): AssembledProduct[] {
  return items.map((li) => {
    const c = (li.cascadeSelections || {}) as Record<string, string>
    const valve = buildValveFromManualLine(li)
    const { operator_key, operator_model } = operatorFromCascade(c)
    const { include, bracket } = bracketFromCascade(c)
    const qty = typeof li.quantity === 'number' && li.quantity > 0 ? li.quantity : 1
    const up = li.selectedProduct?.base_price
    const unit_price = typeof up === 'number' && Number.isFinite(up) ? up : null

    return {
      id: typeof li.id === 'string' && li.id ? li.id : uuidv4(),
      valve,
      operator_key,
      operator_model,
      supplier_id: c.supplier_id ?? null,
      supplier_name: c.supplier ?? null,
      sov: accessoryFromType(c.sov),
      limit_switch_box: accessoryFromType(c.limit_switch_box),
      positioner: accessoryFromType(c.positioner),
      bracket,
      include_bracket: include,
      quantity: qty,
      unit_price,
      has_unknown_prices: false,
      unknown_components: [],
      price_breakdown: [],
    }
  })
}

/** Read ``manual_line_items`` from enquiry ``raw_input`` JSON (manual dropdown + edits). */
export function parseManualLineItemsFromEnquiryRaw(raw_input: string | null | undefined): ManualLineItem[] | null {
  if (!raw_input?.trim()) return null
  try {
    const j = JSON.parse(raw_input) as { manual_line_items?: unknown }
    const arr = j.manual_line_items
    if (!Array.isArray(arr) || arr.length === 0) return null
    const out: ManualLineItem[] = []
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      if (!o.selectedProduct || typeof o.selectedProduct !== 'object') continue
      out.push(x as ManualLineItem)
    }
    return out.length ? out : null
  } catch {
    return null
  }
}

/** When no ``manual_line_items`` exist, build minimal manual rows from persisted quote lines. */
export function quotationLinesToFallbackManualItems(lines: QuotationLineItem[]): ManualLineItem[] {
  return lines.map((line, i) => {
    const name = (line.product_name || line.description || 'Product').toString()
    const ct = (line.catalog_table || '').toString().trim().toLowerCase()
    const cr = (line.catalog_row_id || '').toString().trim()
    const id = ct && cr ? `${ct}:${cr}` : `quote-line:${i}:${uuidv4()}`
    const qty = typeof line.quantity === 'number' && line.quantity > 0 ? line.quantity : 1
    const unit = (line.unit || 'Nos').toString() || 'Nos'
    const unit_price = typeof line.unit_price === 'number' ? line.unit_price : Number(line.unit_price) || 0

    return {
      id: uuidv4(),
      category: ((line.category || 'unknown') as string).toLowerCase(),
      cascadeSelections: {},
      selectedProduct: {
        id,
        name,
        size_inch: null,
        size_mm: null,
        material: (line.size || '').toString() || '',
        base_price: unit_price,
        unit,
        display_label: name,
      },
      quantity: qty,
    }
  })
}
