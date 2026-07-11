"""Butterfly valve masters: nav slug -> catalog ``source_file`` label."""

BUTTERFLY_NAV_SOURCE_FILE: dict[str, str] = {
    "hygienic-alfa-laval": "Hygienic Butterfly Valve Alfa Laval Make.xlsx",
    "hygienic-pvh": "Hygienic Butterfly Valve PVH Make.xlsx",
    "aluminium-pvh": "Aluminium Butterfly Valve PVH Make.xlsx",
    "industrial-omval": "Industrial Butterfly Valve Omval Make.xlsx",
    "industrial-delval": "Industrial Butterfly Valve Delval Make.xlsx",
}

BUTTERFLY_SHEET_SOURCE_FILES: frozenset[str] = frozenset(BUTTERFLY_NAV_SOURCE_FILE.values())
