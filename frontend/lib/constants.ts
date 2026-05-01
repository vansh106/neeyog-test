/** Catalog spec fields for supplier pricelist column mapping (keys = DB column names). */

export type CatalogSpecField = { key: string; label: string }

export const CATALOG_SPEC_FIELDS: Record<string, CatalogSpecField[]> = {
  butterfly_valve: [
    { key: 'construction', label: 'Construction' },
    { key: 'valve_size', label: 'Valve Size' },
    { key: 'bore_type', label: 'Bore Type' },
    { key: 'end_connection', label: 'End Connection' },
    { key: 'pressure', label: 'Pressure' },
    { key: 'body', label: 'Body' },
    { key: 'ball_disc', label: 'Ball / Disc' },
    { key: 'stem', label: 'Stem' },
    { key: 'seat', label: 'Seat' },
    { key: 'fasteners', label: 'Fasteners' },
    { key: 'price', label: 'Price (₹)' },
    { key: 'discount_override', label: 'Discount Override (%)' },
    { key: '__skip__', label: '(Skip this column)' },
  ],
  ball_valve: [
    { key: 'construction', label: 'Construction' },
    { key: 'valve_size', label: 'Valve Size' },
    { key: 'bore_type', label: 'Bore Type' },
    { key: 'end_connection', label: 'End Connection' },
    { key: 'pressure', label: 'Pressure' },
    { key: 'body', label: 'Body' },
    { key: 'ball', label: 'Ball' },
    { key: 'stem', label: 'Stem' },
    { key: 'seat', label: 'Seat' },
    { key: 'fasteners', label: 'Fasteners' },
    { key: 'price', label: 'Price (₹)' },
    { key: 'discount_override', label: 'Discount Override (%)' },
    { key: '__skip__', label: '(Skip this column)' },
  ],
  operator: [
    { key: 'operator_for', label: 'Operator For (Valve Type)' },
    { key: 'construct', label: 'Construct (2 Way / 3 Way)' },
    { key: 'size_text', label: 'Size' },
    { key: 'model_name', label: 'Model Name' },
    { key: 'price', label: 'Price (₹)' },
    { key: 'discount_override', label: 'Discount Override (%)' },
    { key: '__skip__', label: '(Skip this column)' },
  ],
  sov: [
    { key: 'variant_type', label: 'Type / Description' },
    { key: 'price', label: 'Price (₹)' },
    { key: 'discount_override', label: 'Discount Override (%)' },
    { key: '__skip__', label: '(Skip this column)' },
  ],
  limit_switch_box: [
    { key: 'variant_type', label: 'Type / Description' },
    { key: 'price', label: 'Price (₹)' },
    { key: 'discount_override', label: 'Discount Override (%)' },
    { key: '__skip__', label: '(Skip this column)' },
  ],
  positioner: [
    { key: 'variant_type', label: 'Type / Description' },
    { key: 'price', label: 'Price (₹)' },
    { key: 'discount_override', label: 'Discount Override (%)' },
    { key: '__skip__', label: '(Skip this column)' },
  ],
  brackets_coupler: [
    { key: 'bracket_operator', label: 'Operator Type' },
    { key: 'construct', label: 'Construct' },
    { key: 'size_text', label: 'Size' },
    { key: 'price', label: 'Price (₹)' },
    { key: 'discount_override', label: 'Discount Override (%)' },
    { key: '__skip__', label: '(Skip this column)' },
  ],
}

/** Generic pricelist column mapping for ``fp_*`` final-product tables. */
const FP_CATALOG_GENERIC: CatalogSpecField[] = [
  { key: 'variant_type', label: 'Variant / Type' },
  { key: 'construction', label: 'Construction' },
  { key: 'valve_size', label: 'Valve size' },
  { key: 'end_connection', label: 'End connection' },
  { key: 'pressure', label: 'Pressure' },
  { key: 'bore_type', label: 'Bore type' },
  { key: 'body', label: 'Body' },
  { key: 'bonnet', label: 'Bonnet' },
  { key: 'stem', label: 'Stem' },
  { key: 'seat', label: 'Seat' },
  { key: 'ball', label: 'Ball' },
  { key: 'ball_disc', label: 'Disc' },
  { key: 'diaphragm', label: 'Diaphragm' },
  { key: 'tc_od', label: 'TC OD' },
  { key: 'pipe_od', label: 'Pipe OD' },
  { key: 'wheel_moc', label: 'Wheel MOC' },
  { key: 'actuator_moc', label: 'Actuator MOC' },
  { key: 'set_pressure', label: 'Set pressure' },
  { key: 'inlet_pressure', label: 'Inlet pressure' },
  { key: 'set_pressure_range', label: 'Set pressure range' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'seating', label: 'Seating' },
  { key: 'fasteners', label: 'Fasteners' },
  { key: 'product_sheet', label: 'Product sheet (flush)' },
  { key: 'price', label: 'Price (₹)' },
  { key: 'discount_override', label: 'Discount Override (%)' },
  { key: '__skip__', label: '(Skip this column)' },
]

export function catalogSpecFieldsFor(category: string): CatalogSpecField[] {
  const direct = CATALOG_SPEC_FIELDS[category as keyof typeof CATALOG_SPEC_FIELDS]
  if (direct) return direct
  if (category.startsWith('fp_')) return FP_CATALOG_GENERIC
  return CATALOG_SPEC_FIELDS.operator
}

/** Normalize Excel header → suggested our field key. */
export const SMART_COLUMN_MAP: Record<string, string> = {
  price: 'price',
  rate: 'price',
  mrp: 'price',
  'list price': 'price',
  list_price: 'price',
  'price (rs)': 'price',
  'price (inr)': 'price',
  'price inr': 'price',
  'base price': 'price',
  discount: 'discount_override',
  'disc%': 'discount_override',
  'discount%': 'discount_override',
  'discount override': 'discount_override',
  model: 'model_name',
  'model no': 'model_name',
  'model name': 'model_name',
  'model number': 'model_name',
  size: 'size_text',
  'pipe size': 'size_text',
  'valve size': 'valve_size',
  type: 'variant_type',
  description: 'variant_type',
  product: 'variant_type',
  body: 'body',
  seat: 'seat',
  stem: 'stem',
  construction: 'construction',
  bore: 'bore_type',
  connection: 'end_connection',
  pressure: 'pressure',
  fasteners: 'fasteners',
  ball: 'ball',
  'ball/disc': 'ball_disc',
  'operator for': 'operator_for',
  construct: 'construct',
  'bracket operator': 'bracket_operator',
}

export function smartMapExcelHeader(header: string): string | null {
  const k = header.trim().toLowerCase()
  return SMART_COLUMN_MAP[k] ?? null
}
