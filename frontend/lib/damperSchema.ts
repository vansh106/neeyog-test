/** Static matrix specification for Dampers family (mirrors backend damper_schema.py). */

import type { OperatorOption } from '@/types'

export const DAMPER_CATALOG_PREFIX = 'fp_damper_'

export const BUTTERFLY_DAMPER_KEY = 'fp_damper_butterfly'
export const MULTI_LOUVER_DAMPER_KEY = 'fp_damper_multi_louver'
export const SLIDE_GATE_DAMPER_KEY = 'fp_damper_slide_gate'
export const GUILLOTINE_DAMPER_KEY = 'fp_damper_guillotine'
export const DIVERTER_DAMPER_KEY = 'fp_damper_diverter'
export const DISCHARGE_DAMPER_KEY = 'fp_damper_discharge'

export const DAMPER_SHEET_KEYS = [
  BUTTERFLY_DAMPER_KEY,
  MULTI_LOUVER_DAMPER_KEY,
  SLIDE_GATE_DAMPER_KEY,
  GUILLOTINE_DAMPER_KEY,
  DIVERTER_DAMPER_KEY,
  DISCHARGE_DAMPER_KEY,
] as const

/** Field key for the damper sub-type selector (Diverter / Discharge sheets). */
export const DAMPER_TYPE_FIELD_KEY = 'damper_type'

const DIVERTER_TYPE_OPTIONS = [
  'T-Type Diverter Damper',
  'Y-Type Diverter Damper',
  'Poppet Type Diverter Damper',
]

const DISCHARGE_TYPE_OPTIONS = [
  'Single Flap Discharge Damper',
  'Double Flap Discharge Damper',
]

export type DamperInputType = 'select' | 'manual'

export type DamperFieldDef = {
  key: string
  label: string
  group?: string | null
  sub_label?: string | null
  input_type: DamperInputType
  options: string[]
  required: boolean
}

export type DamperFullSchema = {
  catalog_key: string
  damper_type: string
  label: string
  fields: DamperFieldDef[]
  has_catalog_price: boolean
}

const STRUCTURAL_MOC = [
  'IS 2062',
  'SS 304',
  'SS 316',
  'SS 304L',
  'SS 316L',
  'SA 516 GR.70',
  'SA 387',
  'SS 310',
  'SS 321',
]

const STRUCTURAL_THK_MM = ['1.5', '3', '4', '5', '6', '8', '10', '12', '16', '18', '20', '25']

const SHAFT_MOC = [
  'IS 2062',
  'SS 304',
  'SS 316',
  'SS 304L',
  'SS 316L',
  'SA 387',
  'SS 310',
  'SS 321',
  'SS 410',
  'EN 8',
  '17-4PH',
  'EN 19',
]

const SEALING_MOC = [
  'Silicon',
  'EPDM',
  'Nitrile',
  'Metal to Metal',
  'Ceramic Braided Rope',
  'Ceramic Flat',
]

const GLAND_PACKING_MOC = [
  'Ceramic Braided Rope',
  'Graphite Braided Rope',
  'PTFE',
  'Graphite',
]

const BEARING_OPTIONS = ['UCF', 'UCFL', 'Brass Bush', 'Ceramic Bush', 'N/A']
const FLANGE_GASKET_MOC = ['Silicon', 'EPDM', 'Nitrile', 'Ceramic Flat']
const FLANGE_HARDWARE_MOC = ['SS 304', 'SS 316', 'GR.8.8', 'GR.4.6']
const DUTY_OPTIONS = ['ON/OFF', 'Regulating', 'Inching']
const BLADE_COUNT_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 2))
const BLADE_ACTION_OPTIONS = ['Parallel Blade', 'Opposed Blade']

export function isDamperCatalogCategory(key: string | null | undefined): boolean {
  return !!key && key.startsWith(DAMPER_CATALOG_PREFIX)
}

export function damperSheetLabel(catalogKey: string): string {
  if (catalogKey === BUTTERFLY_DAMPER_KEY) return 'Butterfly Damper'
  if (catalogKey === MULTI_LOUVER_DAMPER_KEY) return 'Multi-Louver Damper'
  if (catalogKey === SLIDE_GATE_DAMPER_KEY) return 'Slide Gate Damper'
  if (catalogKey === GUILLOTINE_DAMPER_KEY) return 'Guillotine Damper'
  if (catalogKey === DIVERTER_DAMPER_KEY) return 'Diverter Damper'
  if (catalogKey === DISCHARGE_DAMPER_KEY) return 'Discharge Damper'
  return catalogKey.replace(/_/g, ' ')
}

