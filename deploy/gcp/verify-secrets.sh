#!/usr/bin/env bash
# Verify AssetCo Secret Manager ids, versions, and Compute Engine SA access.
# Prints names, IAM members, and byte lengths — never secret values.
set -euo pipefail

log() { echo "$*" >&2; }

if ! command -v gcloud >/dev/null 2>&1; then
  log "gcloud is not installed."
  exit 1
fi

if [[ -n "${GCP_SA_JSON:-}" && -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
  creds="$(mktemp)"
  printf '%s' "${GCP_SA_JSON}" > "${creds}"
  chmod 600 "${creds}"
  export GOOGLE_APPLICATION_CREDENTIALS="${creds}"
  gcloud auth activate-service-account --key-file="${creds}" >/dev/null
fi

ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)"
if [[ -z "${ACCOUNT}" ]]; then
  log "No active gcloud account. Run: gcloud auth login"
  log "Or set GCP_SA_JSON / GOOGLE_APPLICATION_CREDENTIALS for a deployer SA."
  exit 1
fi

ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"
PROJECT="${TRILOK_GCP_OPCO_PROJECT:-sattva-prod-ca}"
SA_NAME="${TRILOK_GCP_VM_SA:-sattva-prod-vm}"
VM_SA="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
REQUIRED=(
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
)

log "Active account: ${ACCOUNT}"
log "AssetCo: ${ASSET}  OpCo: ${PROJECT}  expected VM SA: ${VM_SA}"

gcloud projects describe "${ASSET}" >/dev/null
gcloud projects describe "${PROJECT}" >/dev/null

DEFAULT_COMPUTE=""
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT}" --format='value(projectNumber)')"
if [[ -n "${PROJECT_NUMBER}" ]]; then
  DEFAULT_COMPUTE="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  log "Default Compute Engine SA: ${DEFAULT_COMPUTE}"
fi

vm_sa_exists=0
if gcloud iam service-accounts describe "${VM_SA}" --project="${PROJECT}" >/dev/null 2>&1; then
  vm_sa_exists=1
fi

ASSET_NUMBER="$(gcloud projects describe "${ASSET}" --format='value(projectNumber)')"
ASSET_COMPUTE=""
if [[ -n "${ASSET_NUMBER}" ]]; then
  ASSET_COMPUTE="${ASSET_NUMBER}-compute@developer.gserviceaccount.com"
fi

PROJECT_ACCESSORS="$(gcloud projects get-iam-policy "${ASSET}" \
  --flatten='bindings[].members' \
  --filter='bindings.role=roles/secretmanager.secretAccessor' \
  --format='value(bindings.members)' 2>/dev/null || true)"
log "AssetCo project secretAccessor members:"
log "${PROJECT_ACCESSORS:-"(none)"}"

fail=0
report=()

has_member() {
  local policy="$1"
  local member="$2"
  [[ -n "${member}" ]] && grep -Fqx "serviceAccount:${member}" <<<"${policy}"
}

access_len() {
  local secret_id="$1"
  local impersonate="$2"
  local extra=()
  if [[ -n "${impersonate}" ]]; then
    extra+=(--impersonate-service-account="${impersonate}")
  fi
  # Values stay in this pipe only; callers print length, never payload.
  gcloud secrets versions access latest \
    --secret="${secret_id}" \
    --project="${ASSET}" \
    "${extra[@]}" \
    --quiet 2>/dev/null | wc -c
}

