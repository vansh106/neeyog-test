"""Hose fittings masters: replacement workbook sheet -> catalog key."""

FITTINGS_REPLACEMENT_FILENAME = "Fittings_Products (1).xlsx"
FITTINGS_SUPPLIER_NAME = "PVH"

# (replacement worksheet name, API catalog_table key)
FITTINGS_REPLACEMENT_SHEETS: list[tuple[str, str]] = [
    ("SMS Nut", "fp_fittings_sms_nut"),
    ("Tri-Clover End", "fp_fittings_tri_clover_end"),
    ("DIN Nut 11851", "fp_fittings_din_nut_11851"),
    ("Swivel Nut", "fp_fittings_swivel_nut"),
    ("Flange #150", "fp_fittings_flange_150"),
]

FITTINGS_CATALOG_KEYS: frozenset[str] = frozenset(k for _, k in FITTINGS_REPLACEMENT_SHEETS)