/** Sub-type options shown in the "Damper Type" column (multi-variant sheets). */
export function damperTypeVariantOptions(catalogKey: string): string[] {
  if (catalogKey === DIVERTER_DAMPER_KEY) return DIVERTER_TYPE_OPTIONS
  if (catalogKey === DISCHARGE_DAMPER_KEY) return DISCHARGE_TYPE_OPTIONS
  return []
}

/** Values rendered in the matrix "Damper Type" cell (variants, or the sheet label). */
export function damperTypeOptions(catalogKey: string): string[] {
  const variants = damperTypeVariantOptions(catalogKey)
  return variants.length > 0 ? variants : [damperSheetLabel(catalogKey)]
}

function field(
  key: string,
  label: string,
  opts: {
    group?: string
    sub_label?: string
    input_type?: DamperInputType
    options?: string[]
    required?: boolean
  } = {},
): DamperFieldDef {
  const input_type = opts.input_type ?? 'select'
  return {
    key,
    label,
    group: opts.group ?? null,
    sub_label: opts.sub_label ?? null,
    input_type,
    options: opts.options ?? [],
    required: opts.required ?? input_type === 'select',
  }
}

function structuralPair(prefix: string, group: string): DamperFieldDef[] {
  return [
    field(`${prefix}_moc`, group, { group, sub_label: 'MOC', options: STRUCTURAL_MOC }),
    field(`${prefix}_thk_mm`, group, { group, sub_label: 'Thk.', options: STRUCTURAL_THK_MM }),
  ]
}

function sharedBodyFields(): DamperFieldDef[] {
  return [
    ...structuralPair('housing', 'Housing'),
    ...structuralPair('flange', 'Flange'),
    ...structuralPair('flap', 'Flap'),
    field('shaft_moc', 'Shaft', { group: 'Shaft', sub_label: 'MOC', options: SHAFT_MOC }),
    field('shaft_dia', 'Shaft', { group: 'Shaft', sub_label: 'Dia.', input_type: 'manual', required: false }),
    ...structuralPair('brackets', 'Brackets'),
    field('sealing_moc', 'Sealing', { group: 'Sealing', sub_label: 'MOC', options: SEALING_MOC }),
    field('gland_packing_moc', 'Gland Packing', {
      group: 'Gland Packing',
      sub_label: 'MOC',
      options: GLAND_PACKING_MOC,
    }),
    field('bearing', 'Bearing', { options: BEARING_OPTIONS }),
    field('flange_gasket_moc', 'Flange Gasket', {
      group: 'Flange Gasket',
      sub_label: 'MOC',
      options: FLANGE_GASKET_MOC,
    }),
    field('flange_hardware_moc', 'Flange Hardware', {
      group: 'Flange Hardware',
      sub_label: 'MOC',
      options: FLANGE_HARDWARE_MOC,
    }),
    field('duty', 'Duty', { options: DUTY_OPTIONS }),
    field('note', 'Note', { input_type: 'manual', required: false }),
  ]
}

export function damperFieldsForKey(catalogKey: string): DamperFieldDef[] {
  if (catalogKey === BUTTERFLY_DAMPER_KEY) {
    return [field('size', 'Size', { input_type: 'manual', required: false }), ...sharedBodyFields()]
  }
  if (catalogKey === MULTI_LOUVER_DAMPER_KEY) {
    return [
      field('size', 'Size', { input_type: 'manual', required: false }),
      field('number_of_blades', 'Number of Blades', { options: BLADE_COUNT_OPTIONS }),
      field('blade_action', 'Blade Action', { options: BLADE_ACTION_OPTIONS }),
      ...sharedBodyFields(),
    ]
  }
  if (catalogKey === SLIDE_GATE_DAMPER_KEY || catalogKey === GUILLOTINE_DAMPER_KEY) {
    return [field('size', 'Size', { input_type: 'manual', required: false }), ...sharedBodyFields()]
  }
  const variants = damperTypeVariantOptions(catalogKey)
  if (variants.length > 0) {
    return [
      field(DAMPER_TYPE_FIELD_KEY, 'Damper Type', { options: variants }),
      field('size', 'Size', { input_type: 'manual', required: false }),
      ...sharedBodyFields(),
    ]
  }
  return []
}

