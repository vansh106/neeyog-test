"""Needle valve, sight glass, and strainer replacement workbooks."""

NEEDLE_REPLACEMENT_FILENAME = "Needle_Valve_Products (1).xlsx"
NEEDLE_REPLACEMENT_SHEETS: list[tuple[str, str]] = [
    ("Needle Valve Aster Make", "fp_needle_valve"),
]
NEEDLE_SUPPLIER_NAME = "Aster"

SIGHT_GLASS_REPLACEMENT_FILENAME = "Sight_Glass_Products (1).xlsx"
SIGHT_GLASS_REPLACEMENT_SHEETS: list[tuple[str, str]] = [
    ("Double Window Sight Glass", "fp_sight_glass_double_window"),
    ("In-Line SG – IC Casted", "fp_sight_glass_inline_ic_casted"),
    ("In-Line SG – Solid Flange", "fp_sight_glass_inline_solid_flange"),
]
SIGHT_GLASS_SUPPLIER_NAME = "Casco"

STRAINER_REPLACEMENT_FILENAME = "Strainer_Products (1).xlsx"
STRAINER_SHEET_NAME = "Y- Strainer "
STRAINER_Y150_KEY = "fp_strainer_y_150"
STRAINER_Y300_KEY = "fp_strainer_y_300"
STRAINER_SUPPLIER_NAME = "Casco"

NEEDLE_SIGHT_STRAINER_CATALOG_KEYS: frozenset[str] = frozenset(
    [k for _, k in NEEDLE_REPLACEMENT_SHEETS]
    + [k for _, k in SIGHT_GLASS_REPLACEMENT_SHEETS]
    + [STRAINER_Y150_KEY, STRAINER_Y300_KEY]
)
