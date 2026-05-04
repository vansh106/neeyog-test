from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from core.auth_middleware import CurrentUser, get_current_user
from services.global_event_bus import global_bus

router = APIRouter(prefix="/api/stream", tags=["streaming"])


@router.get("/global-events")
async def global_events_stream(
    _user: CurrentUser = Depends(get_current_user),
):
    """
    Persistent SSE endpoint for global events.
    Frontend connects once and stays connected.
    """
    sub_id, queue = global_bus.subscribe()

    import json

    async def startup_then_stream():
        yield f"data: {json.dumps({'type': 'connected', 'subscriber_id': sub_id})}\n\n"
        async for s in global_bus.stream(sub_id, queue):
            yield s

    return StreamingResponse(
        startup_then_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Connection": "keep-alive",
        },
    )
