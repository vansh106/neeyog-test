"""Static matrix specification for Dampers family (no combination rows)."""

from __future__ import annotations

from typing import Any, Literal

DAMPER_CATALOG_PREFIX = "fp_damper_"

BUTTERFLY_DAMPER_KEY = "fp_damper_butterfly"
MULTI_LOUVER_DAMPER_KEY = "fp_damper_multi_louver"

DAMPER_SHEET_KEYS = frozenset({BUTTERFLY_DAMPER_KEY, MULTI_LOUVER_DAMPER_KEY})

STRUCTURAL_MOC = [
    "IS 2062",
    "SS 304",
    "SS 316",
    "SS 304L",
    "SS 316L",
    "SA 516 GR.70",
    "SA 387",
    "SS 310",
    "SS 321",
]

STRUCTURAL_THK_MM = [
    "1.5",
    "3",
    "4",
    "5",
    "6",
    "8",
    "10",
    "12",
    "16",
    "18",
    "20",
    "25",
]

SHAFT_MOC = [
    "IS 2062",
    "SS 304",
    "SS 316",
    "SS 304L",
    "SS 316L",
    "SA 387",
    "SS 310",
    "SS 321",
    "SS 410",
    "EN 8",
    "17-4PH",
    "EN 19",
]

SEALING_MOC = [
    "Silicon",
    "EPDM",
    "Nitrile",
    "Metal to Metal",
    "Ceramic Braided Rope",
    "Ceramic Flat",
]

GLAND_PACKING_MOC = [
    "Ceramic Braided Rope",
    "Graphite Braided Rope",
    "PTFE",
    "Graphite",
]

BEARING_OPTIONS = ["UCF", "UCFL", "Brass Bush", "Ceramic Bush", "N/A"]

FLANGE_GASKET_MOC = ["Silicon", "EPDM", "Nitrile", "Ceramic Flat"]

FLANGE_HARDWARE_MOC = ["SS 304", "SS 316", "GR.8.8", "GR.4.6"]

DUTY_OPTIONS = ["ON/OFF", "Regulating", "Inching"]

BLADE_COUNT_OPTIONS = [str(n) for n in range(2, 14)]

BLADE_ACTION_OPTIONS = ["Parallel Blade", "Opposed Blade"]


def is_damper_catalog_key(key: str | None) -> bool:
    return bool(key and key.startswith(DAMPER_CATALOG_PREFIX))


def damper_sheet_label(catalog_key: str) -> str:
    if catalog_key == BUTTERFLY_DAMPER_KEY:
        return "Butterfly Damper"
    if catalog_key == MULTI_LOUVER_DAMPER_KEY:
        return "Multi-Louver Damper"
    return catalog_key.replace("_", " ").title()


def _field(
    key: str,
    label: str,
    *,
    group: str | None = None,
    sub_label: str | None = None,
    input_type: Literal["select", "manual"] = "select",
    options: list[str] | None = None,
    required: bool | None = None,
) -> dict[str, Any]:
    if required is None:
        required = input_type == "select"
    return {
        "key": key,
        "label": label,
        "group": group,
        "sub_label": sub_label,
        "input_type": input_type,
        "options": options or [],
        "required": required,
    }


def _structural_pair(prefix: str, group: str) -> list[dict[str, Any]]:
    return [
        _field(f"{prefix}_moc", group, group=group, sub_label="MOC", options=STRUCTURAL_MOC),
        _field(f"{prefix}_thk_mm", group, group=group, sub_label="Thk.", options=STRUCTURAL_THK_MM),
    ]


def _shared_body_fields() -> list[dict[str, Any]]:
    return [
        *_structural_pair("housing", "Housing"),
        *_structural_pair("flange", "Flange"),
        *_structural_pair("flap", "Flap"),
        _field("shaft_moc", "Shaft", group="Shaft", sub_label="MOC", options=SHAFT_MOC),
        _field("shaft_dia", "Shaft", group="Shaft", sub_label="Dia.", input_type="manual", required=False),
        *_structural_pair("brackets", "Brackets"),
        _field("sealing_moc", "Sealing", group="Sealing", sub_label="MOC", options=SEALING_MOC),
        _field(
            "gland_packing_moc",
            "Gland Packing",
            group="Gland Packing",
            sub_label="MOC",
            options=GLAND_PACKING_MOC,
        ),
        _field("bearing", "Bearing", options=BEARING_OPTIONS),
        _field(
            "flange_gasket_moc",
            "Flange Gasket",
            group="Flange Gasket",
            sub_label="MOC",
            options=FLANGE_GASKET_MOC,
        ),
        _field(
            "flange_hardware_moc",
            "Flange Hardware",
            group="Flange Hardware",
            sub_label="MOC",
            options=FLANGE_HARDWARE_MOC,
        ),
        _field("duty", "Duty", options=DUTY_OPTIONS),
        _field("note", "Note", input_type="manual", required=False),
    ]


def damper_fields_for_key(catalog_key: str) -> list[dict[str, Any]]:
    if catalog_key == BUTTERFLY_DAMPER_KEY:
        return [
            _field("size", "Size", input_type="manual", required=False),
            *_shared_body_fields(),
        ]
    if catalog_key == MULTI_LOUVER_DAMPER_KEY:
        return [
            _field("size", "Size", input_type="manual", required=False),
            _field("number_of_blades", "Number of Blades", options=BLADE_COUNT_OPTIONS),
            _field("blade_action", "Blade Action", options=BLADE_ACTION_OPTIONS),
            *_shared_body_fields(),
        ]
    return []


def get_damper_full_schema(catalog_key: str) -> dict[str, Any]:
    return {
        "catalog_key": catalog_key,
        "damper_type": damper_sheet_label(catalog_key),
        "label": damper_sheet_label(catalog_key),
        "fields": damper_fields_for_key(catalog_key),
        "has_catalog_price": False,
    }


def list_damper_sheets() -> list[dict[str, str]]:
    return [
        {"key": BUTTERFLY_DAMPER_KEY, "label": "Butterfly Damper"},
        {"key": MULTI_LOUVER_DAMPER_KEY, "label": "Multi-Louver Damper"},
    ]
