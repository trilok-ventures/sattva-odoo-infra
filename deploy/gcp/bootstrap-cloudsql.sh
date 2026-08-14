#!/usr/bin/env bash
# Idempotent Cloud SQL Postgres 15 bootstrap for the Sattva OpCo production runtime.
# Amends integrated-architecture decision D3 (self-hosted -> Cloud SQL); fabric-architect
# approved with conditions (2026-08-13). Production only: local Phase 1 Compose keeps
# its own postgres:15-alpine container; nothing here touches it.
#
# Requires: gcloud, curl, GNU date; deploy/gcp/bootstrap-projects.sh already run;
#           secret odoo-db-password already created in the AssetCo project
#           (see deploy/gcp/secret-names.md). Fails closed if the secret is missing.
#
# API/IAM split (fabric condition): sqladmin + servicenetworking on OpCo
# (sattva-prod-ca); cloudkms on AssetCo (tv-assetco-secrets); the CMEK grant is a
# key-level cryptoKeyEncrypterDecrypter binding to the OpCo Cloud SQL service
# agent only.
#
# Secret values transit stdin pipes only — never argv, never logs, never git.
# Human logs go to stderr so stdout stays machine-readable:
#   connection_name=... private_ip=... db_user=...
set -euo pipefail

log() { echo "$*" >&2; }

if ! command -v gcloud >/dev/null 2>&1; then
  log "gcloud is not installed. Install Google Cloud SDK, then: gcloud auth login"
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  log "curl is required (DB user password is set via the Admin API to keep it out of"
  log "process arguments)."
  exit 1
fi

ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)"
if [[ -z "${ACCOUNT}" ]]; then
  log "No active gcloud account. Run: gcloud auth login"
  exit 1
fi

PROJECT_OPCO="${TRILOK_GCP_OPCO_PROJECT:-sattva-prod-ca}"
PROJECT_ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"
REGION="${TRILOK_GCP_REGION:-northamerica-northeast1}"
ZONE="${TRILOK_GCP_ZONE:-${REGION}-a}"
NETWORK="${TRILOK_GCP_NETWORK:-default}"
PEERING_RANGE="${TRILOK_GCP_PEERING_RANGE:-google-managed-services-default}"

INSTANCE="${TRILOK_CLOUDSQL_INSTANCE:-sattva-odoo-pg}"
TIER="${TRILOK_CLOUDSQL_TIER:-db-custom-1-3840}"
DB_USER="${TRILOK_CLOUDSQL_DB_USER:-odoo}"
DB_SECRET="${TRILOK_CLOUDSQL_DB_SECRET:-odoo-db-password}"
KEYRING="${TRILOK_KMS_KEYRING:-sattva-sql}"
KEY="${TRILOK_KMS_KEY:-cloudsql-odoo}"

# Label convention introduced by this script; record any changes in deploy/gcp/README.md.
LABELS="env=prod,data-classification=amber,system-of-record=odoo-postgres"

# gcloud does not route to the regional Secret Manager endpoint from --location alone;
# without this, calls hit the global endpoint and fail with
# INVALID_ARGUMENT "... does not match the expected format [projects/*]".
# Env-var form is session-scoped: no persistent change to the operator's gcloud config.
# Every secrets call in this script targets the one regional secret, so the override
# cannot misroute a global secret here.
export CLOUDSDK_API_ENDPOINT_OVERRIDES_SECRETMANAGER="https://secretmanager.${REGION}.rep.googleapis.com/"

log "Active account: ${ACCOUNT}"
log "OpCo project: ${PROJECT_OPCO}  AssetCo project: ${PROJECT_ASSET}  Region: ${REGION}"

# Fail closed before building anything: the odoo DB password must already exist in
# AssetCo Secret Manager (values are never generated into shell history by this repo).
# It is a REGIONAL secret: cloud-sql-db-credentials (the type that enables Cloud SQL
# managed rotation) is not supported on global secrets, and regional placement matches
# the residency stance. Every secrets call below therefore passes --location.
if ! gcloud secrets describe "${DB_SECRET}" --project="${PROJECT_ASSET}" \
    --location="${REGION}" >/dev/null 2>&1; then
  log "Secret ${DB_SECRET} not found in project ${PROJECT_ASSET} (${REGION}). Refusing to continue."
  log "Create it first as a regional secret (hex-only value keeps the Admin API JSON body safe)."
  log "The endpoint override is required for the interactive shell too:"
  log "  export CLOUDSDK_API_ENDPOINT_OVERRIDES_SECRETMANAGER=https://secretmanager.${REGION}.rep.googleapis.com/"
  log "  openssl rand -hex 24 | gcloud secrets create ${DB_SECRET} \\"
  log "    --project=${PROJECT_ASSET} --location=${REGION} \\"
  log "    --secret-type=cloud-sql-db-credentials \\"
  log "    --labels=data-class=red,owner=assetco,consumer=odoo --data-file=-"
  exit 1
fi

