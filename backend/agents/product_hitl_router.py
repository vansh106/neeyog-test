"""Router node executed after product completion HITL resumes."""

from agents.state import EnquiryState


async def product_hitl_router(state: EnquiryState) -> EnquiryState:
    # This node itself does not mutate state; routing is done by orchestrator.router.
    return state

