#!/usr/bin/env bash
# Convenience: start API from repo root (uses backend/ as cwd).
set -e
cd "$(dirname "$0")/backend"
exec uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
