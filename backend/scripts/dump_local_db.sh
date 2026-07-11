#!/bin/bash
# Dump the local PostgreSQL database before migrating to Supabase.
#
# Usage (from the backend/ directory):
#     bash scripts/dump_local_db.sh
#
# Requires:
#   - Docker running
#   - A container named "xyz_traders_postgres" (check with: docker ps)
#     Override with CONTAINER=<name> bash scripts/dump_local_db.sh

set -euo pipefail

CONTAINER="${CONTAINER:-xyz_traders_postgres}"
DB_USER="${DB_USER:-admin}"
DB_NAME="${DB_NAME:-quotation_system}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="./backups"
DUMP_FILE="${OUTPUT_DIR}/local_dump_${TIMESTAMP}.sql"
SCHEMA_FILE="${OUTPUT_DIR}/schema_only_${TIMESTAMP}.sql"

mkdir -p "${OUTPUT_DIR}"

echo "Dumping local PostgreSQL database from container '${CONTAINER}'..."

# Full dump (schema + data)
docker exec "${CONTAINER}" pg_dump \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-owner \
    --no-acl \
    -f /tmp/dump.sql

docker cp "${CONTAINER}:/tmp/dump.sql" "${DUMP_FILE}"

# Schema only
docker exec "${CONTAINER}" pg_dump \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-owner \
    --no-acl \
    --schema-only \
    -f /tmp/schema.sql

docker cp "${CONTAINER}:/tmp/schema.sql" "${SCHEMA_FILE}"

echo "Full dump:   ${DUMP_FILE}"
echo "Schema only: ${SCHEMA_FILE}"
echo "Done."
