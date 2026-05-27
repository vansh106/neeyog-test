"""Hoses masters: replacement workbook sheet -> catalog key + supplier."""

HOSE_REPLACEMENT_FILENAME = "Hoses_Products (1).xlsx"

# (replacement worksheet name, API catalog_table key, supplier name for list prices)
HOSE_REPLACEMENT_SHEETS: list[tuple[str, str, str]] = [
    ("Tuder Hoses", "fp_hose_tuder", "Tuder"),
    ("PVC- Thunder Hoses Jyoti Make", "fp_hose_thunder", "Jyoti Sales"),
    ("PVC Nylon Braided – Non-Toxic J", "fp_hose_pvc_nylon_non_toxic", "Jyoti Sales"),
    ("PVC Nylon Braided-Food Grade Jy", "fp_hose_pvc_nylon_food_grade", "Jyoti Sales"),
    ("Red Silicon Hose Jyoti Make", "fp_hose_red_silicon", "Jyoti Sales"),
    ("PU Hose Jyoti Make", "fp_hose_pu", "Jyoti Sales"),
]

HOSE_CATALOG_KEYS: frozenset[str] = frozenset(k for _, k, _ in HOSE_REPLACEMENT_SHEETS)
