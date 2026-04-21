## What Was Removed
- agents/parser_agent.py
- agents/matcher_agent.py
- agents/quote_agent.py
- agents/human_review_node.py
- agents/hitl_router_agent.py
- agents/email_composer_agent.py
- agents/send_node.py
- agents/client_identification_agent.py
- agents/client_hitl_node.py
- agents/client_hitl_router.py
- agents/state.py
- orchestrator/graph.py
- orchestrator/router.py
- HITLDecisionRequest, HITLStateResponse models
- ClientHITLDecisionRequest model
- HITL and client-verify API routes
- LangGraph graph compilation and invocation
- agent_state, client_verification_status DB fields

## What Was Cleaned to Stubs
- services/enquiry_service.process_enquiry()
  → returns "received" immediately
- config/clients/parth_valves/prompts.py
  → clean prompt templates ready for new agents
- config/clients/parth_valves/flows.py
  → clean configuration constants
- config/clients/parth_valves/products.py
  → clean product category definitions + size conversions
- components/upload/HITLPanel.tsx
  → placeholder UI
- components/upload/ClientVerificationPanel.tsx
  → returns null

## What Is Fully Working
✅ Admin panel + user management  
✅ Masters (product catalog viewing)  
✅ Manual dropdown form (ManualEntryForm)  
✅ Email sync (IMAP scheduler)  
✅ SSE infrastructure  
✅ Global event bus (wired, ready)  
✅ Email inbox tab  
✅ Enquiry creation and listing  
✅ PDF service (ready for new agents)  
✅ Full router/controller/service structure  

## Ready for New Agent Build
- agents/ directory is empty (only __init__.py)
- orchestrator/ directory is empty (only __init__.py)
- prompts.py has clean templates
- process_enquiry() stub is the integration point
- SSE emitter infrastructure is ready
- DB Enquiry model is clean

## Integration Point for New Agents
When rebuilding agents, the entry point is:
  services/enquiry_service.process_enquiry()
  
Replace the stub body with:
  result = await run_new_enquiry_flow(
      enquiry_id, raw_input, input_type, emitter
  )
  return result

That one function call is the only 
connection between the API layer and 
whatever new agent system gets built.

## Notes
- A migration was generated and applied to remove agent-only columns from `enquiries` and add:
  - `processing_started_at`
  - `processing_completed_at`
- Frontend pages that previously imported the old client verification UI were updated to match the new placeholders.
