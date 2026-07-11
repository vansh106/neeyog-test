"""Ball valve replacement workbook → catalog keys (masters sidebar order)."""

BALL_VALVE_REPLACEMENT_FILENAME = "Ball_Valve_Products (1).xlsx"

CASCO_SUPPLIER_NAME = "Casco"
UNISON_SUPPLIER_NAME = "Unison"

# (Excel sheet name, catalog_key, supplier name hint)
BALL_VALVE_REPLACEMENT_SHEETS: list[tuple[str, str, str]] = [
    ("Casco – 1-Piece Ball Valve", "fp_ball_valve_casco_1_piece_multi_end", CASCO_SUPPLIER_NAME),
    ("1-Piece Ball Valve Unison Make", "fp_ball_valve_unison_1_piece_multi_end", UNISON_SUPPLIER_NAME),
    ("2-Piece Ball Valve Casco Make", "fp_ball_valve_casco_2_piece", CASCO_SUPPLIER_NAME),
    ("2-Piece Ball Valve Unison Make", "fp_ball_valve_unison_2_piece_iso_pads", UNISON_SUPPLIER_NAME),
    ("3-Piece Ball Valve Casco Make", "fp_ball_valve_casco_3_piece", CASCO_SUPPLIER_NAME),
    ("3-Piece-Extended Stem Ball V-Ca", "fp_ball_valve_casco_3_piece_ext_stem", CASCO_SUPPLIER_NAME),
    ("3-Piece 3-Way L-Port Casco Make", "fp_ball_valve_casco_3_piece_3_way_l_port", CASCO_SUPPLIER_NAME),
    ("3-Piece Ball Valve Unison Make", "fp_ball_valve_unison_3_piece", UNISON_SUPPLIER_NAME),
    ("3-Piece 3-Way L-Port Unison Mak", "fp_ball_valve_unison_3_piece_3_way_l_port", UNISON_SUPPLIER_NAME),
]

BALL_VALVE_CATALOG_KEYS: frozenset[str] = frozenset(
    {k for _, k, _ in BALL_VALVE_REPLACEMENT_SHEETS}
    | {"fp_ball_valve_casco_1_piece_flanged"}
)
