#!/usr/bin/env bash
# Create the n8n editor owner from AssetCo n8n-owner-password.
# Does not print the secret. Does not edit workflow JSON in the UI.
#
#   sudo ./deploy/gcp/create-n8n-owner.sh
set -euo pipefail

log() { echo "$*" >&2; }

ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"
SECRET_ID="${N8N_OWNER_SECRET:-n8n-owner-password}"
N8N="${N8N_CONTAINER:-sattva-prod-n8n}"
EMAIL="${OPERATOR_EMAIL:-archneo@trilokventures.org}"

if ! docker inspect "${N8N}" >/dev/null 2>&1; then
  log "missing container ${N8N}"
  exit 1
fi

# n8n 2.x has no user:create. If an owner already exists, do not reset it.
if docker exec sattva-prod-db psql -U n8n -d n8n -tAc \
  "SELECT email FROM \"user\" WHERE \"roleSlug\" = 'global:owner' AND NOT disabled" \
  | grep -q .; then
  log "n8n owner already exists; not resetting. Use the password set in the editor."
  log "AssetCo ${SECRET_ID} is only for a future reset you run on purpose."
  exit 0
fi

if [[ -z "${N8N_OWNER_PASSWORD:-}" ]]; then
  if ! command -v gcloud >/dev/null 2>&1; then
    log "set N8N_OWNER_PASSWORD or run where gcloud can read ${SECRET_ID}"
    exit 1
  fi
  N8N_OWNER_PASSWORD="$(gcloud secrets versions access latest --secret="${SECRET_ID}" --project="${ASSET}")"
fi

if [[ -z "${N8N_OWNER_PASSWORD}" ]]; then
  log "empty ${SECRET_ID}"
  exit 1
fi

# n8n 2.x: user:create is idempotent-ish; duplicate email should fail softly.
if docker exec "${N8N}" n8n --help 2>/dev/null | grep -q "user:create"; then
  docker exec -e N8N_OWNER_PASSWORD -e EMAIL "${N8N}" sh -c \
    'n8n user:create --email "$EMAIL" --firstName Arch --lastName Neo --role global:owner --password "$N8N_OWNER_PASSWORD"' \
    && log "n8n owner created for ${EMAIL}. Password not logged." \
    || log "n8n user:create failed (owner may already exist). Password not logged."
else
  log "This n8n image has no user:create. Complete owner setup in the editor once."
  log "Then store that password as AssetCo ${SECRET_ID}."
  exit 2
fi
