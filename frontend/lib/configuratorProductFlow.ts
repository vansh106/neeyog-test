/** Manual configurator: hose → fitting add-on flow (step 1 excludes fittings). */

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
