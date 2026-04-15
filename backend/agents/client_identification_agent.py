"""Agent: client identification (new vs existing) before quoting."""

import logging

from agents.state import EnquiryState, emit
from core.database import async_session_factory
from services.client_service import lookup_client
from services.sse_service import evt_agent_complete, evt_agent_start

logger = logging.getLogger(__name__)


async def client_identification_agent(state: EnquiryState) -> EnquiryState:
    await emit(
        state,
        evt_agent_start(
            agent="client_id",
            message="Checking client database",
            detail="Looking up client in our records",
        ),
    )

    parsed = state.get("parsed_data") or {}
    extracted = {
        "company_name": parsed.get("client_company"),
        "contact_name": parsed.get("client_name"),
        "email": parsed.get("client_email"),
        "phone": parsed.get("client_phone"),
        "city": parsed.get("city") or parsed.get("location"),
        "country": parsed.get("country") or "India",
    }

    async with async_session_factory() as db:
        existing = await lookup_client(
            company_name=extracted.get("company_name"),
            email=extracted.get("email"),
            phone=extracted.get("phone"),
            db=db,
        )

    if existing:
        await emit(
            state,
            evt_agent_complete(
                agent="client_id",
                message=f"Existing client found: {existing.company_name}",
                data={
                    "client_is_new": False,
                    "matched_client": existing.company_name,
                    "erp_synced": existing.is_erp_synced,
                    "erp_code": existing.erp_code,
                },
            ),
        )
        return {
            **state,
            "extracted_client": extracted,
            "client_is_new": False,
            "matched_client_id": str(existing.id),
            "matched_client_data": {
                "id": str(existing.id),
                "company_name": existing.company_name,
                "contact_name": existing.contact_name,
                "email": existing.email,
                "phone": existing.phone,
                "city": existing.city,
                "country": existing.country,
                "erp_code": existing.erp_code,
                "is_erp_synced": existing.is_erp_synced,
            },
        }

    # MVP: treat as new when not found in our DB.
    # TODO: Add ERP client master lookup here and merge results.
    await emit(
        state,
        evt_agent_complete(
            agent="client_id",
            message="New client detected",
            data={"client_is_new": True, "company_name": extracted.get("company_name")},
        ),
    )
    return {
        **state,
        "extracted_client": extracted,
        "client_is_new": True,
        "matched_client_id": None,
        "matched_client_data": None,
    }

