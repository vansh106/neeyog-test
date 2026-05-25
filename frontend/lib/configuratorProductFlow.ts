/** Manual configurator: hose → fitting add-on flow (step 1 excludes fittings). */

import {
  flattenMasterNavLeaves,
  findMasterNavPathForKey,
  MASTER_SIDEBAR_NAV,
  type MasterNavGroup,
  type MasterNavNode,
} from '@/lib/masterSidebarNav'

/** Step-1 manual picker: Valves and Hoses only (no fittings / accessories). */
export const CONFIGURATOR_STEP1_PRODUCT_NAV: MasterNavNode[] = MASTER_SIDEBAR_NAV.filter(
  (n): n is MasterNavGroup => n.kind === 'group' && (n.label === 'Valves' || n.label === 'Hoses'),
)

export const CONFIGURATOR_STEP1_CATEGORY_KEYS = new Set(
  flattenMasterNavLeaves(CONFIGURATOR_STEP1_PRODUCT_NAV).map((l) => l.key),
)

export function configuratorLeafLabel(key: string): string {
  return (
    flattenMasterNavLeaves(CONFIGURATOR_STEP1_PRODUCT_NAV).find((l) => l.key === key)?.label ?? key
  )
}

export function configuratorProductFamilyForKey(
  key: string | null | undefined,
): 'Valves' | 'Hoses' | null {
  if (!key) return null
  const path = findMasterNavPathForKey(key, CONFIGURATOR_STEP1_PRODUCT_NAV)
  const root = path?.[0]
  if (root === 'Valves' || root === 'Hoses') return root
  return key.startsWith('fp_hose_') ? 'Hoses' : 'Valves'
}

export function isHoseCatalogCategory(key: string | null | undefined): boolean {
  return configuratorProductFamilyForKey(key) === 'Hoses'
}

export const HOSE_CATEGORIES_WITH_FITTINGS = new Set([
  'fp_hose_tuder',
  'fp_hose_thunder',
  'fp_hose_pvc_nylon_non_toxic',
  'fp_hose_pvc_nylon_food_grade',
])

export const FITTING_CATALOG_OPTIONS: { key: string; label: string }[] = [
  { key: 'fp_fittings_sms_nut', label: 'SMS nut' },
  { key: 'fp_fittings_tri_clover_end', label: 'Tri-Clover end' },
  { key: 'fp_fittings_din_nut_11851', label: 'DIN nut 11851' },
  { key: 'fp_fittings_swivel_nut', label: 'Swivel nut' },
  { key: 'fp_fittings_flange_150', label: 'Flange #150' },
]

export function hoseRequiresFittings(catalogCategory: string | null | undefined): boolean {
  return !!catalogCategory && HOSE_CATEGORIES_WITH_FITTINGS.has(catalogCategory)
}

export function isFittingCatalogCategory(key: string | null | undefined): boolean {
  return !!key && key.startsWith('fp_fittings_')
}
