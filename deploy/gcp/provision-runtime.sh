#!/usr/bin/env bash
# Idempotent Phase 3a runtime in sattva-prod-ca: static IP, SA, GCS backups
# bucket (non-WORM), Cloudflare-origin firewall, IAP SSH, e2-standard-2 VM.
# Does not create secret *values*, GKE, Cloud Armor, CAS, or Keycloak.
set -euo pipefail

log() { echo "$*" >&2; }

if ! command -v gcloud >/dev/null 2>&1; then
  log "gcloud is not installed."
  exit 1
fi

ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)"
if [[ -z "${ACCOUNT}" ]]; then
  log "No active gcloud account. Run: gcloud auth login"
  exit 1
fi

PROJECT="${TRILOK_GCP_OPCO_PROJECT:-sattva-prod-ca}"
ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"
REGION="${TRILOK_GCP_REGION:-northamerica-northeast1}"
ZONE="${TRILOK_GCP_ZONE:-${REGION}-b}"
NAME="${TRILOK_GCP_VM_NAME:-sattva-prod-vm}"
ADDR_NAME="${TRILOK_GCP_ADDR_NAME:-sattva-prod-ipv4}"
SA_NAME="${TRILOK_GCP_VM_SA:-sattva-prod-vm}"
BUCKET="${TRILOK_GCP_BACKUP_BUCKET:-${PROJECT}-backups}"

log "Active account: ${ACCOUNT}"
log "Project: ${PROJECT}  Zone: ${ZONE}  AssetCo: ${ASSET}"

gcloud projects describe "${PROJECT}" >/dev/null

gcloud services enable \
  compute.googleapis.com \
  iam.googleapis.com \
  iap.googleapis.com \
  oslogin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  --project="${PROJECT}"

if ! gcloud compute addresses describe "${ADDR_NAME}" --region="${REGION}" --project="${PROJECT}" >/dev/null 2>&1; then
  log "Reserving static IP ${ADDR_NAME}"
  gcloud compute addresses create "${ADDR_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT}"
fi
IP="$(gcloud compute addresses describe "${ADDR_NAME}" --region="${REGION}" --project="${PROJECT}" --format='value(address)')"
log "Static IP: ${IP}"

SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT}" >/dev/null 2>&1; then
  log "Creating service account ${SA_EMAIL}"
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="Sattva prod Compose VM" \
    --project="${PROJECT}"
fi

gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/logging.logWriter" \
  --quiet >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/monitoring.metricWriter" \
  --quiet >/dev/null

if ! gcloud storage buckets describe "gs://${BUCKET}" --project="${PROJECT}" >/dev/null 2>&1; then
  log "Creating backup bucket gs://${BUCKET} (versioned, not WORM; Odoo dumps only)"
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="${PROJECT}" \
    --location="${REGION}" \
    --uniform-bucket-level-access
  gcloud storage buckets update "gs://${BUCKET}" --versioning --project="${PROJECT}"
fi

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" \
  --project="${PROJECT}" >/dev/null

if gcloud projects describe "${ASSET}" >/dev/null 2>&1; then
  while IFS= read -r secret_id; do
    [[ -z "${secret_id}" ]] && continue
    if gcloud secrets describe "${secret_id}" --project="${ASSET}" >/dev/null 2>&1; then
      gcloud secrets add-iam-policy-binding "${secret_id}" \
        --project="${ASSET}" \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/secretmanager.secretAccessor"
    else
      log "Secret ${secret_id} not yet in ${ASSET} (create values later)"
    fi
  done <<'SECRETS'
odoo-db-password
odoo-admin-passwd
n8n-encryption-key
n8n-webhook-hmac
n8n-db-password
nextcloud-admin-password
nextcloud-n8n-app-password
odoo-n8n-api-key
origin-tls-cert
origin-tls-key
SECRETS
else
  log "AssetCo project ${ASSET} not visible; skip secret IAM"
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/cloudflare-ingress.sh" "${PROJECT}"

if gcloud compute instances describe "${NAME}" --zone="${ZONE}" --project="${PROJECT}" >/dev/null 2>&1; then
  log "VM exists: ${NAME}"
else
  log "Creating ${NAME} (e2-standard-2, Ubuntu 24.04, IAP SSH, no public 22)"
  gcloud compute instances create "${NAME}" \
    --project="${PROJECT}" \
    --zone="${ZONE}" \
    --machine-type=e2-standard-2 \
    --image-family=ubuntu-2404-lts-amd64 \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-balanced \
    --address="${ADDR_NAME}" \
    --tags=iap-ssh,cf-origin \
    --service-account="${SA_EMAIL}" \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --metadata=enable-oslogin=TRUE \
    --metadata-from-file=startup-script="${SCRIPT_DIR}/startup.sh"
fi

log "Runtime provision finished."
echo "project=${PROJECT} ip=${IP} vm=${NAME} sa=${SA_EMAIL} backups=gs://${BUCKET}"

if [[ -n "${TRILOK_GCP_OPERATOR:-}" ]]; then
  log "Granting IAP SSH + OS Login to ${TRILOK_GCP_OPERATOR}"
  gcloud projects add-iam-policy-binding "${PROJECT}" \
    --member="${TRILOK_GCP_OPERATOR}" \
    --role="roles/iap.tunnelResourceAccessor" \
    --quiet >/dev/null
  gcloud projects add-iam-policy-binding "${PROJECT}" \
    --member="${TRILOK_GCP_OPERATOR}" \
    --role="roles/compute.osLogin" \
    --quiet >/dev/null
fi
