"""Centralized LangGraph product extractor for enquiry demand identification.

Architecture (end-to-end)
========================

  Enquiry detail UI
       │  POST /api/enquiries/{id}/extract-stream  (SSE)
       ▼
  extractor_service.run_extract_stream
       │  register SSE emitter (sse_service)
       ▼
  agents.extractor.graph  (LangGraph StateGraph)
       │
       ├─ load_context     → read enquiry.raw_input / notes
       ├─ parse_demand     → LLM (LiteLLM) extracts structured product asks
       ├─ match_catalog    → score against Packaging masters (foil / paper)
       └─ persist_result   → write parsed_data.matcher + products_requested
       │
       ▼
  SSE events (agent_start / agent_complete / result)
       │
       ▼
  LiveAgentTimeline + ManualEntryForm matcherSeed

All LLM calls go through ``core.litellm_client.llm_client``.
Catalog matching is deterministic over masters rows; the LLM only
interprets free-text demand into structured hints.
"""

from agents.extractor.graph import build_extractor_graph, get_extractor_graph

__all__ = ["build_extractor_graph", "get_extractor_graph"]
