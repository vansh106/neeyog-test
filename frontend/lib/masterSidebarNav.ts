/** Masters sidebar navigation for seeded catalog families. Starts empty for this client. */

export type MasterNavLeaf = {
  kind: 'leaf'
  key: string
  label: string
  /** Exact ``variant_type`` match. */
  variantType?: string
  /** ``variant_type`` ILIKE %value% (optional exclude substring). */
  variantContains?: string
  variantExcludeContains?: string
  /** Any of these substrings (comma in query param ``variant_contains_any``). */
  variantContainsAny?: string[]
  /** Operator/actuator ``model_name`` prefix (e.g. DA / SA). */
  modelNamePrefix?: string
  /** Disambiguates active link when several leaves share one catalog key. */
  navSlug?: string
}

export type MasterNavGroup = { kind: 'group'; label: string; children: MasterNavNode[] }
export type MasterNavNode = MasterNavLeaf | MasterNavGroup

export type MasterSheetQueryFilters = {
  variant_type?: string
  variant_contains?: string
  variant_exclude_contains?: string
  variant_contains_any?: string
  model_name_prefix?: string
  nav?: string
}

export function masterNavLeafQueryFilters(leaf: MasterNavLeaf): MasterSheetQueryFilters {
  const out: MasterSheetQueryFilters = {}
  if (leaf.variantType) out.variant_type = leaf.variantType
  if (leaf.variantContains) out.variant_contains = leaf.variantContains
  if (leaf.variantExcludeContains) out.variant_exclude_contains = leaf.variantExcludeContains
  if (leaf.variantContainsAny?.length) out.variant_contains_any = leaf.variantContainsAny.join(',')
  if (leaf.modelNamePrefix) out.model_name_prefix = leaf.modelNamePrefix
  if (leaf.navSlug) out.nav = leaf.navSlug
  return out
}

export function masterNavLeafHref(leaf: MasterNavLeaf): string {
  const params = new URLSearchParams()
  const f = masterNavLeafQueryFilters(leaf)
  if (f.variant_type) params.set('variant_type', f.variant_type)
  if (f.variant_contains) params.set('variant_contains', f.variant_contains)
  if (f.variant_exclude_contains) params.set('variant_exclude_contains', f.variant_exclude_contains)
  if (f.variant_contains_any) params.set('variant_contains_any', f.variant_contains_any)
  if (f.model_name_prefix) params.set('model_name_prefix', f.model_name_prefix)
  if (f.nav) params.set('nav', f.nav)
  const q = params.toString()
  return `/masters/${leaf.key}${q ? `?${q}` : ''}`
}

export type MasterNavActiveQuery = {
  variantType: string | null
  navSlug: string | null
  variantContains: string | null
  variantExcludeContains: string | null
  variantContainsAny: string | null
  modelNamePrefix: string | null
}

export function masterNavActiveQueryFromSearchParams(
  params: URLSearchParams | { get: (k: string) => string | null },
): MasterNavActiveQuery {
  return {
    variantType: params.get('variant_type')?.trim() || null,
    navSlug: params.get('nav')?.trim() || null,
    variantContains: params.get('variant_contains')?.trim() || null,
    variantExcludeContains: params.get('variant_exclude_contains')?.trim() || null,
    variantContainsAny: params.get('variant_contains_any')?.trim() || null,
    modelNamePrefix: params.get('model_name_prefix')?.trim() || null,
  }
}

function filtersMatchLeaf(leaf: MasterNavLeaf, q: MasterNavActiveQuery): boolean {
  if (leaf.navSlug) return q.navSlug === leaf.navSlug
  if (leaf.modelNamePrefix) return q.modelNamePrefix === leaf.modelNamePrefix
  if (leaf.variantType) {
    return q.variantType === leaf.variantType && !q.navSlug && !q.variantContains && !q.modelNamePrefix
  }
  if (leaf.variantContainsAny?.length) {
    return q.variantContainsAny === leaf.variantContainsAny.join(',')
  }
  if (leaf.variantContains) {
    return (
      q.variantContains === leaf.variantContains &&
      (leaf.variantExcludeContains || '') === (q.variantExcludeContains || '')
    )
  }
  return (
    !q.variantType &&
    !q.navSlug &&
    !q.variantContains &&
    !q.variantExcludeContains &&
    !q.variantContainsAny &&
    !q.modelNamePrefix
  )
}

export function isMasterNavLeafActive(
  leaf: MasterNavLeaf,
  categoryKey: string | null,
  query: MasterNavActiveQuery,
): boolean {
  if (!categoryKey || leaf.key !== categoryKey) return false
  return filtersMatchLeaf(leaf, query)
}

