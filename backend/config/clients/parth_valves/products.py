"""
Parth Valves — Product Category Definitions
Used for AI matching and form dropdowns.
"""

PRODUCT_CATEGORIES = {
    "butterfly_valve": {
        "display_name": "Butterfly Valve",
        "subcategories": [
            "wafer_type",
            "lug_type",
            "flanged_type",
        ],
        "common_materials": [
            "Aluminium",
            "Cast Iron", 
            "SS316",
            "SS304",
        ],
        "size_range_inch": [1, 1.5, 2, 2.5, 3, 4, 6, 8],
        "unit": "NOS",
    },
    "hose": {
        "display_name": "Hose",
        "subcategories": [
            "food_grade",
            "chemical_grade",
            "general_purpose",
        ],
        "common_materials": [
            "EPDM",
            "Nitrile",
            "PTFE",
            "PVC",
        ],
        "size_range_inch": [
            0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4
        ],
        "unit": "MTR",
    },
    "fitting": {
        "display_name": "End Fitting",
        "subcategories": [
            "sms_nut",
            "tc_end",
            "din_nut",
            "swivel_nut",
            "flange_end",
        ],
        "common_materials": [
            "SS316",
            "SS304",
        ],
        "size_range_inch": [0.5, 1, 1.5, 2, 2.5, 3, 4],
        "unit": "SET",
    },
}

# Inch to mm conversion map
SIZE_CONVERSIONS = {
    0.5:  13,
    0.75: 19,
    1.0:  25,
    1.5:  38,
    2.0:  51,
    2.5:  63.5,
    3.0:  76,
    4.0:  102,
    6.0:  152,
    8.0:  203,
}

def inch_to_mm(inch: float) -> float | None:
    return SIZE_CONVERSIONS.get(inch)

def mm_to_inch(mm: float) -> float | None:
    reverse = {v: k for k, v in SIZE_CONVERSIONS.items()}
    return reverse.get(mm)
