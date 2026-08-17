#!/usr/bin/env bash
# Idempotent Nextcloud share lockdown (no public links / public uploads).
set -euo pipefail
COMPOSE_FILE="${COMPOSE_FILE:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/docker-compose.prod.yml}"
docker compose -f "${COMPOSE_FILE}" exec -T nextcloud php occ config:app:set core shareapi_allow_links --value=no
docker compose -f "${COMPOSE_FILE}" exec -T nextcloud php occ config:app:set core shareapi_allow_public_upload --value=no
echo "nextcloud public share APIs disabled"
