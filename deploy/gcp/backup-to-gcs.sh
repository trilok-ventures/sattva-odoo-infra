#!/usr/bin/env bash
# Logical Odoo DB dump to the OpCo GCS bucket. Nextcloud RED files stay on the
# VM disk until the WORM slice — do not copy vault bytes to this bucket.
set -euo pipefail

PROJECT="${TRILOK_GCP_OPCO_PROJECT:-sattva-prod-ca}"
BUCKET="${TRILOK_GCP_BACKUP_BUCKET:-${PROJECT}-backups}"
COMPOSE_FILE="${COMPOSE_FILE:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../prod" && pwd)/docker-compose.prod.yml}"
STAMP="$(date -u +%F_%H%M)"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT

docker compose -f "${COMPOSE_FILE}" exec -T db \
  pg_dump -U odoo -d sattva -Fc > "${WORKDIR}/sattva_${STAMP}.dump"

gcloud storage cp "${WORKDIR}/sattva_${STAMP}.dump" "gs://${BUCKET}/odoo/"
echo "uploaded odoo dump ${STAMP} to gs://${BUCKET}/odoo/"
