#!/usr/bin/env bash
# Render deploy/prod/.env and origin certs from AssetCo Secret Manager.
# Prints names, never values.
set -euo pipefail

log() { echo "$*" >&2; }

ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"
PROD_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../prod" && pwd)"
OUT="${1:-${PROD_DIR}/.env}"
CERT_DIR="${PROD_DIR}/certs"

if ! command -v gcloud >/dev/null 2>&1; then
  log "gcloud is not installed."
  exit 1
fi

fetch() {
  local secret_id="$1"
  gcloud secrets versions access latest --secret="${secret_id}" --project="${ASSET}"
}

umask 077
TMP="$(mktemp)"
{
  printf 'POSTGRES_PASSWORD=%s\n' "$(fetch odoo-db-password)"
  printf 'ODOO_ADMIN_PASSWD=%s\n' "$(fetch odoo-admin-passwd)"
  printf 'N8N_ENCRYPTION_KEY=%s\n' "$(fetch n8n-encryption-key)"
  printf 'N8N_WEBHOOK_HMAC=%s\n' "$(fetch n8n-webhook-hmac)"
  printf 'N8N_DB_PASSWORD=%s\n' "$(fetch n8n-db-password)"
  printf 'NEXTCLOUD_ADMIN_USER=%s\n' "${NEXTCLOUD_ADMIN_USER:-admin}"
  printf 'NEXTCLOUD_ADMIN_PASSWORD=%s\n' "$(fetch nextcloud-admin-password)"
  printf 'NEXTCLOUD_N8N_USER=%s\n' "${NEXTCLOUD_N8N_USER:-n8n.vault}"
  printf 'ODOO_N8N_UID=%s\n' "${ODOO_N8N_UID:-}"
  printf 'ACME_EMAIL=%s\n' "${ACME_EMAIL:-admin@trilokventures.org}"
} > "${TMP}"
mv "${TMP}" "${OUT}"
chmod 600 "${OUT}"

mkdir -p "${CERT_DIR}"
fetch origin-tls-cert > "${CERT_DIR}/origin.pem"
fetch origin-tls-key > "${CERT_DIR}/origin.key"
chmod 600 "${CERT_DIR}/origin.key"
chmod 644 "${CERT_DIR}/origin.pem"

log "Wrote ${OUT} and ${CERT_DIR}/origin.{pem,key} (mode 600 on secrets). Values not logged."
log "Set ODOO_N8N_UID in ${OUT} after creating Odoo user n8n.fabric (do not use admin uid 2)."
