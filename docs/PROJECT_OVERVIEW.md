# Parth Valves CPQ — AI-Powered Quotation System

## Overview

An AI-powered Configure-Price-Quote (CPQ) system built for **Parth Valves and Hoses LLP**, an industrial manufacturing company. The system parses customer enquiry emails, matches products from a pricelist database, and automatically generates professional PDF quotations using AI agents.

**Version:** 1.0.0-mvp
**Stack:** Python 3.11+ / FastAPI / PostgreSQL / LangGraph / LiteLLM / ReportLab

---

## Architecture

### Layer Separation (Strict)

```
Router  →  Controller  →  Service  →  DB / AI Agents
```

| Layer       | Responsibility                         | Rules                                |
| ----------- | -------------------------------------- | ------------------------------------ |
| Router      | HTTP path + method + DI                | Single-line bodies calling controller |
| Controller  | Request/response shaping, error → HTTP | No DB queries, no business logic      |
| Service     | All business logic                     | No FastAPI imports, custom exceptions |
| Agents      | AI pipeline nodes                      | Stateless functions, LLM calls        |
| Orchestrator| LangGraph graph assembly + routing     | Connects agents into a pipeline       |

### Project Structure

```
backend/
├── api/
│   ├── main.py                     # FastAPI bootstrap, lifespan, CORS
│   └── routes/
│       ├── enquiries.py            # /api/enquiries/* routes
│       ├── quotations.py           # /api/quotations/* routes
│       └── masters.py              # /api/masters/* routes
├── controllers/
│   ├── enquiry_controller.py       # Pydantic models + handlers
│   ├── quotation_controller.py     # Pydantic models + handlers
│   └── masters_controller.py       # Product/config handlers
├── services/
│   ├── enquiry_service.py          # Enquiry business logic
│   ├── quotation_service.py        # Quotation retrieval + PDF lookup
│   ├── pdf_service.py              # ReportLab PDF generation
│   └── masters_service.py          # Product/config lookup
├── agents/
│   ├── state.py                    # EnquiryState TypedDict
│   ├── parser_agent.py             # Email → structured data
│   ├── matcher_agent.py            # Structured data → product matches
│   └── quote_agent.py              # Matches → quotation + PDF
├── orchestrator/
│   ├── router.py                   # Conditional edge routing functions
│   └── graph.py                    # LangGraph StateGraph assembly
├── config/
│   └── clients/
│       └── parth_valves/
│           ├── client.json         # Company info, rates, terms
│           ├── prompts.py          # LLM prompt templates
│           ├── flows.py            # Flow rules + confidence thresholds
│           └── products.py         # Product category definitions
├── core/
│   ├── config.py                   # Pydantic Settings (env vars)
│   ├── database.py                 # Async SQLAlchemy engine + session
│   ├── exceptions.py               # Custom exception classes
│   └── litellm_client.py          # LiteLLM wrapper with retry
├── db/
│   ├── models.py                   # SQLAlchemy ORM models
│   ├── seed.py                     # XLSX + demo data seeder
│   └── migrations/                 # Alembic migrations
├── masters/
│   ├── product_master.py           # Product data access functions
│   └── client_master.py            # Client config access
├── output/
│   └── pdfs/                       # Generated quotation PDFs
├── demo_runner.py                  # 4-flow demo script (httpx)
├── run_demo.sh                     # Shell wrapper for demo
├── requirements.txt                # Python dependencies
├── .env                            # Environment variables
└── .env.example                    # Template env file
```

---

## Infrastructure

| Service    | Technology       | Port  | Purpose                   |
| ---------- | ---------------- | ----- | ------------------------- |
| API        | FastAPI/Uvicorn  | 8000  | REST API                  |
| Database   | PostgreSQL 16    | 5433  | Persistent storage        |
| Cache      | Redis 7          | 6379  | Cache / future task queue |
| LLM        | Anthropic Claude | —     | AI text processing        |

All services run in Docker via `docker-compose.yml`.

---

## AI Agent Pipeline (LangGraph)

```
                    ┌──────────────┐
                    │  Parser Agent │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        [complete]   [incomplete]   [error]
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌───────┐
       │ Matcher   │  │ Missing  │  │ Error │
       │ Agent     │  │ Fields   │  │Handler│
       └────┬─────┘  └──────────┘  └───────┘
            │
    ┌───────┼───────┐
    ▼       ▼       ▼
[matched] [none]  [error]
    │       │       │
    ▼       ▼       ▼
┌───────┐  END   ┌───────┐
│ Quote │        │ Error │
│ Agent │        │Handler│
└───┬───┘        └───────┘
    │
    ▼
   END (PDF generated)
```

