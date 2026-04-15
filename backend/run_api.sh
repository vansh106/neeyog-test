#!/usr/bin/env bash
# Run FastAPI from backend/ so `api` package resolves (fixes ModuleNotFoundError from repo root).
set -e
cd "$(dirname "$0")"
exec uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
