#!/usr/bin/env bash
# Phase 3a T1 SoR init orchestrator (slices A–E).
# Refuses Keycloak. Does not seed counterparties, invoices, or lots.
#
#   sudo ./deploy/gcp/init-sor.sh
#   sudo ./deploy/gcp/init-sor.sh --with-sales
#   sudo ./deploy/gcp/init-sor.sh --with-ca-coa
set -euo pipefail

log() { echo "$*" >&2; }

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROD="$(cd -- "${HERE}/../prod" && pwd)"
ODOO_FLAGS=()

for arg in "$@"; do
  case "${arg}" in
    --with-sales|--with-ca-coa) ODOO_FLAGS+=("${arg}") ;;
    --keycloak|--with-keycloak|--auth)
      log "refusing Keycloak. See docs/runbooks/app-local-admin-and-roles.md"
      exit 1
      ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      log "unknown arg: ${arg}"
      exit 1
      ;;
  esac
done

log "Slice A: Odoo config"
"${HERE}/init-odoo-sor.sh" "${ODOO_FLAGS[@]+"${ODOO_FLAGS[@]}"}"

log "Slice B: Nextcloud empty convention trees"
"${HERE}/seed-nextcloud-vault-trees.sh"
"${PROD}/harden-nextcloud.sh"

log "Slice C: n8n owner (no-op if one exists)"
"${HERE}/create-n8n-owner.sh" || {
  status=$?
  if [[ "${status}" -eq 2 ]]; then
    log "n8n owner must be completed once in the editor. Continuing."
  else
    exit "${status}"
  fi
}

log "Slice D: n8n workflows + credentials"
"${HERE}/init-n8n-fabric.sh"

if [[ -f "${PROD}/.env" ]]; then
  log "Slice E: recreate n8n so ODOO_N8N_UID is loaded"
  docker compose -f "${PROD}/docker-compose.prod.yml" --env-file "${PROD}/.env" \
    up -d --force-recreate n8n n8n-worker
else
  log "Slice E skipped: ${PROD}/.env missing. Recreate n8n after setting ODOO_N8N_UID."
fi

log "SoR init slices A–E finished. No synthetic suppliers/buyers/lots/invoices created."
log "Do not point FABRIC_MODE=live. Do not deploy Keycloak."