### Four Demo Flows

1. **Complete & Clear** — Full enquiry with sizes + quantities → PDF quotation
2. **Incomplete** — Missing size/quantity → clarification questions returned
3. **Ambiguous** — Vague product → AI recommends with reasoning, human review flag
4. **Not in Catalog** — Product not found → informational response, no PDF

---

## Database Models

| Table        | Purpose                                     |
| ------------ | ------------------------------------------- |
| `products`   | Product catalog (name, size, price, category)|
| `enquiries`  | Customer enquiry records + AI state         |
| `quotations` | Generated quotations with line items        |
| `users`      | System users (future auth)                  |
| `audit_logs` | All system actions for traceability         |

---

## API Endpoints

### Health
- `GET /health` — System status, active client, LLM model

### Enquiries
- `POST /api/enquiries/upload-email` — Submit email for AI processing
- `GET /api/enquiries/{id}` — Retrieve enquiry details
- `GET /api/enquiries/` — List enquiries (filter by status, flow_type)

### Quotations
- `GET /api/quotations/{id}` — Retrieve quotation details
- `GET /api/quotations/{id}/pdf` — Download quotation PDF
- `GET /api/quotations/` — List quotations

### Masters
- `GET /api/masters/products` — List products (filter by category)
- `GET /api/masters/products/{id}` — Get product details
- `GET /api/masters/client-config` — Get active client configuration

---

## Configuration

All configuration via environment variables (`.env` file):

| Variable              | Description                    | Default             |
| --------------------- | ------------------------------ | ------------------- |
| `DATABASE_URL`        | Async PostgreSQL connection    | —                   |
| `DATABASE_URL_SYNC`   | Sync PostgreSQL connection     | —                   |
| `REDIS_URL`           | Redis connection               | —                   |
| `LITELLM_MODEL`       | LLM model identifier           | claude-sonnet-4-6 |
| `ANTHROPIC_API_KEY`   | Anthropic API key              | —                   |
| `ACTIVE_CLIENT`       | Client config to use           | parth_valves        |
| `CONFIDENCE_THRESHOLD`| AI confidence threshold        | 0.85                |
| `PDF_OUTPUT_DIR`      | Directory for generated PDFs   | ./output/pdfs       |

---

## Quick Start

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Set your API key in .env
#    ANTHROPIC_API_KEY=sk-ant-...

# 3. Run database migrations
cd backend
alembic upgrade head

# 4. Start the API (must run from backend/ so `import api` works)
cd backend
uvicorn api.main:app --reload --port 8000
# Or from repo root: ./run_api.sh

# Optional — run API in Docker (logs: docker compose logs -f api)
# cd backend && docker compose up -d --build

# 5. Run the demo
python demo_runner.py
```

---

## Key Design Decisions

1. **Client-specific configuration** — All prompts, flow rules, and company details are isolated per client under `config/clients/{name}/`. Adding a new client means adding a new folder.

2. **LangGraph for orchestration** — Provides stateful, resumable agent pipelines with built-in checkpointing. Supports future human-in-the-loop via `interrupt_before`.

3. **LiteLLM abstraction** — Wraps any LLM provider (currently Anthropic). Swap models by changing one env var.

4. **ReportLab PDFs** — Pure Python PDF generation, no external dependencies like wkhtmltopdf.

5. **Async everywhere** — FastAPI + asyncpg + async SQLAlchemy for non-blocking I/O throughout.

6. **No direct service → FastAPI coupling** — Services never import from FastAPI, making them independently testable.

---

## What's Built (Prompts 1–4)

| Prompt | Scope                                                    | Status |
| ------ | -------------------------------------------------------- | ------ |
| 1      | Folder structure, Docker, models, Alembic, config        | Done   |
| 2      | LiteLLM, prompts, flows, seeder, product master, FastAPI | Done   |
| 3      | LangGraph agents, orchestrator, state, router            | Done   |
| 4      | PDF service, controllers, routes, demo runner, docs      | Done   |

---

## Future Enhancements

- Swap `MemorySaver` → `PostgresSaver` for persistent LangGraph checkpoints
- Enable `interrupt_before=["human_review"]` for human-in-the-loop approval
- Add pgvector embeddings for semantic product search
- Email ingestion via IMAP or webhook
- User authentication and role-based access
- Frontend dashboard (React/Next.js)
- Celery task queue for async processing
- Multi-client deployment
