/** Main listing families shown in category filters (aligned with enquiry / quote / PO listings). */
export const LISTING_MAIN_FAMILIES = ['Dampers', 'Hoses', 'Others', 'Valves'] as const

export type ListingMainFamily = (typeof LISTING_MAIN_FAMILIES)[number]

/** Preset sub-categories per main family (from masters_listing_labels.json). */
export const PRESET_SUB_CATEGORIES_BY_FAMILY: Record<ListingMainFamily, readonly string[]> = {
  Valves: [
    'Angle Type Valve',
    'Ball Valve',
    'Butterfly Valve',
    'Diaphragm Valve',
    'Flush Bottom Valve',
    'Needle Valve',
    'Non Return Valve / Check Valve',
    'Pressure Reducing Valve',
    'Safety / Pressure Relief Valve',
    'Sampling Valve',
    'Sight Glass',
    'Strainer',
    'Zero Dead Leg Valve',
  ],
  Hoses: [
    'DIN Nut 11851',
    'Flange #150',
    'PVC Hoses',
    'SMS Nut',
    'Swivel Nut',
    'Tri-Clover End',
    'Tuder Hoses',
  ],
  Dampers: ['Butterfly Damper', 'Multi-Louver Damper'],
  Others: ['Actuator', 'Brackets & couplers', 'Limit Switch Box', 'Positioner', 'SOV'],
}

const MAIN_FAMILY_ALIASES: Record<string, ListingMainFamily> = {
  valve: 'Valves',
  valves: 'Valves',
  hose: 'Hoses',
  hoses: 'Hoses',
  fitting: 'Hoses',
  fittings: 'Hoses',
  'hose fitting': 'Hoses',
  'hose fittings': 'Hoses',
  damper: 'Dampers',
  dampers: 'Dampers',
  accessory: 'Others',
  accessories: 'Others',
  other: 'Others',
  others: 'Others',
}

/** Legacy listing labels that are not main families but appear as row category. */
const LEGACY_ROW_CATEGORY_TO_FAMILY: Record<string, ListingMainFamily> = {
  'hose fittings': 'Hoses',
  accessories: 'Others',
}

const SUB_CATEGORY_TO_FAMILY = new Map<string, ListingMainFamily>()
for (const [family, subs] of Object.entries(PRESET_SUB_CATEGORIES_BY_FAMILY) as Array<
  [ListingMainFamily, readonly string[]]
>) {
  for (const sub of subs) {
    SUB_CATEGORY_TO_FAMILY.set(sub.toLowerCase(), family)
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
}

function isMainFamily(value: string): value is ListingMainFamily {
  return (LISTING_MAIN_FAMILIES as readonly string[]).includes(value)
}

export function normalizeListingMainCategory(value: string | null | undefined): ListingMainFamily | null {
  const raw = (value || '').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()

  if (MAIN_FAMILY_ALIASES[lower]) return MAIN_FAMILY_ALIASES[lower]
  if (LEGACY_ROW_CATEGORY_TO_FAMILY[lower]) return LEGACY_ROW_CATEGORY_TO_FAMILY[lower]

  const mainMatch = LISTING_MAIN_FAMILIES.find((f) => f.toLowerCase() === lower)
  if (mainMatch) return mainMatch

  const fromSub = SUB_CATEGORY_TO_FAMILY.get(lower)
  if (fromSub) return fromSub

  return 'Others'
}

/** Resolve a listing row's category + sub-category into filter main family + sub label. */
export function resolveListingCategoryPair(
  category: string | null | undefined,
  subCategory: string | null | undefined,
): { main: ListingMainFamily | null; sub: string | null } {
  const catRaw = (category || '').trim()
  const subRaw = (subCategory || '').trim()

  if (!catRaw && !subRaw) return { main: null, sub: null }

  if (catRaw) {
    const lower = catRaw.toLowerCase()
    const legacyFamily = LEGACY_ROW_CATEGORY_TO_FAMILY[lower]
    if (legacyFamily) {
      return { main: legacyFamily, sub: subRaw || null }
    }

    const subAsFamily = SUB_CATEGORY_TO_FAMILY.get(lower)
    if (subAsFamily) {
      return { main: subAsFamily, sub: catRaw }
    }

    const main = normalizeListingMainCategory(catRaw)
    if (main) {
      return { main, sub: subRaw || null }
    }
  }

  if (subRaw) {
    const main = SUB_CATEGORY_TO_FAMILY.get(subRaw.toLowerCase()) ?? 'Others'
    return { main, sub: subRaw }
  }

  return { main: 'Others', sub: catRaw || null }
}

export function listingMainCategoryOptions(
  subCategoriesByCategory: Record<string, string[]>,
): string[] {
  const withData = new Set(
    Object.entries(subCategoriesByCategory)
      .filter(([, subs]) => subs.length > 0)
      .map(([main]) => normalizeListingMainCategory(main))
      .filter((m): m is ListingMainFamily => m != null),
  )
  if (withData.size === 0) return [...LISTING_MAIN_FAMILIES]
  return LISTING_MAIN_FAMILIES.filter((f) => withData.has(f))
}

export function listingSubCategoryOptionsForCategory(
  category: string,
  subCategoriesByCategory: Record<string, string[]>,
): string[] {
  const main = normalizeListingMainCategory(category)
  if (!main) return []
  const preset = PRESET_SUB_CATEGORIES_BY_FAMILY[main] ?? []
  const fromRows = subCategoriesByCategory[main] ?? []
  return uniqueSorted([...preset, ...fromRows])
}

export function buildListingSubCategoriesByCategory(
  pairs: Array<{ category: string | null | undefined; subCategory: string | null | undefined }>,
): Record<string, string[]> {
  const out: Record<string, Set<string>> = {}
  for (const pair of pairs) {
    const { main, sub } = resolveListingCategoryPair(pair.category, pair.subCategory)
    if (!main || !sub) continue
    if (!out[main]) out[main] = new Set()
    out[main].add(sub)
  }
  const mapped: Record<string, string[]> = {}
  for (const [main, subs] of Object.entries(out)) {
    mapped[main] = uniqueSorted([...subs])
  }
  return mapped
}
