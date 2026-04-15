"""Server-Sent Events (SSE) infrastructure for real-time agent streaming.

Each request gets its own SSEEventEmitter. Agents push events into
the queue; the SSE generator reads them out as text/event-stream lines.
"""

import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncGenerator

# Module-level registry — keyed by enquiry_id
# Emitters live here, NOT in LangGraph state (checkpointer cannot serialize Queue).
_active_emitters: dict[str, "SSEEventEmitter"] = {}


def register_emitter(enquiry_id: str, emitter: "SSEEventEmitter") -> None:
    """Call this before starting the graph."""
    _active_emitters[str(enquiry_id)] = emitter


def get_emitter(enquiry_id: str) -> "SSEEventEmitter | None":
    """Called by agents to get their emitter."""
    return _active_emitters.get(str(enquiry_id))


def remove_emitter(enquiry_id: str) -> None:
    """Call this when the stream ends."""
    _active_emitters.pop(str(enquiry_id), None)


class SSEEventEmitter:
    """Per-request queue: agents put events, StreamingResponse reads them."""

    def __init__(self) -> None:
        self.queue: asyncio.Queue[dict | None] = asyncio.Queue()

    async def emit(self, event: dict) -> None:
        event.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        await self.queue.put(event)

    async def done(self) -> None:
        await self.queue.put(None)

    async def stream(self) -> AsyncGenerator[str, None]:
        while True:
            event = await self.queue.get()
            if event is None:
                yield _format_sse({"type": "stream_end", "timestamp": datetime.now(timezone.utc).isoformat()})
                break
            yield _format_sse(event)
            # Yield to the event loop so ASGI can flush this chunk before the next agent step.
            await asyncio.sleep(0)


def _format_sse(data: dict) -> str:
    return f"data: {json.dumps(data, default=str)}\n\n"


# ── Event builder helpers ──────────────────────────────────


def evt_agent_start(agent: str, message: str, detail: str = "") -> dict:
    return {"type": "agent_start", "agent": agent, "message": message, "detail": detail, "status": "running"}


def evt_agent_complete(agent: str, message: str, data: dict | None = None) -> dict:
    return {"type": "agent_complete", "agent": agent, "message": message, "data": data or {}, "status": "done"}


def evt_agent_warning(agent: str, message: str, detail: str = "") -> dict:
    return {"type": "agent_warning", "agent": agent, "message": message, "detail": detail, "status": "warning"}


def evt_agent_error(agent: str, message: str) -> dict:
    return {"type": "agent_error", "agent": agent, "message": message, "status": "error"}


def evt_result(result: dict) -> dict:
    return {"type": "result", "status": "complete", "data": result}
