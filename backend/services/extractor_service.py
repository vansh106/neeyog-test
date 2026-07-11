"""Run the LangGraph product extractor with live SSE agent activity."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from agents.extractor.graph import get_extractor_graph
from core.database import async_session_factory
from db.models import Enquiry
from services.sse_service import (
    SSEEventEmitter,
    evt_agent_error,
    register_emitter,
    remove_emitter,
)

logger = logging.getLogger(__name__)


async def run_extract_stream(
    enquiry_id: str,
    emitter: SSEEventEmitter,
    *,
    db: Any = None,  # unused — kept for call-site compat; work uses its own session
) -> None:
    """Execute the extractor graph and stream agent events via ``emitter``."""
    del db  # request-scoped session must not outlive the HTTP handler
    eid = str(enquiry_id)
    register_emitter(eid, emitter)
    try:
        try:
            eid_uuid = uuid.UUID(eid)
        except ValueError as exc:
            await emitter.emit(evt_agent_error("system", f"Invalid enquiry id: {exc}"))
            return

        async with async_session_factory() as session:
            enquiry = await session.get(Enquiry, eid_uuid)
            if enquiry is None:
                await emitter.emit(evt_agent_error("system", "Enquiry not found"))
                return
            pd = enquiry.parsed_data if isinstance(enquiry.parsed_data, dict) else {}
            initial: dict[str, Any] = {
                "enquiry_id": eid,
                "raw_input": (enquiry.raw_input or "").strip(),
                "client_company": str(pd.get("client_company") or "").strip() or None,
                "client_name": str(pd.get("client_name") or "").strip() or None,
            }

        graph = get_extractor_graph()
        await graph.ainvoke(initial)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Extractor graph failed for %s", eid)
        try:
            await emitter.emit(evt_agent_error("system", f"Extractor failed: {exc}"))
        except Exception:  # noqa: BLE001
            pass
    finally:
        remove_emitter(eid)
        await emitter.done()
