"""Terminal node — logs approval intent. Email sending wired in production."""

import logging

from sqlalchemy import select

from agents.state import EnquiryState, emit
from core.database import async_session_factory
from db.models import Enquiry

logger = logging.getLogger(__name__)


async def send_node(state: EnquiryState) -> EnquiryState:
    enquiry_id = state.get("enquiry_id", "unknown")
    parsed_data = state.get("parsed_data") or {}
    client = parsed_data.get("client_name", "client")
    has_quote = state.get("quotation_data") is not None
    quote_data = state.get("quotation_data") or {}

    if has_quote:
        message = f"Quotation approved — ready to send to {client}"
        detail = f"Quote: {quote_data.get('quote_number')} | Email send: configured in next version"
    else:
        message = f"Follow-up email approved — ready to send to {client}"
        detail = "Email send: configured in next version"

    await emit(state, {
        "type": "approved_and_sent",
        "agent": "send_node",
        "message": message,
        "detail": detail,
        "status": "done",
        "data": {
            "quote_number": quote_data.get("quote_number"),
            "client_name": client,
            "email_send_configured": False,
        },
    })

    async with async_session_factory() as session:
        result = await session.execute(select(Enquiry).where(Enquiry.id == enquiry_id))
        enquiry = result.scalar_one_or_none()
        if enquiry:
            enquiry.status = "approved"
            await session.commit()

    reasoning = list(state.get("ai_reasoning", []))
    reasoning.append(f"SendNode: approved by human — {'quotation' if has_quote else 'email'} ready to send")

    return {
        **state,
        "current_step": "approved_sent",
        "awaiting_human": False,
        "ai_reasoning": reasoning,
    }
