/** Manual configurator: hose → fitting add-on flow (step 1 excludes fittings). */

import { isDamperCatalogCategory, damperSheetLabel } from '@/lib/damperSchema'
import {
  flattenMasterNavLeaves,
  findMasterNavPathForKey,
  MASTER_SIDEBAR_NAV,
  type MasterNavGroup,
  type MasterNavLeaf,
  type MasterNavNode,
} from '@/lib/masterSidebarNav'

/** Manual step-1 catalog selection (mirrors masters sidebar leaf). */
export type ConfiguratorCatalogPick = {
  key: string
  label: string
  variantType?: string
  navSlug?: string
}

export function configuratorPickFromLeaf(leaf: MasterNavLeaf): ConfiguratorCatalogPick {
  return {
    key: leaf.key,
    label: leaf.label,
    variantType: leaf.variantType,
    navSlug: leaf.navSlug,
  }
}

export type ConfiguratorProductFamily = 'Valves' | 'Hoses' | 'Dampers' | 'Packaging' | 'Others'

export type ConfiguratorNavProductFamily = Exclude<ConfiguratorProductFamily, 'Others'>

/** Step-1 manual picker — only top-level groups present in masters nav (no fittings / accessories). */
export const CONFIGURATOR_STEP1_PRODUCT_NAV: MasterNavNode[] = MASTER_SIDEBAR_NAV.filter(
  (n): n is MasterNavGroup => n.kind === 'group',
)

/** Families shown in manual enquiry step 1 — derived from nav, not hardcoded. */
export const CONFIGURATOR_PRODUCT_FAMILIES: ConfiguratorProductFamily[] =
  CONFIGURATOR_STEP1_PRODUCT_NAV.map((n) => n.label as ConfiguratorProductFamily)

export function isConfiguratorNavFamily(
  family: ConfiguratorProductFamily | null | undefined,
): family is ConfiguratorNavProductFamily {
  return !!family && family !== 'Others'
}

export const CONFIGURATOR_STEP1_CATEGORY_KEYS = new Set(
  flattenMasterNavLeaves(CONFIGURATOR_STEP1_PRODUCT_NAV).map((l) => l.key),
)

export function configuratorLeafLabel(
  key: string,
  opts?: { navSlug?: string | null; variantType?: string | null; displayLabel?: string | null },
): string {
  if (isOthersCatalogCategory(key) && opts?.displayLabel) return opts.displayLabel
  if (isDamperCatalogCategory(key)) return damperSheetLabel(key)
  const fitting = FITTING_CATALOG_OPTIONS.find((c) => c.key === key)
  if (fitting) return fitting.label
  const leaves = flattenMasterNavLeaves(CONFIGURATOR_STEP1_PRODUCT_NAV)
  if (opts?.navSlug) {
    const bySlug = leaves.find((l) => l.navSlug === opts.navSlug)
    if (bySlug) return bySlug.label
  }
  if (opts?.variantType) {
    const byVt = leaves.find(
      (l) => l.key === key && l.variantType === opts.variantType && !l.navSlug,
    )
    if (byVt) return byVt.label
  }
  return leaves.find((l) => l.key === key)?.label ?? key
}

export function findConfiguratorNavLeaf(
  key: string,
  opts?: { navSlug?: string | null; variantType?: string | null },
): MasterNavLeaf | null {
  const leaves = flattenMasterNavLeaves(CONFIGURATOR_STEP1_PRODUCT_NAV)
  if (opts?.navSlug) {
    const bySlug = leaves.find((l) => l.navSlug === opts.navSlug)
    if (bySlug) return bySlug
  }
  if (opts?.variantType) {
    const byVt = leaves.find(
      (l) => l.key === key && l.variantType === opts.variantType && !l.navSlug,
    )
    if (byVt) return byVt
  }
  return leaves.find((l) => l.key === key) ?? null
}

