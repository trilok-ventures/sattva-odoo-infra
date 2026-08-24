#!/usr/bin/env bash
# Phase 3a T1 SoR init orchestrator (slices A–E).
# Refuses Keycloak. Does not seed counterparties, invoices, or lots.
#
#   sudo ./deploy/gcp/init-sor.sh
#   sudo ./deploy/gcp/init-sor.sh --reset-odoo-empty
#   sudo ./deploy/gcp/init-sor.sh --reset-odoo-empty --apply
#   sudo ./deploy/gcp/init-sor.sh --purge-odoo-demo
#   sudo ./deploy/gcp/init-sor.sh --purge-odoo-demo --apply
#   sudo ./deploy/gcp/init-sor.sh --with-sales
#   sudo ./deploy/gcp/init-sor.sh --with-ca-coa
set -euo pipefail

log() { echo "$*" >&2; }

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROD="$(cd -- "${HERE}/../prod" && pwd)"
ODOO_FLAGS=()
PURGE_DEMO=0
RESET_EMPTY=0
APPLY=0

for arg in "$@"; do
  case "${arg}" in
    --with-sales|--with-ca-coa) ODOO_FLAGS+=("${arg}") ;;
    --purge-odoo-demo) PURGE_DEMO=1 ;;
    --reset-odoo-empty) RESET_EMPTY=1 ;;
    --apply) APPLY=1 ;;
    --keycloak|--with-keycloak|--auth)
      log "refusing Keycloak. See docs/runbooks/app-local-admin-and-roles.md"
      exit 1
      ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      log "unknown arg: ${arg}"
      exit 1
      ;;
  esac
done

if [[ "${RESET_EMPTY}" == "1" && "${PURGE_DEMO}" == "1" ]]; then
  log "refusing both --reset-odoo-empty and --purge-odoo-demo; reset replaces purge"
  exit 1
fi
if [[ "${APPLY}" == "1" && "${PURGE_DEMO}" != "1" && "${RESET_EMPTY}" != "1" ]]; then
  log "--apply is only valid with --reset-odoo-empty or --purge-odoo-demo"
  exit 1
fi

if [[ "${RESET_EMPTY}" == "1" ]]; then
  log "Optional: drop and recreate empty sattva (dry-run unless --apply)"
  if [[ "${APPLY}" == "1" ]]; then
    "${HERE}/reset-odoo-empty.sh" --apply
  else
    "${HERE}/reset-odoo-empty.sh"
    log "dry-run only; not running A–E against the current dirty database"
    exit 0
  fi
elif [[ "${PURGE_DEMO}" == "1" ]]; then
  log "Optional: furniture demo purge (dry-run unless --apply)"
  if [[ "${APPLY}" == "1" ]]; then
    "${HERE}/purge-odoo-demo.sh" --apply
  else
    "${HERE}/purge-odoo-demo.sh"
  fi
  log "Slice A: Odoo config"
  "${HERE}/init-odoo-sor.sh" "${ODOO_FLAGS[@]+"${ODOO_FLAGS[@]}"}"
else
  log "Slice A: Odoo config"
  "${HERE}/init-odoo-sor.sh" "${ODOO_FLAGS[@]+"${ODOO_FLAGS[@]}"}"
fi

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