# A secret container with no ENABLED version passes the describe check but fails at
# versions access — catch it here, before paying for an instance-creation wait.
if [[ -z "$(gcloud secrets versions list "${DB_SECRET}" --project="${PROJECT_ASSET}" \
    --location="${REGION}" --filter='state:ENABLED' --format='value(name)' --limit=1 2>/dev/null)" ]]; then
  log "Secret ${DB_SECRET} exists but has no ENABLED version. Add one:"
  log "  openssl rand -hex 24 | gcloud secrets versions add ${DB_SECRET} \\"
  log "    --project=${PROJECT_ASSET} --location=${REGION} --data-file=-"
  exit 1
fi

# --- APIs (split per fabric condition) --------------------------------------
log "Enabling APIs: sqladmin + servicenetworking on ${PROJECT_OPCO}; cloudkms on ${PROJECT_ASSET}"
gcloud services enable sqladmin.googleapis.com servicenetworking.googleapis.com \
  --project="${PROJECT_OPCO}" >/dev/null
gcloud services enable cloudkms.googleapis.com --project="${PROJECT_ASSET}" >/dev/null

# --- CMEK keyring + key in AssetCo ------------------------------------------
if ! gcloud kms keyrings describe "${KEYRING}" --location="${REGION}" \
    --project="${PROJECT_ASSET}" >/dev/null 2>&1; then
  log "Creating keyring ${KEYRING} (${REGION}) in ${PROJECT_ASSET}"
  gcloud kms keyrings create "${KEYRING}" --location="${REGION}" --project="${PROJECT_ASSET}" >/dev/null
else
  log "Keyring exists: ${KEYRING}"
fi

if ! gcloud kms keys describe "${KEY}" --keyring="${KEYRING}" --location="${REGION}" \
    --project="${PROJECT_ASSET}" >/dev/null 2>&1; then
  log "Creating key ${KEY} (90d automatic rotation)"
  gcloud kms keys create "${KEY}" --keyring="${KEYRING}" --location="${REGION}" \
    --project="${PROJECT_ASSET}" --purpose=encryption --rotation-period=90d \
    --next-rotation-time="$(date -u -d '+90 days' +%Y-%m-%dT%H:%M:%SZ)" \
    --labels="${LABELS}" >/dev/null
else
  log "Key exists: ${KEY}"
fi
KEY_ID="projects/${PROJECT_ASSET}/locations/${REGION}/keyRings/${KEYRING}/cryptoKeys/${KEY}"
# NOTE: never disable or destroy old key versions — the instance stops while its
# encrypting key version is unreachable.

# --- Key-level grant to the OpCo Cloud SQL service agent ---------------------
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_OPCO}" --format='value(projectNumber)')"
SQL_SA="service-${PROJECT_NUMBER}@gcp-sa-cloud-sql.iam.gserviceaccount.com"
gcloud beta services identity create --service=sqladmin.googleapis.com \
  --project="${PROJECT_OPCO}" >/dev/null
log "Granting cryptoKeyEncrypterDecrypter on ${KEY} to ${SQL_SA}"
gcloud kms keys add-iam-policy-binding "${KEY}" --keyring="${KEYRING}" \
  --location="${REGION}" --project="${PROJECT_ASSET}" \
  --member="serviceAccount:${SQL_SA}" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" >/dev/null

# --- Private services access (allocated range + VPC peering) -----------------
if ! gcloud compute addresses describe "${PEERING_RANGE}" --global \
    --project="${PROJECT_OPCO}" >/dev/null 2>&1; then
  log "Allocating peering range ${PEERING_RANGE} (/16) on network ${NETWORK}"
  gcloud compute addresses create "${PEERING_RANGE}" --global --purpose=VPC_PEERING \
    --prefix-length=16 --network="${NETWORK}" --project="${PROJECT_OPCO}" >/dev/null
else
  log "Peering range exists: ${PEERING_RANGE}"
fi

if ! gcloud services vpc-peerings list --network="${NETWORK}" --project="${PROJECT_OPCO}" \
    2>/dev/null | grep -q 'servicenetworking.googleapis.com'; then
  log "Connecting VPC peering to servicenetworking.googleapis.com"
  gcloud services vpc-peerings connect --service=servicenetworking.googleapis.com \
    --ranges="${PEERING_RANGE}" --network="${NETWORK}" --project="${PROJECT_OPCO}" >/dev/null
else
  log "VPC peering exists: servicenetworking.googleapis.com"
fi

# --- Instance ----------------------------------------------------------------
# gcloud beta is required for --network (private IP) and create-time --labels.
if gcloud sql instances describe "${INSTANCE}" --project="${PROJECT_OPCO}" >/dev/null 2>&1; then
  log "Instance exists: ${INSTANCE}"
  EXISTING_KEY="$(gcloud sql instances describe "${INSTANCE}" --project="${PROJECT_OPCO}" \
    --format='value(diskEncryptionConfiguration.kmsKeyName)')"
  if [[ "${EXISTING_KEY%/cryptoKeyVersions/*}" != "${KEY_ID}" ]]; then
    log "WARNING: instance CMEK key is '${EXISTING_KEY:-none}' but expected '${KEY_ID}'."
    log "Encryption key type is create-time only; recreate the instance to change it."
  fi
  if gcloud sql instances describe "${INSTANCE}" --project="${PROJECT_OPCO}" \
      --format='value(ipAddresses)' | grep -q 'PUBLIC'; then
    log "WARNING: instance has a PUBLIC IP; design is private-IP-only. Recreate to remove."
  fi
  gcloud beta sql instances patch "${INSTANCE}" --project="${PROJECT_OPCO}" \
    --update-labels="${LABELS}" >/dev/null
