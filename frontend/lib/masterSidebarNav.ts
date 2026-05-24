/** Hierarchical Masters sidebar navigation (Product → Type → Sub-type → sheet). */

export type MasterNavLeaf = { kind: 'leaf'; key: string; label: string }
export type MasterNavGroup = { kind: 'group'; label: string; children: MasterNavNode[] }
export type MasterNavNode = MasterNavLeaf | MasterNavGroup

export const MASTER_SIDEBAR_NAV: MasterNavNode[] = [
  {
    kind: 'group',
    label: 'Valves',
    children: [
      {
        kind: 'group',
        label: 'Butterfly Valve',
        children: [{ kind: 'leaf', key: 'butterfly_valve', label: 'Butterfly valve' }],
      },
      {
        kind: 'group',
        label: 'Ball Valve',
        children: [
          {
            kind: 'group',
            label: '1-Piece Ball Valve',
            children: [
              { kind: 'leaf', key: 'fp_ball_valve_casco_1_piece_multi_end', label: '1-Piece — Casco (multi end)' },
              { kind: 'leaf', key: 'fp_ball_valve_casco_1_piece_flanged', label: '1-Piece — Casco (flanged)' },
              { kind: 'leaf', key: 'fp_ball_valve_unison_1_piece_multi_end', label: '1-Piece — Unison (multi end)' },
            ],
          },
          {
            kind: 'group',
            label: '2-Piece Ball Valve',
            children: [
              { kind: 'leaf', key: 'fp_ball_valve_casco_2_piece', label: '2-Piece — Casco' },
              { kind: 'leaf', key: 'fp_ball_valve_unison_2_piece_iso_pads', label: '2-Piece — Unison (ISO pads)' },
            ],
          },
          {
            kind: 'group',
            label: '3-Piece Ball Valve',
            children: [
              { kind: 'leaf', key: 'fp_ball_valve_casco_3_piece', label: '3-Piece — Casco' },
              { kind: 'leaf', key: 'fp_ball_valve_casco_3_piece_ext_stem', label: '3-Piece — Extended stem (Casco)' },
              { kind: 'leaf', key: 'fp_ball_valve_casco_3_piece_3_way_l_port', label: '3-Piece 3-Way L-Port — Casco' },
              { kind: 'leaf', key: 'fp_ball_valve_unison_3_piece', label: '3-Piece — Unison' },
              { kind: 'leaf', key: 'fp_ball_valve_unison_3_piece_3_way_l_port', label: '3-Piece 3-Way L-Port — Unison' },
            ],
          },
        ],
      },
      {
        kind: 'group',
        label: 'Flush Bottom Valve',
        children: [
          { kind: 'leaf', key: 'fp_fbv_ball_type', label: 'FBV — Ball Type' },
          { kind: 'leaf', key: 'fp_fbv_y_type', label: 'FBV — Y Type' },
        ],
      },
      {
        kind: 'group',
        label: 'Needle Valve',
        children: [{ kind: 'leaf', key: 'fp_needle_valve', label: 'Needle valve' }],
      },
      {
        kind: 'group',
        label: 'Non Return Valve / Check Valve',
        children: [
          { kind: 'leaf', key: 'fp_nrv_inline_check', label: 'In-line check valve' },
          { kind: 'leaf', key: 'fp_nrv_wafer_check', label: 'Wafer check valve' },
          { kind: 'leaf', key: 'fp_nrv_non_slam', label: 'Non-slam check valve' },
        ],
      },
      {
        kind: 'group',
        label: 'Safety / Pressure Relief Valve',
        children: [
          { kind: 'leaf', key: 'fp_safety_sv_bsp_f', label: 'SV — Screwed (BSP)' },
          { kind: 'leaf', key: 'fp_safety_sv_tc_end', label: 'SV — TC end' },
          { kind: 'leaf', key: 'fp_safety_sv_flanged_150', label: 'SV — Flanged #150' },
        ],
      },
      {
        kind: 'group',
        label: 'Sampling Valve',
        children: [
          { kind: 'leaf', key: 'fp_sampling_sv_tc_end', label: 'Sampling — TC end' },
          { kind: 'leaf', key: 'fp_sampling_sv_od_base_weld', label: 'Sampling — OD base weld' },
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
              { kind: 'leaf', key: 'fp_mascon_manual_tc_end', label: 'Manual — TC end' },
              { kind: 'leaf', key: 'fp_mascon_manual_butt_weld', label: 'Manual — Butt weld' },
            ],
          },
          {
            kind: 'group',
            label: 'Pneumatic Diaphragm Valve',
            children: [
              { kind: 'leaf', key: 'fp_mascon_pneumatic_tc_end', label: 'Pneumatic — TC end' },
              { kind: 'leaf', key: 'fp_mascon_pneumatic_butt_weld', label: 'Pneumatic — Butt weld' },
            ],
          },
          {
            kind: 'group',
            label: 'Spare Diaphragm',
            children: [
              { kind: 'leaf', key: 'fp_mascon_spare_diaphragm', label: 'Spare diaphragm' },
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
              { kind: 'leaf', key: 'fp_mascon_zdvm_l_type', label: 'ZDV-M — L type' },
              { kind: 'leaf', key: 'fp_mascon_zdvm_j_type', label: 'ZDV-M — J type' },
            ],
          },
          {
            kind: 'group',
            label: 'Pneumatic ZDV',
            children: [
              { kind: 'leaf', key: 'fp_mascon_zdvp_l_type', label: 'ZDV-P — L type' },
              { kind: 'leaf', key: 'fp_mascon_zdvp_j_type', label: 'ZDV-P — J type' },
            ],
          },
        ],
      },
      {
        kind: 'group',
        label: 'Pressure Reducing Valve',
        children: [{ kind: 'leaf', key: 'fp_mascon_prv', label: 'Pressure reducing valve' }],
      },
      {
        kind: 'group',
        label: 'Angle Type Valve',
        children: [
          { kind: 'leaf', key: 'fp_mascon_angle_sc_flanged', label: 'Angle — Screwed & flanged' },
          { kind: 'leaf', key: 'fp_mascon_angle_butt_weld', label: 'Angle — Butt weld' },
          { kind: 'leaf', key: 'fp_mascon_angle_tc_end', label: 'Angle — TC end' },
        ],
      },
      {
        kind: 'group',
        label: 'Sight Glass',
        children: [
          { kind: 'leaf', key: 'fp_sight_glass_double_window', label: 'Sight glass — Double window' },
          { kind: 'leaf', key: 'fp_sight_glass_inline_ic_casted', label: 'Sight glass — Inline IC casted' },
          { kind: 'leaf', key: 'fp_sight_glass_inline_solid_flange', label: 'Sight glass — Inline solid flange' },
        ],
      },
      {
        kind: 'group',
        label: 'Strainer',
        children: [
          { kind: 'leaf', key: 'fp_strainer_y_150', label: 'Strainer — Y type #150' },
          { kind: 'leaf', key: 'fp_strainer_y_300', label: 'Strainer — Y type #300' },
        ],
      },
    ],
  },
  {
    kind: 'group',
    label: 'Hoses',
    children: [
      { kind: 'leaf', key: 'fp_hose_tuder', label: 'Tuder hoses' },
      { kind: 'leaf', key: 'fp_hose_thunder', label: 'PVC — Thunder hoses' },
      { kind: 'leaf', key: 'fp_hose_pvc_nylon_non_toxic', label: 'PVC nylon braided — Non-toxic' },
      { kind: 'leaf', key: 'fp_hose_pvc_nylon_food_grade', label: 'PVC nylon braided — Food grade' },
      { kind: 'leaf', key: 'fp_hose_red_silicon', label: 'Red silicon hose' },
      { kind: 'leaf', key: 'fp_hose_pu', label: 'PU hose' },
    ],
  },
  {
    kind: 'group',
    label: 'Hose Fittings',
    children: [
      { kind: 'leaf', key: 'fp_fittings_sms_nut', label: 'SMS nut' },
      { kind: 'leaf', key: 'fp_fittings_tri_clover_end', label: 'Tri-Clover end' },
      { kind: 'leaf', key: 'fp_fittings_din_nut_11851', label: 'DIN nut 11851' },
      { kind: 'leaf', key: 'fp_fittings_swivel_nut', label: 'Swivel nut' },
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

/** All category keys that appear in the sidebar tree (for validation / dropdowns). */
export const SIDEBAR_MASTER_CATEGORY_KEYS = new Set(flattenMasterNavLeaves().map((l) => l.key))

export function findMasterNavPathForKey(
  targetKey: string,
  nodes: MasterNavNode[] = MASTER_SIDEBAR_NAV,
  path: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.kind === 'leaf') {
      if (node.key === targetKey) return [...path, node.key]
    } else {
      const found = findMasterNavPathForKey(targetKey, node.children, [...path, node.label])
      if (found) return found
    }
  }
  return null
}
