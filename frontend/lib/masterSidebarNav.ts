/** Hierarchical Masters sidebar navigation (Product → Type → Sub-type → sheet). */

export type MasterNavLeaf = {
  kind: 'leaf'
  key: string
  label: string
  /** When set, masters table filters rows by this ``variant_type`` (same catalog key). */
  variantType?: string
  /** Disambiguates active link when several leaves share key + variantType. */
  navSlug?: string
}

export type MasterNavGroup = { kind: 'group'; label: string; children: MasterNavNode[] }
export type MasterNavNode = MasterNavLeaf | MasterNavGroup

export function masterNavLeafHref(leaf: MasterNavLeaf): string {
  const params = new URLSearchParams()
  if (leaf.variantType) params.set('variant_type', leaf.variantType)
  if (leaf.navSlug) params.set('nav', leaf.navSlug)
  const q = params.toString()
  return `/masters/${leaf.key}${q ? `?${q}` : ''}`
}

export function isMasterNavLeafActive(
  leaf: MasterNavLeaf,
  categoryKey: string | null,
  variantType: string | null,
  navSlug: string | null,
): boolean {
  if (!categoryKey || leaf.key !== categoryKey) return false
  if (leaf.navSlug) return navSlug === leaf.navSlug
  if (leaf.variantType) return variantType === leaf.variantType && !navSlug
  return !variantType && !navSlug
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
                key: 'fp_ball_valve_casco_1_piece_flanged',
                label: '1-Piece Ball Valve Casco Make (flanged)',
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
          {
            kind: 'group',
            label: 'SV – Flanged #150',
            children: [
              { kind: 'leaf', key: 'fp_safety_sv_flanged_150', label: 'SV – Flanged #150 PVH Make' },
            ],
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
            label: 'Y Type Strainer #150',
            children: [{ kind: 'leaf', key: 'fp_strainer_y_150', label: 'Strainer – Y Type #150' }],
          },
          {
            kind: 'group',
            label: 'Y Type Strainer #300',
            children: [{ kind: 'leaf', key: 'fp_strainer_y_300', label: 'Strainer – Y Type #300' }],
          },
        ],
      },
    ],
  },
  {
    kind: 'group',
    label: 'Hoses',
    children: [
      { kind: 'leaf', key: 'fp_hose_tuder', label: 'Tuder Hoses' },
      { kind: 'leaf', key: 'fp_hose_thunder', label: 'PVC – Thunder Hoses Jyoti Make' },
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
      { kind: 'leaf', key: 'operator', label: 'Operator' },
      { kind: 'leaf', key: 'brackets_coupler', label: 'Brackets & couplers' },
      { kind: 'leaf', key: 'sov', label: 'SOV' },
      { kind: 'leaf', key: 'limit_switch_box', label: 'Limit switch box' },
      { kind: 'leaf', key: 'positioner', label: 'Positioner' },
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

/** One entry per catalog API key (for supplier dropdowns). */
export function flattenMasterNavCatalogCategories(): { key: string; label: string }[] {
  const byKey = new Map<string, string>()
  for (const leaf of flattenMasterNavLeaves()) {
    if (!byKey.has(leaf.key)) byKey.set(leaf.key, leaf.label)
  }
  return [...byKey.entries()].map(([key, label]) => ({ key, label }))
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
  flattenMasterNavCatalogCategories().map((c) => c.key),
)

export type MasterNavMatch = {
  variantType?: string | null
  navSlug?: string | null
}

function leafMatches(node: MasterNavLeaf, targetKey: string, match?: MasterNavMatch): boolean {
  if (node.key !== targetKey) return false
  if (!match) return true
  if (node.navSlug) return match.navSlug === node.navSlug
  if (node.variantType) return match.variantType === node.variantType && !match.navSlug
  return !match.variantType && !match.navSlug
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
