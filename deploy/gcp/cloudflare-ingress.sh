#!/usr/bin/env bash
# Allow 80/443 from current Cloudflare IPv4 ranges; SSH only from IAP.
# Usage: cloudflare-ingress.sh [PROJECT_ID]
set -euo pipefail

log() { echo "$*" >&2; }

PROJECT="${1:-${TRILOK_GCP_OPCO_PROJECT:-sattva-prod-ca}}"
CF_URL="${CLOUDFLARE_IPS_V4_URL:-https://www.cloudflare.com/ips-v4}"

RANGES="$(curl -fsSL "${CF_URL}")"
if [[ -z "${RANGES}" ]]; then
  log "Failed to fetch Cloudflare IPv4 ranges from ${CF_URL}"
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "${TMP}"' EXIT
printf '%s\n' "${RANGES}" | awk 'NF && $1 ~ /^[0-9]/ {print $1}' > "${TMP}"
if [[ ! -s "${TMP}" ]]; then
  log "Cloudflare IPv4 list was empty"
  exit 1
fi

log "Applying IAP SSH rule (35.235.240.0/20 tcp:22)"
if gcloud compute firewall-rules describe allow-iap-ssh --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud compute firewall-rules update allow-iap-ssh \
    --project="${PROJECT}" \
    --allow=tcp:22 \
    --source-ranges=35.235.240.0/20 \
    --target-tags=iap-ssh \
    --quiet
else
  gcloud compute firewall-rules create allow-iap-ssh \
    --project="${PROJECT}" \
    --direction=INGRESS \
    --priority=1000 \
    --allow=tcp:22 \
    --source-ranges=35.235.240.0/20 \
    --target-tags=iap-ssh \
    --description="SSH via Identity-Aware Proxy only"
fi

mapfile -t CF_RANGES < "${TMP}"
# gcloud source-ranges is comma-separated
CF_CSV="$(IFS=,; echo "${CF_RANGES[*]}")"

log "Applying Cloudflare origin rule (${#CF_RANGES[@]} IPv4 ranges → tcp:80,443)"
if gcloud compute firewall-rules describe allow-cloudflare-http --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud compute firewall-rules update allow-cloudflare-http \
    --project="${PROJECT}" \
    --allow=tcp:80,tcp:443 \
    --source-ranges="${CF_CSV}" \
    --target-tags=cf-origin \
    --quiet
else
  gcloud compute firewall-rules create allow-cloudflare-http \
    --project="${PROJECT}" \
    --direction=INGRESS \
    --priority=1000 \
    --allow=tcp:80,tcp:443 \
    --source-ranges="${CF_CSV}" \
    --target-tags=cf-origin \
    --description="HTTP/S from Cloudflare edge only"
fi

log "Applying deny-public-ssh (tcp:22 from 0.0.0.0/0, priority 2000; IAP allow wins at 1000)"
if gcloud compute firewall-rules describe deny-public-ssh --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud compute firewall-rules update deny-public-ssh \
    --project="${PROJECT}" \
    --quiet
else
  gcloud compute firewall-rules create deny-public-ssh \
    --project="${PROJECT}" \
    --direction=INGRESS \
    --priority=2000 \
    --action=DENY \
    --rules=tcp:22 \
    --source-ranges=0.0.0.0/0 \
    --description="Deny public SSH; IAP rule at priority 1000 is the exception"
fi

log "Cloudflare ingress firewall updated"
