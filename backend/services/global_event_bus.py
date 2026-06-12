import asyncio
import json
import uuid
from datetime import datetime
from typing import AsyncGenerator


class GlobalEventBus:
    """
    In-memory pub/sub for broadcasting events to all connected frontend clients.

    Each connected browser tab gets its own asyncio.Queue. When an event is published,
    it is put into EVERY queue simultaneously.
    """

    def __init__(self) -> None:
        self._subscribers: dict[str, asyncio.Queue] = {}

    def subscribe(self) -> tuple[str, asyncio.Queue]:
        sub_id = str(uuid.uuid4())
        queue = asyncio.Queue(maxsize=100)
        self._subscribers[sub_id] = queue
        return sub_id, queue

    def unsubscribe(self, subscriber_id: str) -> None:
        self._subscribers.pop(subscriber_id, None)

    async def publish(self, event: dict) -> None:
        event["timestamp"] = datetime.utcnow().isoformat()
        event["bus"] = True

        dead: list[str] = []
        for sub_id, queue in list(self._subscribers.items()):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Slow client — drop this event for them.
                pass
            except Exception:
                dead.append(sub_id)

        for sub_id in dead:
            self.unsubscribe(sub_id)

    async def stream(self, subscriber_id: str, queue: asyncio.Queue) -> AsyncGenerator[str, None]:
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(event, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield 'data: {"type":"heartbeat"}\n\n'
        except asyncio.CancelledError:
            pass
        finally:
            self.unsubscribe(subscriber_id)


global_bus = GlobalEventBus()


async def broadcast_new_email(
    enquiry_id: str,
    sender_name: str,
    sender_email: str,
    subject: str,
    raw_email: str,
    input_type: str = "email_sync",
    mailbox_id: str | None = None,
    mailbox_label: str | None = None,
    enquiry_number: str | None = None,
) -> None:
    payload: dict = {
        "type": "new_email_received",
        "enquiry_id": enquiry_id,
        "sender_name": sender_name,
        "sender_email": sender_email,
        "subject": subject,
        "preview": (raw_email or "")[:120] + "...",
        "input_type": input_type,
        "status": "pending_email_approval" if (input_type or "").strip().lower() in ("email", "email_sync", "indiamart") else "received",
    }
    if enquiry_number:
        payload["enquiry_number"] = enquiry_number
    if mailbox_id:
        payload["mailbox_id"] = mailbox_id
    if mailbox_label:
        payload["mailbox_label"] = mailbox_label
    await global_bus.publish(payload)


async def broadcast_agent_event(enquiry_id: str, event: dict) -> None:
    await global_bus.publish({**event, "enquiry_id": enquiry_id})


async def broadcast_enquiry_status_change(
    enquiry_id: str,
    new_status: str,
    flow_type: str | None = None,
    client_name: str | None = None,
    message: str = "",
) -> None:
    await global_bus.publish(
        {
            "type": "enquiry_status_changed",
            "enquiry_id": enquiry_id,
            "status": new_status,
            "flow_type": flow_type,
            "client_name": client_name,
            "message": message,
        }
    )

