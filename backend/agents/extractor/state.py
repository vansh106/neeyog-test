"""LangGraph state for the centralized product extractor."""

from __future__ import annotations

from typing import Any, TypedDict


class ExtractedDemandItem(TypedDict, total=False):
    product_description: str
    catalog_key: str | None
    variant_type: str | None
    size_hint: str | None
    quantity: int | None
    keywords: list[str]
    confidence: float


class CatalogMatchLine(TypedDict, total=False):
    index: int
    quantity: int
    catalog_key: str
    variant_type: str | None
    nav_slug: str | None
    product_label: str | None
    filled_cascade: dict[str, str]
    match_confidence: float
    match_reason: str
    matched: bool


class ExtractorState(TypedDict, total=False):
    enquiry_id: str
    raw_input: str
    client_company: str | None
    client_name: str | None

    # parse_demand output
    demand_items: list[ExtractedDemandItem]
    parse_notes: str | None
    parse_confidence: float

    # match_catalog output
    match_lines: list[CatalogMatchLine]
    primary_catalog_key: str | None
    overall_confidence: float
    product_completeness: str

    # persist output
    matcher_payload: dict[str, Any]
    products_requested: list[dict[str, Any]]
    ai_reasoning: list[str]
    error: str | None