export const MASTER_SIDEBAR_NAV: MasterNavNode[] = [
  {
    kind: 'group',
    label: 'Packaging',
    children: [
      {
        kind: 'group',
        label: 'Aluminium Foil',
        children: [
          {
            kind: 'leaf',
            key: 'fp_aluminium_foil',
            label: 'Foil Wrap',
            variantType: 'Foil Wrap',
            navSlug: 'foil-wrap',
          },
          {
            kind: 'leaf',
            key: 'fp_aluminium_foil',
            label: 'Foil Box',
            variantType: 'Foil Box',
            navSlug: 'foil-box',
          },
          {
            kind: 'leaf',
            key: 'fp_aluminium_foil',
            label: 'Foil Container',
            variantType: 'Foil Container',
            navSlug: 'foil-container',
          },
          {
            kind: 'leaf',
            key: 'fp_aluminium_foil',
            label: 'Premium Foil Container',
            variantType: 'Premium Foil Container',
            navSlug: 'premium-foil-container',
          },
          {
            kind: 'leaf',
            key: 'fp_aluminium_foil',
            label: 'Foil Paper Lids',
            variantType: 'Foil Paper Lids',
            navSlug: 'foil-paper-lids',
          },
          {
            kind: 'leaf',
            key: 'fp_aluminium_foil',
            label: 'Exclusive Foil Container',
            variantType: 'Exclusive Foil Container',
            navSlug: 'exclusive-foil-container',
          },
          {
            kind: 'leaf',
            key: 'fp_aluminium_foil',
            label: 'Pet Lid',
            variantType: 'Pet Lid',
            navSlug: 'pet-lid',
          },
        ],
      },
      {
        kind: 'group',
        label: 'Paper Products',
        children: [
          { kind: 'leaf', key: 'fp_paper_products', label: 'Eco Paper Cups', variantType: 'Eco Paper Cups', navSlug: 'eco-paper-cups' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Clarro Cups Tall', variantType: 'Clarro Paper Cups Tall', navSlug: 'clarro-cups-tall' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Clarro Cups', variantType: 'Clarro Paper Cups', navSlug: 'clarro-cups' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Clarro Wati', variantType: 'Clarro Paper Wati', navSlug: 'clarro-wati' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Dolphin Cups', variantType: 'Dolphin Paper Cups', navSlug: 'dolphin-cups' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Export Cups', variantType: 'Export Paper Cups', navSlug: 'export-cups' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Ripple Brown', variantType: 'Ripple Cups Brown', navSlug: 'ripple-brown' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Ripple Black', variantType: 'Ripple Cups Black', navSlug: 'ripple-black' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'CP Double Wall', variantType: 'CP Double Wall Cups', navSlug: 'cp-double-wall' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'SI Double Wall', variantType: 'SI Double Wall Cups', navSlug: 'si-double-wall' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'HIPS Lids', variantType: 'HIPS Lids', navSlug: 'hips-lids' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Paper Lids', variantType: 'Paper Lids', navSlug: 'paper-lids' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Bagasse Lids', variantType: 'Bagasse Lids', navSlug: 'bagasse-lids' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Container Kraft', variantType: 'Paper Container Kraft', navSlug: 'container-kraft' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Salad Kraft Bowl', variantType: 'PW Salad Kraft Bowl', navSlug: 'salad-kraft' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Salad White Bowl', variantType: 'PW Salad White Bowl', navSlug: 'salad-white' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Salad SFP Bowl', variantType: 'Paper Salad SFP Bowl', navSlug: 'salad-sfp' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Container White', variantType: 'Paper Container White', navSlug: 'container-white' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Container 110Dia', variantType: 'Paper Container 110Dia', navSlug: 'container-110dia' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Biodegradable Super', variantType: 'Biodegradable Super Paper', navSlug: 'bio-super' },
          { kind: 'leaf', key: 'fp_paper_products', label: 'Paper Plates', variantType: 'Paper Plates', navSlug: 'paper-plates' },
        ],
      },
    ],
  },
]

export function flattenMasterNavLeaves(nodes: MasterNavNode[] = MASTER_SIDEBAR_NAV): MasterNavLeaf[] {
  const out: MasterNavLeaf[] = []
  for (const node of nodes) {
    if (node.kind === 'leaf') out.push(node)
    else out.push(...flattenMasterNavLeaves(node.children))
  }
  return out
}

/** Stable id for supplier assignment — one entry per masters sidebar leaf. */
export function supplierCategoryKeyForLeaf(leaf: MasterNavLeaf): string {
  if (leaf.navSlug) return `${leaf.key}#${leaf.navSlug}`
  return leaf.key
}