export const OTHERS_CATALOG_PREFIX = 'others_'

export function isOthersCatalogCategory(key: string | null | undefined): boolean {
  return !!key && key.startsWith(OTHERS_CATALOG_PREFIX)
}

export function configuratorProductFamilyForKey(
  key: string | null | undefined,
): ConfiguratorProductFamily | null {
  if (!key) return null
  if (isOthersCatalogCategory(key)) return 'Others'
  if (isDamperCatalogCategory(key)) return 'Dampers'
  if (key === 'fp_aluminium_foil') return 'Packaging'
  if (key === 'fp_paper_products') return 'Packaging'
  const path = findMasterNavPathForKey(key, CONFIGURATOR_STEP1_PRODUCT_NAV)
  const root = path?.[0]
  if (root === 'Valves' || root === 'Hoses' || root === 'Dampers' || root === 'Packaging') return root
  return key.startsWith('fp_hose_') ? 'Hoses' : 'Valves'
}

export function isHoseCatalogCategory(key: string | null | undefined): boolean {
  return configuratorProductFamilyForKey(key) === 'Hoses'
}

/** Butterfly / ball valve sheets and dampers use operator + accessories flow. */
export function supportsOperatorAccessoryFlowCategory(key: string | null | undefined): boolean {
  if (!key || isTemporaryCatalogCategory(key)) return false
  if (isDamperCatalogCategory(key)) return true
  if (key === 'butterfly_valve') return true
  if (key.startsWith('fp_ball_valve_')) return true
  const path = findMasterNavPathForKey(key, CONFIGURATOR_STEP1_PRODUCT_NAV)
  return path?.includes('Ball Valve') ?? false
}

/** Valve type label for ``/api/configurator/operators`` (operator_for filter). */
export function operatorValveTypeForCategory(
  catalogCategory: string | null | undefined,
  displayType?: string | null,
): string {
  if (!catalogCategory) return displayType?.trim() || 'Valve'
  if (isDamperCatalogCategory(catalogCategory)) return 'Damper'
  if (catalogCategory === 'butterfly_valve') return 'Butterfly Valve'
  if (catalogCategory.startsWith('fp_ball_valve_')) return 'Ball Valve'
  const path = findMasterNavPathForKey(catalogCategory, CONFIGURATOR_STEP1_PRODUCT_NAV)
  if (path?.includes('Ball Valve')) return 'Ball Valve'
  return displayType?.trim() || 'Valve'
}

export const HOSE_CATEGORIES_WITH_FITTINGS = new Set([
  'fp_hose_tuder',
  'fp_hose_thunder',
  'fp_hose_pvc_nylon_non_toxic',
  'fp_hose_pvc_nylon_food_grade',
])

/** Sentinel — hose end with no fitting (manual upload only). */
export const BARE_FITTING_CATALOG_KEY = '__bare_fitting__'

/** Sentinel — free-text hose fitting not in catalog (manual upload step 2). */
export const TEMPORARY_FITTING_CATALOG_KEY = '__temporary_fitting__'

/** Sentinel — free-text product not in catalog (manual upload only). */
export const TEMPORARY_PRODUCT_CATALOG_KEY = '__temporary_product__'

export function isTemporaryCatalogCategory(key: string | null | undefined): boolean {
  return key === TEMPORARY_PRODUCT_CATALOG_KEY
}

export const FITTING_CATALOG_OPTIONS: { key: string; label: string }[] = [
  { key: 'fp_fittings_sms_nut', label: 'SMS nut' },
  { key: 'fp_fittings_tri_clover_end', label: 'Tri-Clover end' },
  { key: 'fp_fittings_din_nut_11851', label: 'DIN nut 11851' },
  { key: 'fp_fittings_swivel_nut', label: 'Swivel nut' },
  { key: 'fp_fittings_flange_150', label: 'Flange #150' },
]

