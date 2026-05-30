/** Hierarchical Masters sidebar navigation (Product → Type → Sub-type → sheet). */

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
    label: 'Valves',
    children: [
      {
        kind: 'group',
        label: 'Butterfly Valve',
        children: [
          {
            kind: 'group',
            label: 'Hygienic Butterfly Valve',
            children: [
              {
                kind: 'leaf',
                key: 'butterfly_valve',
                label: 'Hygienic Butterfly Valve Alfa Laval Make',
                variantType: 'Hygienic Butterfly Valve',
                navSlug: 'hygienic-alfa-laval',
              },
              {
                kind: 'leaf',
                key: 'butterfly_valve',
                label: 'Hygienic Butterfly Valve PVH Make',
                variantType: 'Hygienic Butterfly Valve',
                navSlug: 'hygienic-pvh',
              },
            ],
          },
          {
            kind: 'group',
            label: 'Aluminium Butterfly Valve',
            children: [
              {
                kind: 'leaf',
                key: 'butterfly_valve',
                label: 'Aluminium Butterfly Valve PVH Make',
                variantType: 'Aluminium Butterfly Valve',
                navSlug: 'aluminium-pvh',
              },
            ],
          },
          {
            kind: 'group',
            label: 'Industrial Butterfly Valve',
            children: [
              {
                kind: 'leaf',
                key: 'butterfly_valve',
                label: 'Industrial Butterfly Valve Omval Make',
                variantType: 'Industrial Butterfly Valve',
                navSlug: 'industrial-omval',
              },
              {
                kind: 'leaf',
                key: 'butterfly_valve',
                label: 'Industrial Butterfly Valve Delval Make',
                variantType: 'Industrial Butterfly Valve',
                navSlug: 'industrial-delval',
              },
            ],
          },
        ],
      },
      {
        kind: 'group',
        label: 'Ball Valve',
        children: [
          {
            kind: 'group',
            label: '1-Piece Ball Valve',
            children: [
              {
                kind: 'leaf',
                key: 'fp_ball_valve_casco_1_piece_multi_end',
                label: '1-Piece Ball Valve Casco Make',
              },
              {
                kind: 'leaf',
                key: 'fp_ball_valve_unison_1_piece_multi_end',
                label: '1-Piece Ball Valve Unison Make',
              },
            ],
          },
          {
            kind: 'group',
            label: '2-Piece Ball Valve',
            children: [
              { kind: 'leaf', key: 'fp_ball_valve_casco_2_piece', label: '2-Piece Ball Valve Casco Make' },
              {
                kind: 'leaf',
                key: 'fp_ball_valve_unison_2_piece_iso_pads',
                label: '2-Piece Ball Valve Unison Make',
              },
            ],
          },
          {
            kind: 'group',
            label: '3-Piece Ball Valve',
            children: [
              { kind: 'leaf', key: 'fp_ball_valve_casco_3_piece', label: '3-Piece Ball Valve Casco Make' },
              {
                kind: 'leaf',
                key: 'fp_ball_valve_casco_3_piece_ext_stem',
                label: '3-Piece Extended Stem Ball Valve Casco Make',
              },
              {
                kind: 'leaf',
                key: 'fp_ball_valve_casco_3_piece_3_way_l_port',
                label: '3-Piece 3-Way L-Port Casco Make',
              },
              { kind: 'leaf', key: 'fp_ball_valve_unison_3_piece', label: '3-Piece Ball Valve Unison Make' },
              {
                kind: 'leaf',
                key: 'fp_ball_valve_unison_3_piece_3_way_l_port',
                label: '3-Piece 3-Way L-Port Unison Make',
              },
            ],
          },
        ],
      },
      {
        kind: 'group',
        label: 'Flush Bottom Valve',
        children: [
          {
            kind: 'group',
            label: 'FBV – Ball Type',
            children: [
              { kind: 'leaf', key: 'fp_fbv_ball_type', label: 'FBV – Ball Type Casco Make' },
            ],
          },
          {
            kind: 'group',
            label: 'FBV – Y Type',
            children: [{ kind: 'leaf', key: 'fp_fbv_y_type', label: 'FBV – Y Type Casco Make' }],
          },
        ],
      },
      {
        kind: 'group',
        label: 'Needle Valve',
        children: [{ kind: 'leaf', key: 'fp_needle_valve', label: 'Needle Valve Aster Make' }],
      },
      {
        kind: 'group',
        label: 'Non Return Valve / Check Valve',
        children: [
          {
            kind: 'group',
            label: 'In Line Check Valve',
            children: [
              { kind: 'leaf', key: 'fp_nrv_inline_check', label: 'In Line Check Valve Casco Make' },
            ],
          },
          {
            kind: 'group',
            label: 'Wafer Check Valve',
            children: [{ kind: 'leaf', key: 'fp_nrv_wafer_check', label: 'Wafer Check Valve Casco Make' }],
          },
          {
            kind: 'group',
            label: 'Non Slam Check Valve',
            children: [
              { kind: 'leaf', key: 'fp_nrv_non_slam', label: 'Non Slam Check Valve Casco Make' },
            ],
          },
        ],
      },
      {
        kind: 'group',
        label: 'Safety / Pressure Relief Valve',
        children: [
          {
            kind: 'group',
            label: 'SV – Screwed (BSP)',
            children: [{ kind: 'leaf', key: 'fp_safety_sv_bsp_f', label: 'SV – Screwed (BSP) PVH Make' }],
          },
          {
            kind: 'group',
            label: 'SV – TC End',
            children: [{ kind: 'leaf', key: 'fp_safety_sv_tc_end', label: 'SV – TC End PVH Make' }],
          },
        ],
      },
      {
        kind: 'group',
        label: 'Sampling Valve',
        children: [
          {
            kind: 'group',
            label: 'Sampling Valve – TC End',
            children: [
              {
                kind: 'leaf',
                key: 'fp_sampling_sv_tc_end',
                label: 'Sampling Valve – TC End Mascon Make',
              },
            ],
          },
          {
            kind: 'group',
            label: 'Sampling Valve – OD Base Weld End',
            children: [
              {
                kind: 'leaf',
                key: 'fp_sampling_sv_od_base_weld',
                label: 'Sampling Valve – OD Base Weld End PVH Make',
              },
            ],
          },
        ],
      },
      {
        kind: 'group',
        label: 'Diaphragm Valve',
        children: [
          {
            kind: 'group',
            label: 'Manual Diaphragm Valve',
            children: [
              { kind: 'leaf', key: 'fp_mascon_manual_tc_end', label: 'Manual – TC End Mascon Make' },
              { kind: 'leaf', key: 'fp_mascon_manual_butt_weld', label: 'Manual – Butt Weld Mascon Make' },
            ],
          },
          {
            kind: 'group',
            label: 'Pneumatic Diaphragm Valve',
            children: [
              { kind: 'leaf', key: 'fp_mascon_pneumatic_tc_end', label: 'Pneumatic – TC End Mascon Make' },
              {
                kind: 'leaf',
                key: 'fp_mascon_pneumatic_butt_weld',
                label: 'Pneumatic – Butt Weld Mascon Make',
              },
            ],
          },
          {
            kind: 'group',
            label: 'Spare Diaphragm',
            children: [
              { kind: 'leaf', key: 'fp_mascon_spare_diaphragm', label: 'Spare Diaphragm Mascon Make' },
            ],
          },
        ],
      },
      {
        kind: 'group',
        label: 'Zero Dead Leg Valve',
        children: [
          {
            kind: 'group',
            label: 'Manual ZDV',
            children: [
              { kind: 'leaf', key: 'fp_mascon_zdvm_l_type', label: 'ZDV-M L Type Mascon Make' },
              { kind: 'leaf', key: 'fp_mascon_zdvm_j_type', label: 'ZDV-M J Type Mascon Make' },
            ],
          },
          {
            kind: 'group',
            label: 'Pneumatic ZDV',
            children: [
              { kind: 'leaf', key: 'fp_mascon_zdvp_l_type', label: 'ZDV-P L Type Mascon Make' },
              { kind: 'leaf', key: 'fp_mascon_zdvp_j_type', label: 'ZDV-P J Type Mascon Make' },
            ],
          },
        ],
      },
      {
        kind: 'group',
        label: 'Pressure Reducing Valve',
        children: [
          { kind: 'leaf', key: 'fp_mascon_prv', label: 'Pressure Reducing Valve Mascon Make' },
        ],
      },
      {
        kind: 'group',
        label: 'Angle Type Valve',
        children: [
          {
            kind: 'leaf',
            key: 'fp_mascon_angle_sc_flanged',
            label: 'ATV – Screwed & Flanged Mascon Make',
          },
          { kind: 'leaf', key: 'fp_mascon_angle_butt_weld', label: 'ATV – Butt Weld Mascon Make' },
          { kind: 'leaf', key: 'fp_mascon_angle_tc_end', label: 'ATV – TC End Mascon Make' },
        ],
      },
      {
        kind: 'group',
        label: 'Sight Glass',
        children: [
          {
            kind: 'group',
            label: 'Double Window Sight Glass',
            children: [
              {
                kind: 'leaf',
                key: 'fp_sight_glass_double_window',
                label: 'Sight Glass – Double Window',
              },
            ],
          },
          {
            kind: 'group',
            label: 'Inline Sight Glass',
            children: [
              {
                kind: 'leaf',
                key: 'fp_sight_glass_inline_ic_casted',
                label: 'Sight Glass – Inline IC Casted',
              },
              {
                kind: 'leaf',
                key: 'fp_sight_glass_inline_solid_flange',
                label: 'Sight Glass – Inline Solid Flange',
              },
            ],
          },
        ],
      },
      {
        kind: 'group',
        label: 'Strainer',
        children: [
          {
            kind: 'group',
            label: 'Y Type Strainer',
            children: [
              { kind: 'leaf', key: 'fp_strainer_y_150', label: 'Strainer – Y Type #150' },
              { kind: 'leaf', key: 'fp_strainer_y_300', label: 'Strainer – Y Type #300' },
            ],
          },
        ],
      },
    ],
  },
  {
    kind: 'group',
    label: 'Hoses',
    children: [
      {
        kind: 'group',
        label: 'Tuder Hoses',
        children: [{ kind: 'leaf', key: 'fp_hose_tuder', label: 'Tuder Hoses' }],
      },
      {
        kind: 'group',
        label: 'PVC Hoses',
        children: [
          { kind: 'leaf', key: 'fp_hose_thunder', label: 'PVC — Thunder Hoses Jyoti Make' },
          {
            kind: 'leaf',
            key: 'fp_hose_pvc_nylon_non_toxic',
            label: 'PVC Nylon Braided – Non-Toxic Jyoti Make',
          },
          {
            kind: 'leaf',
            key: 'fp_hose_pvc_nylon_food_grade',
            label: 'PVC Nylon Braided – Food Grade Jyoti Make',
          },
          { kind: 'leaf', key: 'fp_hose_red_silicon', label: 'Red Silicon Hose Jyoti Make' },
          { kind: 'leaf', key: 'fp_hose_pu', label: 'PU Hose Jyoti Make' },
        ],
      },
    ],
  },
  {
    kind: 'group',
    label: 'Hose Fittings',
    children: [
      { kind: 'leaf', key: 'fp_fittings_sms_nut', label: 'SMS Nut' },
      { kind: 'leaf', key: 'fp_fittings_tri_clover_end', label: 'Tri-Clover End' },
      { kind: 'leaf', key: 'fp_fittings_din_nut_11851', label: 'DIN Nut 11851' },
      { kind: 'leaf', key: 'fp_fittings_swivel_nut', label: 'Swivel Nut' },
      { kind: 'leaf', key: 'fp_fittings_flange_150', label: 'Flange #150' },
    ],
  },
  {
    kind: 'group',
    label: 'Accessories',
    children: [
      {
        kind: 'group',
        label: 'Actuator',
        children: [
          {
            kind: 'group',
            label: 'Double Acting',
            children: [
              {
                kind: 'leaf',
                key: 'operator',
                label: 'DA',
                modelNamePrefix: 'DA',
                navSlug: 'actuator-da',
              },
            ],
          },
          {
            kind: 'group',
            label: 'Single Acting',
            children: [
              {
                kind: 'leaf',
                key: 'operator',
                label: 'SA',
                modelNamePrefix: 'SA',
                navSlug: 'actuator-sa',
              },
            ],
          },
        ],
      },
      { kind: 'leaf', key: 'brackets_coupler', label: 'Brackets & couplers' },
      {
        kind: 'group',
        label: 'SOV',
        children: [
          {
            kind: 'leaf',
            key: 'sov',
            label: 'Namur Type',
            variantContains: 'Namur Type',
            variantExcludeContains: 'Non Namur',
            navSlug: 'sov-namur',
          },
          {
            kind: 'leaf',
            key: 'sov',
            label: 'Non Namur Type',
            variantContainsAny: ['Non Namur', 'Non Type'],
            navSlug: 'sov-non-namur',
          },
        ],
      },
      {
        kind: 'group',
        label: 'Limit Switch Box',
        children: [
          {
            kind: 'leaf',
            key: 'limit_switch_box',
            label: 'Weather Proof',
            variantContains: 'Wheather proof',
            navSlug: 'lsb-weather',
          },
          {
            kind: 'leaf',
            key: 'limit_switch_box',
            label: 'Flame proof',
            variantContains: 'Flame proof',
            navSlug: 'lsb-flame',
          },
        ],
      },
      {
        kind: 'group',
        label: 'Positioner',
        children: [
          {
            kind: 'leaf',
            key: 'positioner',
            label: 'Electro Pneumatic Positioner Rotork Make',
            variantContains: 'Electro- Pneumatic',
            variantExcludeContains: 'Rotex',
            navSlug: 'positioner-electro-rotork',
          },
          {
            kind: 'leaf',
            key: 'positioner',
            label: 'Pneumatic Pneumatic Positioner Rotork Make',
            variantContains: 'Pneumatic- Pneumatic',
            variantExcludeContains: 'Rotex',
            navSlug: 'positioner-pneumatic-rotork',
          },
          {
            kind: 'leaf',
            key: 'positioner',
            label: 'SMART Positioner Rotork Make',
            variantContains: 'SMART Positioner',
            variantExcludeContains: 'Rotex',
            navSlug: 'positioner-smart-rotork',
          },
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