export function getDamperFullSchema(catalogKey: string): DamperFullSchema {
  return {
    catalog_key: catalogKey,
    damper_type: damperSheetLabel(catalogKey),
    label: damperSheetLabel(catalogKey),
    fields: damperFieldsForKey(catalogKey),
    has_catalog_price: false,
  }
}

/** Damper-only operator cards (appended to standard valve operator list). */
export const DAMPER_ONLY_OPERATOR_OPTIONS: OperatorOption[] = [
  {
    key: 'pneumatic_rack_pinion',
    label: 'Pneumatic Rack and Pinion Actuator',
    description: 'Pneumatic rack and pinion — price on request',
    has_price: false,
    price: null,
    unlocks_accessories: true,
  },
  {
    key: 'pneumatic_cylinder',
    label: 'Pneumatic Cylinder',
    description: 'Pneumatic cylinder — price on request',
    has_price: false,
    price: null,
    unlocks_accessories: true,
  },
]

export function mergeDamperOperatorOptions(
  options: OperatorOption[],
  catalogKey: string | null | undefined,
): OperatorOption[] {
  if (!isDamperCatalogCategory(catalogKey)) return options
  if (options.some((o) => o.key === 'pneumatic_rack_pinion')) return options
  return [...options, ...DAMPER_ONLY_OPERATOR_OPTIONS]
}

export function listDamperSheets(): { key: string; label: string }[] {
  return [
    { key: BUTTERFLY_DAMPER_KEY, label: 'Butterfly Damper' },
    { key: MULTI_LOUVER_DAMPER_KEY, label: 'Multi-Louver Damper' },
    { key: SLIDE_GATE_DAMPER_KEY, label: 'Slide Gate Damper' },
    { key: GUILLOTINE_DAMPER_KEY, label: 'Guillotine Damper' },
    { key: DIVERTER_DAMPER_KEY, label: 'Diverter Damper' },
    { key: DISCHARGE_DAMPER_KEY, label: 'Discharge Damper' },
  ]
}

/** All required select fields have a value. */
export function damperSpecsComplete(
  catalogKey: string,
  fieldValues: Record<string, string>,
): boolean {
  return damperFieldsForKey(catalogKey)
    .filter((f) => f.input_type === 'select' && f.required)
    .every((f) => String(fieldValues[f.key] ?? '').trim() !== '')
}

export function damperDisplayTitle(catalogKey: string, fieldValues: Record<string, string>): string {
  const variant = fieldValues[DAMPER_TYPE_FIELD_KEY]?.trim()
  const parts = [variant || damperSheetLabel(catalogKey)]
  const size = fieldValues.size?.trim()
  if (size) parts.push(size)
  return parts.join(' — ')
}

/** Group fields for matrix masters display (column → sub-columns). */
export type DamperMatrixColumn = {
  title: string
  subColumns: { key: string; subLabel: string; options: string[]; isManual: boolean }[]
}

export function damperMatrixColumns(catalogKey: string): DamperMatrixColumn[] {
  // The sub-type selector is rendered in the fixed "Damper Type" column, so it
  // is excluded from the dynamic matrix columns to avoid a duplicate header.
  const fields = damperFieldsForKey(catalogKey).filter((f) => f.key !== DAMPER_TYPE_FIELD_KEY)
  const columns: DamperMatrixColumn[] = []
  const groupOrder: string[] = []
  const byGroup = new Map<string, DamperFieldDef[]>()

  for (const f of fields) {
    const g = f.group ?? f.label
    if (!byGroup.has(g)) {
      byGroup.set(g, [])
      groupOrder.push(g)
    }
    byGroup.get(g)!.push(f)
  }

  for (const title of groupOrder) {
    const groupFields = byGroup.get(title)!
    columns.push({
      title,
      subColumns: groupFields.map((f) => ({
        key: f.key,
        subLabel: f.sub_label ?? (f.input_type === 'manual' ? 'ME' : ''),
        options: f.input_type === 'manual' ? ['ME'] : f.options,
        isManual: f.input_type === 'manual',
      })),
    })
  }
  return columns
}