export function isBareFittingSelection(catalogCategory: string | null | undefined): boolean {
  return catalogCategory === BARE_FITTING_CATALOG_KEY
}

export function isTemporaryFittingSelection(catalogCategory: string | null | undefined): boolean {
  return catalogCategory === TEMPORARY_FITTING_CATALOG_KEY
}

export function hoseRequiresFittings(catalogCategory: string | null | undefined): boolean {
  return !!catalogCategory && HOSE_CATEGORIES_WITH_FITTINGS.has(catalogCategory)
}

export function isFittingCatalogCategory(key: string | null | undefined): boolean {
  return !!key && key.startsWith('fp_fittings_')
}

/** Masters columns for hose ends — not user cascade picks in manual upload. */
export const HOSE_FITTING_CASCADE_EXCLUDE = new Set(['end_connection_1', 'end_connection_2'])

export function filterFittingCascadeSteps(steps: { key: string; label: string }[]): {
  key: string
  label: string
}[] {
  return steps.filter((s) => !HOSE_FITTING_CASCADE_EXCLUDE.has(s.key))
}

export function hoseFittingsSelectionComplete(
  end1Specs: { catalog_category?: string | null } | null | undefined,
  end1Resolved: unknown,
  end2Specs: { catalog_category?: string | null } | null | undefined,
  end2Resolved: unknown,
  end1Qty: 1 | 2,
): boolean {
  const end1Done =
    isBareFittingSelection(end1Specs?.catalog_category ?? null) || !!end1Resolved
  if (!end1Done) return false
  if (end1Qty === 2) return true
  const end2Done =
    isBareFittingSelection(end2Specs?.catalog_category ?? null) || !!end2Resolved
  return end2Done
}

export function fittingCategoryLabel(catalogCategory: string | null | undefined): string {
  if (!catalogCategory) return ''
  if (isBareFittingSelection(catalogCategory)) return 'Bare fitting'
  if (isTemporaryFittingSelection(catalogCategory)) return 'Temporary fitting'
  return (
    FITTING_CATALOG_OPTIONS.find((c) => c.key === catalogCategory)?.label ?? catalogCategory
  )
}

/** Parth hose inch → hose fitting size (mm). Used when hose ``size_id_mm`` is in inches. */
export const HOSE_INCH_TO_FITTING_MM: Readonly<Record<number, number>> = {
  0.5: 13,
  0.625: 16, // 5/8"
  0.75: 19,
  1: 25,
  1.25: 32,
  1.5: 38,
  2: 51,
  2.5: 63.5,
  3: 76,
  4: 102,
}

const HOSE_INCH_EPS = 0.001

/** Normalize hose/fitting size labels for comparison (e.g. ``25mm`` → ``25 mm``). */
export function normalizeSizeMmLabel(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const t = raw.trim().replace(/\s+/g, ' ')
  const m = t.match(/^(\d+(?:\.\d+)?)\s*mm?$/i)
  if (m) return `${m[1]} mm`
  return t
}

/** Parse inch size from hose ``size_id_mm`` when stored as fractions/decimals (e.g. ``3/4``, ``1 1/2"``). */
export function parseHoseInchSize(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null
  let s = raw.trim().replace(/[""″]/g, '"').replace(/\s+/g, ' ')
  if (/\bmm\b/i.test(s)) return null

  s = s.replace(/\s*(inch|inches|in)\.?$/i, '').trim()
  s = s.replace(/"$/, '').trim()

  let m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/i)
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3])

  m = s.match(/^(\d+)\s*\/\s*(\d+)$/i)
  if (m) return Number(m[1]) / Number(m[2])

  m = s.match(/^(\d+(?:\.\d+)?)$/i)
  if (m) return Number(m[1])

  return null
}

export function hoseInchToFittingMm(inch: number): number | null {
  if (!Number.isFinite(inch)) return null
  for (const [inchKey, mm] of Object.entries(HOSE_INCH_TO_FITTING_MM)) {
    if (Math.abs(inch - Number(inchKey)) < HOSE_INCH_EPS) return mm
  }
  return null
}

