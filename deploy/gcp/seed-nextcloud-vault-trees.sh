#!/usr/bin/env bash
# Seed the fabric §5.3 Nextcloud folder convention for admin and n8n.vault.
# Does not enable public shares. Does not create a second admin.
# Does not upload COA PDFs or named supplier/buyer folders.
set -euo pipefail

log() { echo "$*" >&2; }
NC="${NEXTCLOUD_CONTAINER:-sattva-prod-nextcloud}"
VAULT_USER="${NEXTCLOUD_N8N_USER:-n8n.vault}"
ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"

if ! docker inspect "${NC}" >/dev/null 2>&1; then
  log "missing container ${NC}"
  exit 1
fi

if ! docker exec "${NC}" php occ user:info "${VAULT_USER}" >/dev/null 2>&1; then
  if [[ -z "${OC_PASS:-}" ]] && command -v gcloud >/dev/null 2>&1; then
    OC_PASS="$(gcloud secrets versions access latest --secret=nextcloud-n8n-app-password --project="${ASSET}")"
  fi
  if [[ -z "${OC_PASS:-}" ]]; then
    log "missing ${VAULT_USER}; set OC_PASS or run where gcloud can read nextcloud-n8n-app-password"
    exit 1
  fi
  docker exec -e OC_PASS "${NC}" php occ user:add \
    --password-from-env --display-name="${VAULT_USER}" "${VAULT_USER}"
  unset OC_PASS
  log "Created Nextcloud user ${VAULT_USER}. Password not logged."
fi

docker exec -i -e VAULT_USER="${VAULT_USER}" "${NC}" bash -s <<'BASH'
set -euo pipefail
DATA="/var/www/html/data"
users=("admin" "${VAULT_USER}")
trees=(
  PCP/Supplier_Audits
  PCP/Hazard_Control
  PCP/Verification_Records
  PCP/CAPA
  PCP/Consumer_Protection
  PCP/Training_Evidence
  PCP/Retention_Logs
  Suppliers
  Clients
)
for user in "${users[@]}"; do
  root="${DATA}/${user}/files"
  mkdir -p "${root}"
  for rel in "${trees[@]}"; do
    mkdir -p "${root}/${rel}"
  done
  if id www-data >/dev/null 2>&1; then
    chown -R www-data:www-data "${root}/PCP" "${root}/Suppliers" "${root}/Clients"
  fi
done
BASH

for user in admin "${VAULT_USER}"; do
  docker exec -u www-data "${NC}" php occ files:scan --path="/${user}/files/PCP"
  docker exec -u www-data "${NC}" php occ files:scan --path="/${user}/files/Suppliers"
  docker exec -u www-data "${NC}" php occ files:scan --path="/${user}/files/Clients"
done
docker exec "${NC}" php occ config:app:set core shareapi_allow_links --value=no
docker exec "${NC}" php occ config:app:set core shareapi_allow_public_upload --value=no
log "Seeded empty /PCP/* /Suppliers /Clients for admin and ${VAULT_USER}. Public shares stay off."
