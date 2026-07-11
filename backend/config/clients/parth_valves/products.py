"""Product catalog definitions are intentionally empty until new masters are added."""

PRODUCT_CATEGORIES = {}

SIZE_CONVERSIONS = {}

def inch_to_mm(inch: float) -> float | None:
    return SIZE_CONVERSIONS.get(inch)

def mm_to_inch(mm: float) -> float | None:
    reverse = {v: k for k, v in SIZE_CONVERSIONS.items()}
    return reverse.get(mm)