/** Catalog API key portion of a supplier category key (``butterfly_valve#nav`` → ``butterfly_valve``). */
export function supplierCategoryCatalogKey(categoryKey: string): string {
  const idx = categoryKey.indexOf('#')
  return idx > 0 ? categoryKey.slice(0, idx) : categoryKey
}

/** Expand legacy broad keys (e.g. ``butterfly_valve``) to all matching sidebar leaves. */
export function expandSupplierCategoryKeys(keys: string[]): string[] {
  const leafKeysByCatalogKey = new Map<string, string[]>()
  for (const leaf of flattenMasterNavLeaves()) {
    const id = supplierCategoryKeyForLeaf(leaf)
    const list = leafKeysByCatalogKey.get(leaf.key) ?? []
    list.push(id)
    leafKeysByCatalogKey.set(leaf.key, list)
  }
  const out = new Set<string>()
  for (const raw of keys) {
    const key = raw.trim()
    if (!key) continue
    if (key.includes('#')) {
      out.add(key)
      continue
    }
    const siblings = leafKeysByCatalogKey.get(key)
    if (siblings && siblings.length > 1) {
      for (const id of siblings) out.add(id)
    } else {
      out.add(key)
    }
  }
  return [...out]
}

/** One entry per catalog API key (for supplier dropdowns). */
export function flattenMasterNavCatalogCategories(): { key: string; label: string }[] {
  const byKey = new Map<string, string>()
  for (const leaf of flattenMasterNavLeaves()) {
    if (!byKey.has(leaf.key)) byKey.set(leaf.key, leaf.label)
  }
  return [...byKey.entries()].map(([key, label]) => ({ key, label }))
}

/** Top-level masters headings (Valves, Hoses, …) with catalog keys under each. */
export type MasterSupplierCategorySection = {
  heading: string
  items: { key: string; label: string }[]
}

export function masterNavSupplierCategorySections(): MasterSupplierCategorySection[] {
  const sections: MasterSupplierCategorySection[] = []
  for (const node of MASTER_SIDEBAR_NAV) {
    if (node.kind !== 'group') continue
    const items: { key: string; label: string }[] = []
    function walk(children: MasterNavNode[]) {
      for (const child of children) {
        if (child.kind === 'leaf') {
          items.push({
            key: supplierCategoryKeyForLeaf(child),
            label: child.label,
          })
        } else {
          walk(child.children)
        }
      }
    }
    walk(node.children)
    if (items.length === 0) continue
    sections.push({
      heading: node.label,
      items,
    })
  }
  return sections
}

const MASTER_CATALOG_LABEL_BY_KEY: Map<string, string> = (() => {
  const m = new Map<string, string>()
  for (const leaf of flattenMasterNavLeaves()) {
    const id = supplierCategoryKeyForLeaf(leaf)
    if (!m.has(id)) m.set(id, leaf.label)
    if (!m.has(leaf.key)) m.set(leaf.key, leaf.label)
  }
  return m
})()

export function masterCatalogCategoryLabel(categoryKey: string): string {
  return MASTER_CATALOG_LABEL_BY_KEY.get(categoryKey) ?? categoryKey
}

export function findMasterNavLeafBySlug(
  navSlug: string,
  nodes: MasterNavNode[] = MASTER_SIDEBAR_NAV,
): MasterNavLeaf | null {
  for (const node of nodes) {
    if (node.kind === 'leaf') {
      if (node.navSlug === navSlug) return node
    } else {
      const found = findMasterNavLeafBySlug(navSlug, node.children)
      if (found) return found
    }
  }
  return null
}

/** All category keys that appear in the sidebar tree (for validation / dropdowns). */
export const SIDEBAR_MASTER_CATEGORY_KEYS = new Set(
  flattenMasterNavLeaves().map((leaf) => supplierCategoryKeyForLeaf(leaf)),
)

export type MasterNavMatch = MasterNavActiveQuery

function leafMatches(node: MasterNavLeaf, targetKey: string, match?: MasterNavMatch): boolean {
  if (node.key !== targetKey) return false
  if (!match) return true
  return filtersMatchLeaf(node, match)
}

export function findMasterNavPathForKey(
  targetKey: string,
  nodes: MasterNavNode[] = MASTER_SIDEBAR_NAV,
  path: string[] = [],
  match?: MasterNavMatch,
): string[] | null {
  for (const node of nodes) {
    if (node.kind === 'leaf') {
      if (leafMatches(node, targetKey, match)) return [...path, node.key]
    } else {
      const found = findMasterNavPathForKey(targetKey, node.children, [...path, node.label], match)
      if (found) return found
    }
  }
  return null
}