for secret_id in "${REQUIRED[@]}"; do
  if ! gcloud secrets describe "${secret_id}" --project="${ASSET}" >/dev/null 2>&1; then
    report+=("MISSING secret ${secret_id}")
    fail=1
    continue
  fi

  enabled="$(gcloud secrets versions list "${secret_id}" --project="${ASSET}" \
    --filter='state=ENABLED' --format='value(name)' --limit=1 2>/dev/null || true)"
  if [[ -z "${enabled}" ]]; then
    report+=("NO_ENABLED_VERSION ${secret_id}")
    fail=1
    continue
  fi

  policy="$(gcloud secrets get-iam-policy "${secret_id}" --project="${ASSET}" \
    --flatten='bindings[].members' \
    --filter='bindings.role=roles/secretmanager.secretAccessor' \
    --format='value(bindings.members)' 2>/dev/null || true)"
  policy="${policy}"$'\n'"${PROJECT_ACCESSORS}"

  vm_ok=0
  default_ok=0
  asset_compute_ok=0
  if has_member "${policy}" "${VM_SA}"; then
    vm_ok=1
  fi
  if has_member "${policy}" "${DEFAULT_COMPUTE}"; then
    default_ok=1
  fi
  if has_member "${policy}" "${ASSET_COMPUTE}"; then
    asset_compute_ok=1
  fi

  if [[ "${vm_sa_exists}" -eq 1 && "${vm_ok}" -eq 0 ]]; then
    report+=("NO_CUSTOM_VM_SA_ACCESSOR ${secret_id} (need ${VM_SA})")
    fail=1
  elif [[ "${vm_ok}" -eq 0 && "${default_ok}" -eq 0 ]]; then
    report+=("NO_OPCO_SA_ACCESSOR ${secret_id} (wanted ${VM_SA}${DEFAULT_COMPUTE:+ or OpCo ${DEFAULT_COMPUTE}})")
    fail=1
    if [[ "${asset_compute_ok}" -eq 1 ]]; then
      report+=("NOTE ${secret_id} is bound to AssetCo default compute SA ${ASSET_COMPUTE} — that SA does not run the OpCo VM")
    fi
  else
    who="custom-vm-sa"
    [[ "${vm_ok}" -eq 1 ]] || who="opco-default-compute-sa"
    [[ "${vm_ok}" -eq 1 && "${default_ok}" -eq 1 ]] && who="custom-vm-sa+opco-default-compute-sa"
    report+=("IAM_OK ${secret_id} accessor=${who}")
    if [[ "${vm_sa_exists}" -eq 0 && "${default_ok}" -eq 1 && "${vm_ok}" -eq 0 ]]; then
      report+=("NOTE ${secret_id} bound to OpCo default Compute Engine SA; grant ${VM_SA} after provision-runtime.sh")
    fi
  fi

  impersonate=""
  if [[ "${vm_ok}" -eq 1 ]]; then
    impersonate="${VM_SA}"
  elif [[ "${default_ok}" -eq 1 ]]; then
    impersonate="${DEFAULT_COMPUTE}"
  fi

  used_impersonate=0
  bytes="0"
  if [[ -n "${impersonate}" ]]; then
    bytes="$(access_len "${secret_id}" "${impersonate}" || true)"
    bytes="${bytes// /}"
    if [[ -n "${bytes}" && "${bytes}" != "0" ]]; then
      used_impersonate=1
    fi
  fi
  if [[ "${used_impersonate}" -eq 0 ]]; then
    bytes="$(access_len "${secret_id}" "" || true)"
    bytes="${bytes// /}"
    if [[ -z "${bytes}" || "${bytes}" == "0" ]]; then
      report+=("ACCESS_FAIL ${secret_id} (IAM listed but versions/access failed)")
      fail=1
    else
      report+=("ACCESS_OK_OPERATOR ${secret_id} bytes=${bytes} (VM SA impersonation not proven)")
    fi
  else
    extra=""
    if [[ "${secret_id}" == "origin-tls-cert" || "${secret_id}" == "origin-tls-key" ]]; then
      kind="$(gcloud secrets versions access latest --secret="${secret_id}" --project="${ASSET}" --quiet \
        | python3 -c 'import sys; d=sys.stdin.read(); print("cert-pem" if "BEGIN CERTIFICATE" in d else ("key-pem" if "BEGIN" in d and "PRIVATE" in d else "not-pem"))')"
      extra=" format=${kind}"
    fi
    report+=("ACCESS_OK_SA ${secret_id} bytes=${bytes}${extra}")
  fi
done

if [[ "${vm_sa_exists}" -eq 1 ]]; then
  report+=("VM_SA_EXISTS ${VM_SA}")
else
  report+=("VM_SA_MISSING ${VM_SA} (provision-runtime.sh has not created it yet)")
fi

ZONE="${TRILOK_GCP_ZONE:-northamerica-northeast1-b}"
NAME="${TRILOK_GCP_VM_NAME:-sattva-prod-vm}"
if gcloud compute instances describe "${NAME}" --zone="${ZONE}" --project="${PROJECT}" >/dev/null 2>&1; then
  attached="$(gcloud compute instances describe "${NAME}" --zone="${ZONE}" --project="${PROJECT}" \
    --format='value(serviceAccounts.email)')"
  report+=("VM_EXISTS ${NAME} sa=${attached}")
else
  report+=("VM_MISSING ${NAME} in ${ZONE} (next: provision-runtime.sh)")
fi

printf '%s\n' "${report[@]}"
if [[ "${fail}" -ne 0 ]]; then
  log "Secret verification failed."
  exit 1
fi
log "Secret verification passed (values not printed)."
