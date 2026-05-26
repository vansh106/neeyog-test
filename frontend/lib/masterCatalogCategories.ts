/** Masters sidebar + supplier UI: catalog keys after Final_Products import. */

import { flattenMasterNavCatalogCategories } from '@/lib/masterSidebarNav'

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
  { key: 'fp_hose_tuder', label: 'Hose — Tuder' },
  { key: 'fp_hose_thunder', label: 'Hose — Thunder' },
  { key: 'fp_hose_pvc_nylon_non_toxic', label: 'Hose — PVC nylon (non-toxic)' },
  { key: 'fp_hose_pvc_nylon_food_grade', label: 'Hose — PVC nylon (food grade)' },
  { key: 'fp_hose_red_silicon', label: 'Hose — Red silicon' },
  { key: 'fp_hose_pu', label: 'Hose — PU' },
  { key: 'fp_fittings_sms_nut', label: 'Fittings — SMS nut' },
  { key: 'fp_fittings_tri_clover_end', label: 'Fittings — Tri-Clover end' },
  { key: 'fp_fittings_din_nut_11851', label: 'Fittings — DIN nut 11851' },
  { key: 'fp_fittings_swivel_nut', label: 'Fittings — Swivel nut' },
  { key: 'fp_fittings_flange_150', label: 'Fittings — Flange #150' },
]

export const FBV_MASTER_CATEGORIES: MasterCatalogCategory[] = [
  { key: 'fp_fbv_ball_type', label: 'FBV — Ball Type' },
  { key: 'fp_fbv_y_type', label: 'FBV — Y Type' },
]

export const BALL_VALVE_MASTER_CATEGORIES: MasterCatalogCategory[] = [
  { key: 'fp_ball_valve_casco_1_piece_multi_end', label: 'Ball Valve — 1-piece (multi-end)' },
  { key: 'fp_ball_valve_casco_1_piece_flanged', label: 'Ball Valve — 1-piece (flanged)' },
  { key: 'fp_ball_valve_casco_2_piece', label: 'Ball Valve — 2-piece' },
  { key: 'fp_ball_valve_casco_3_piece', label: 'Ball Valve — 3-piece' },
  { key: 'fp_ball_valve_casco_3_piece_ext_stem', label: 'Ball Valve — 3-piece (ext. stem)' },
  { key: 'fp_ball_valve_casco_3_piece_3_way_l_port', label: 'Ball Valve — 3-piece (3-way L-port)' },
  { key: 'fp_ball_valve_unison_1_piece_multi_end', label: 'Ball Valve — 1-piece (multi-end)' },
  { key: 'fp_ball_valve_unison_2_piece_iso_pads', label: 'Ball Valve — 2-piece (ISO pads)' },
  { key: 'fp_ball_valve_unison_3_piece', label: 'Ball Valve — 3-piece' },
  { key: 'fp_ball_valve_unison_3_piece_3_way_l_port', label: 'Ball Valve — 3-piece (3-way L-port)' },
]

/** Flat list derived from hierarchical sidebar nav (dropdowns in Sidebar). */
export const SIDEBAR_MASTER_CATEGORIES: MasterCatalogCategory[] = flattenMasterNavCatalogCategories()