else
  log "Creating instance ${INSTANCE} (Postgres 15, ${TIER}, zonal ${ZONE}, private IP, CMEK, PITR 7d)"
  # --zone implies the region; --region and --zone are mutually exclusive.
  gcloud beta sql instances create "${INSTANCE}" \
    --project="${PROJECT_OPCO}" \
    --edition=ENTERPRISE \
    --database-version=POSTGRES_15 \
    --tier="${TIER}" \
    --zone="${ZONE}" --availability-type=ZONAL \
    --storage-size=20GB --storage-type=SSD --storage-auto-increase \
    --network="projects/${PROJECT_OPCO}/global/networks/${NETWORK}" --no-assign-ip \
    --disk-encryption-key="${KEY_ID}" \
    --enable-point-in-time-recovery --retained-transaction-log-days=7 \
    --backup-start-time=02:00 --retained-backups-count=7 \
    --maintenance-window-day=SUN --maintenance-window-hour=3 \
    --database-flags=cloudsql.enable_pgaudit=on,pgaudit.log=ddl \
    --labels="${LABELS}" \
    --deletion-protection
fi

# --- Optional: grant a VM service account connector access -------------------
if [[ -n "${TRILOK_CLOUDSQL_CLIENT_SA:-}" ]]; then
  log "Granting roles/cloudsql.client to ${TRILOK_CLOUDSQL_CLIENT_SA} on ${PROJECT_OPCO}"
  gcloud projects add-iam-policy-binding "${PROJECT_OPCO}" \
    --member="serviceAccount:${TRILOK_CLOUDSQL_CLIENT_SA}" \
    --role="roles/cloudsql.client" >/dev/null
else
  log "TRILOK_CLOUDSQL_CLIENT_SA not set; skipping cloudsql.client grant (run again after"
  log "the VM exists to grant its service account connector access)."
fi

# --- DB user -----------------------------------------------------------------
# The password goes to the Admin API in a JSON body over stdin; argv and logs stay
# clean (fabric condition). Users created via the API get cloudsqlsuperuser, which
# includes CREATEDB, so Odoo creates the `sattva` database itself on first boot.
DB_PASSWORD="$(gcloud secrets versions access latest --secret="${DB_SECRET}" \
  --project="${PROJECT_ASSET}" --location="${REGION}")"
if [[ ! "${DB_PASSWORD}" =~ ^[A-Za-z0-9]+$ ]]; then
  log "Password in ${DB_SECRET} is not alphanumeric; rotate it (openssl rand -hex 24) so"
  log "the Admin API JSON body stays safe. Refusing to continue."
  exit 1
fi

ACCESS_TOKEN="$(gcloud auth print-access-token)"
API="https://sqladmin.googleapis.com/v1/projects/${PROJECT_OPCO}/instances/${INSTANCE}/users"

log "Ensuring DB user ${DB_USER} on ${INSTANCE}"
if ! printf '%s' "{\"name\":\"${DB_USER}\",\"password\":\"${DB_PASSWORD}\"}" | curl -fsS \
    -X POST -H "Authorization: Bearer ${ACCESS_TOKEN}" -H "Content-Type: application/json" \
    --data-binary @- -o /dev/null "${API}" 2>/dev/null; then
  log "Insert failed (user likely exists); setting password via update instead"
  printf '%s' "{\"password\":\"${DB_PASSWORD}\"}" | curl -fsS \
    -X PUT -H "Authorization: Bearer ${ACCESS_TOKEN}" -H "Content-Type: application/json" \
    --data-binary @- -o /dev/null "${API}?name=${DB_USER}"
fi
unset DB_PASSWORD ACCESS_TOKEN

CONNECTION_NAME="$(gcloud sql instances describe "${INSTANCE}" --project="${PROJECT_OPCO}" \
  --format='value(connectionName)')"
PRIVATE_IP="$(gcloud sql instances describe "${INSTANCE}" --project="${PROJECT_OPCO}" \
  --format='value(ipAddresses[0].ipAddress)')"

log "Bootstrap finished."
log "Next: run the dbproxy sidecar (cloud-sql-proxy v2, --private-ip) in deploy/prod with"
log "connection name ${CONNECTION_NAME}; Odoo db_host=dbproxy db_user=${DB_USER},"
log "password from secret ${DB_SECRET}."
log "REMINDER: PITR + daily backups cover only 7 days. Schedule logical exports"
log "(pg_dump or gcloud sql export) of the sattva DB to the GCS backup bucket regime"
log "(integrated spec §4.8) before this instance is treated as the production SoR."
echo "connection_name=${CONNECTION_NAME} private_ip=${PRIVATE_IP} db_user=${DB_USER}"