function parseSizeMmNumber(valveSize: string | null | undefined): number | null {
  if (!valveSize) return null
  const mDn = valveSize.match(/DN\s*(\d+(?:\.\d+)?)/i)
  if (mDn) return Number(mDn[1])
  const mMm = valveSize.match(/(\d+(?:\.\d+)?)\s*MM/i)
  if (mMm) return Number(mMm[1])
  const plain = valveSize.match(/^(\d+(?:\.\d+)?)$/)
  if (plain) return Number(plain[1])
  return null
}

function mmValuesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01
}

function fittingOptionForTargetMm(targetMm: number, fittingOptions: string[]): string | null {
  const targetLabel = `${targetMm} mm`
  const exact = fittingOptions.find(
    (o) => normalizeSizeMmLabel(o)?.toLowerCase() === targetLabel.toLowerCase(),
  )
  if (exact) return exact

  for (const opt of fittingOptions) {
    const optNum = parseSizeMmNumber(opt)
    if (optNum != null && mmValuesEqual(optNum, targetMm)) return opt
  }
  return null
}

/** Resolve hose size label to a fitting ``size_mm`` target in mm, if known. */
export function hoseSizeToFittingTargetMm(hoseSizeIdMm: string | null | undefined): number | null {
  const hoseNorm = normalizeSizeMmLabel(hoseSizeIdMm)
  if (!hoseNorm) return null

  const hasMmSuffix = /\bmm\b/i.test(hoseSizeIdMm ?? '') || /mm$/i.test(hoseNorm)
  if (hasMmSuffix) return parseSizeMmNumber(hoseNorm)

  const inch = parseHoseInchSize(hoseSizeIdMm)
  if (inch != null) {
    const fromInch = hoseInchToFittingMm(inch)
    if (fromInch != null) return fromInch
  }

  const hoseNum = parseSizeMmNumber(hoseNorm)
  if (hoseNum != null && !hoseNorm.includes('/')) return hoseNum

  return null
}

/** Pick fittings ``size_mm`` option that matches the selected hose ``size_id_mm``, if any. */
export function matchHoseSizeToFittingOption(
  hoseSizeIdMm: string | null | undefined,
  fittingOptions: string[],
): string | null {
  const hoseNorm = normalizeSizeMmLabel(hoseSizeIdMm)
  if (!hoseNorm || fittingOptions.length === 0) return null

  const hoseLower = hoseNorm.toLowerCase()
  const exact = fittingOptions.find((o) => o.trim().toLowerCase() === hoseLower)
  if (exact) return exact

  const targetMm = hoseSizeToFittingTargetMm(hoseSizeIdMm)
  if (targetMm != null) {
    const byMm = fittingOptionForTargetMm(targetMm, fittingOptions)
    if (byMm) return byMm
  }

  const hoseNum = parseSizeMmNumber(hoseNorm)
  if (hoseNum == null) return null
  for (const opt of fittingOptions) {
    const optNum = parseSizeMmNumber(opt)
    if (optNum != null && mmValuesEqual(optNum, hoseNum)) return opt
  }
  return null
}

/** When hose size maps to a fittings ``size_mm`` option, keep only that option in the dropdown. */
export function filterFittingSizeOptionsForHoseMatch(
  hoseSizeIdMm: string | null | undefined,
  fittingOptions: string[],
): string[] {
  if (!hoseSizeIdMm?.trim() || fittingOptions.length === 0) return fittingOptions
  const matched = matchHoseSizeToFittingOption(hoseSizeIdMm, fittingOptions)
  return matched ? [matched] : fittingOptions
}

export const HOSE_FITTING_SIZE_FIELD = 'size_mm'
export const HOSE_SIZE_FIELD = 'size_id_mm'
