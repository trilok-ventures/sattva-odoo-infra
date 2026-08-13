#!/usr/bin/env bash
# Idempotent HoldCo / OpCo / AssetCo folder + project bootstrap.
# Requires: gcloud, TRILOK_GCP_ORG_ID, TRILOK_GCP_BILLING_ACCOUNT
# Does not create VMs or secret values. Human logs go to stderr so captured
# folder ids stay machine-readable.
set -euo pipefail

log() { echo "$*" >&2; }

if ! command -v gcloud >/dev/null 2>&1; then
  log "gcloud is not installed. Install Google Cloud SDK, then: gcloud auth login"
  exit 1
fi

ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)"
if [[ -z "${ACCOUNT}" ]]; then
  log "No active gcloud account. Run: gcloud auth login"
  exit 1
fi

ORG_ID="${TRILOK_GCP_ORG_ID:?Set TRILOK_GCP_ORG_ID to the numeric organization id}"
BILLING="${TRILOK_GCP_BILLING_ACCOUNT:?Set TRILOK_GCP_BILLING_ACCOUNT}"
REGION="${TRILOK_GCP_REGION:-northamerica-northeast1}"

if [[ ! "${ORG_ID}" =~ ^[0-9]+$ ]]; then
  log "TRILOK_GCP_ORG_ID must be numeric, got: ${ORG_ID}"
  exit 1
fi

log "Active account: ${ACCOUNT}"
log "Org: ${ORG_ID}  Region default: ${REGION}"

folder_id_by_name() {
  local name="$1"
  gcloud resource-manager folders list --organization="${ORG_ID}" \
    --filter="displayName=${name}" --format="value(name)" 2>/dev/null | head -1
}

ensure_folder() {
  local name="$1"
  local existing
  existing="$(folder_id_by_name "${name}")"
  if [[ -n "${existing}" ]]; then
    log "Folder exists: ${name} (${existing})"
    printf '%s\n' "${existing}"
    return
  fi
  log "Creating folder ${name}"
  gcloud resource-manager folders create --display-name="${name}" --organization="${ORG_ID}" \
    --format="value(name)"
}

PROJECT_OPCO="${TRILOK_GCP_OPCO_PROJECT:-sattva-prod-ca}"
PROJECT_ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"
PROJECT_DEV="${TRILOK_GCP_DEV_PROJECT:-sattva-dev-ca}"

HOLDCO="$(ensure_folder tv-holdco-shared)"
IPCO="$(ensure_folder tv-ipco)"
ASSETCO="$(ensure_folder tv-assetco)"
OPCO="$(ensure_folder tv-sattva-opco)"

create_project() {
  local id="$1"
  local folder="$2"
  if [[ ! "${folder}" =~ ^folders/[0-9]+$ ]]; then
    log "Invalid folder resource name (expected folders/NUMERIC_ID): ${folder}"
    exit 1
  fi
  if gcloud projects describe "${id}" >/dev/null 2>&1; then
    log "Project exists: ${id}"
  else
    log "Creating project ${id} in ${folder}"
    gcloud projects create "${id}" --name="${id}" --folder="${folder#folders/}"
  fi
  gcloud billing projects link "${id}" --billing-account="${BILLING}" >/dev/null
}

create_project "${PROJECT_OPCO}" "${OPCO}"
create_project "${PROJECT_ASSET}" "${ASSETCO}"
if [[ "${TRILOK_GCP_CREATE_DEV:-}" == "1" ]]; then
  create_project "${PROJECT_DEV}" "${OPCO}"
fi

enable_apis() {
  local project="$1"
  shift
  gcloud services enable "$@" --project="${project}"
}

log "Enabling APIs on ${PROJECT_OPCO}"
enable_apis "${PROJECT_OPCO}" \
  compute.googleapis.com \
  iam.googleapis.com \
  iap.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com

log "Enabling APIs on ${PROJECT_ASSET}"
enable_apis "${PROJECT_ASSET}" \
  iam.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com

log "Bootstrap finished. Next: create secrets from deploy/gcp/secret-names.md in ${PROJECT_ASSET}."
log "Folders: holdco=${HOLDCO} ipco=${IPCO} assetco=${ASSETCO} opco=${OPCO}"
echo "holdco=${HOLDCO} ipco=${IPCO} assetco=${ASSETCO} opco=${OPCO}"
