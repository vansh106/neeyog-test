/** Masters sidebar + supplier UI: catalog keys after Final_Products import. */

export type MasterCatalogCategory = { key: string; label: string }

export const FINAL_PRODUCT_MASTER_CATEGORIES: MasterCatalogCategory[] = [
  { key: 'fp_mascon_manual_tc_end', label: 'Manual (TC end)' },
  { key: 'fp_mascon_manual_butt_weld', label: 'Manual (butt weld)' },
  { key: 'fp_mascon_pneumatic_tc_end', label: 'Pneumatic (TC end)' },
  { key: 'fp_mascon_pneumatic_butt_weld', label: 'Pneumatic (butt weld)' },
  { key: 'fp_mascon_zdvm_l_type', label: 'ZDV-M L type' },
  { key: 'fp_mascon_zdvm_j_type', label: 'ZDV-M J type' },
  { key: 'fp_mascon_zdvp_l_type', label: 'ZDV-P L type' },
  { key: 'fp_mascon_zdvp_j_type', label: 'ZDV-P J type' },
  { key: 'fp_mascon_prv', label: 'PRV' },
  { key: 'fp_mascon_angle_sc_flanged', label: 'Angle (scr. & flg.)' },
  { key: 'fp_mascon_angle_butt_weld', label: 'Angle (butt weld)' },
  { key: 'fp_mascon_angle_tc_end', label: 'Angle (TC end)' },
  { key: 'fp_mascon_spare_diaphragm', label: 'Spare diaphragm' },
  { key: 'fp_needle_valve', label: 'Needle valve' },
  { key: 'fp_nrv_inline_check', label: 'NRV — In-line check' },
  { key: 'fp_nrv_wafer_check', label: 'NRV — Wafer check' },
  { key: 'fp_nrv_non_slam', label: 'NRV — Non-slam' },
  { key: 'fp_safety_sv_bsp_f', label: 'Safety — BSP-F' },
  { key: 'fp_safety_sv_tc_end', label: 'Safety — TC end' },
  { key: 'fp_safety_sv_flanged_150', label: 'Safety — Flanged #150' },
  { key: 'fp_sampling_sv_tc_end', label: 'Sampling — TC end' },
  { key: 'fp_sampling_sv_od_base_weld', label: 'Sampling — OD base weld' },
  { key: 'fp_sight_glass_double_window', label: 'Sight glass — Double window' },
  { key: 'fp_sight_glass_inline_ic_casted', label: 'Sight glass — In-line (IC casted)' },
  { key: 'fp_sight_glass_inline_solid_flange', label: 'Sight glass — In-line (solid flange)' },
  { key: 'fp_strainer_y_150', label: 'Strainer — Y #150' },
  { key: 'fp_strainer_y_300', label: 'Strainer — Y #300' },
]

const CORE_BEFORE_FP: MasterCatalogCategory[] = [
  { key: 'butterfly_valve', label: 'Butterfly valve' },
  { key: 'ball_valve', label: 'Ball valve' },
]

const CORE_AFTER_FP: MasterCatalogCategory[] = [
  { key: 'operator', label: 'Operator' },
  { key: 'brackets_coupler', label: 'Brackets & couplers' },
  { key: 'sov', label: 'SOV' },
  { key: 'limit_switch_box', label: 'Limit switch box' },
  { key: 'positioner', label: 'Positioner' },
]

export const SIDEBAR_MASTER_CATEGORIES: MasterCatalogCategory[] = [
  ...CORE_BEFORE_FP,
  ...FINAL_PRODUCT_MASTER_CATEGORIES,
  ...CORE_AFTER_FP,
]
