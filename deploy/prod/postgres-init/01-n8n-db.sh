#!/bin/bash
set -euo pipefail
if [ -z "${N8N_DB_PASSWORD:-}" ]; then
  echo "N8N_DB_PASSWORD is required" >&2
  exit 1
fi
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=n8npass="${N8N_DB_PASSWORD}" <<'EOSQL'
CREATE USER n8n WITH PASSWORD :'n8npass';
CREATE DATABASE n8n OWNER n8n;
EOSQL
