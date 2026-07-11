"""Compile the centralized LangGraph product extractor."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from langgraph.graph import END, START, StateGraph

from agents.extractor.nodes import load_context, match_catalog, parse_demand, persist_result
from agents.extractor.state import ExtractorState

_graph = None


def build_extractor_graph() -> Any:
    g = StateGraph(ExtractorState)
    g.add_node("load_context", load_context)
    g.add_node("parse_demand", parse_demand)
    g.add_node("match_catalog", match_catalog)
    g.add_node("persist_result", persist_result)

    g.add_edge(START, "load_context")
    g.add_edge("load_context", "parse_demand")
    g.add_edge("parse_demand", "match_catalog")
    g.add_edge("match_catalog", "persist_result")
    g.add_edge("persist_result", END)
    return g.compile()


@lru_cache(maxsize=1)
def get_extractor_graph() -> Any:
    return build_extractor_graph()
