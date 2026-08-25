#!/usr/bin/env bash
# Import git workflow JSON and named credentials into production n8n.
# Does not edit nodes in the editor. Does not store lots or invoices.
# Credential values come from Secret Manager and are shredded.
#
#   sudo ./deploy/gcp/init-n8n-fabric.sh
set -euo pipefail

log() { echo "$*" >&2; }

N8N="${N8N_CONTAINER:-sattva-prod-n8n}"
ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"
VAULT_USER="${NEXTCLOUD_N8N_USER:-n8n.vault}"

if ! docker inspect "${N8N}" >/dev/null 2>&1; then
  log "missing container ${N8N}"
  exit 1
fi

if [[ -z "${ODOO_N8N_PASSWORD:-}" ]] && command -v gcloud >/dev/null 2>&1; then
  ODOO_N8N_PASSWORD="$(gcloud secrets versions access latest --secret=odoo-n8n-api-key --project="${ASSET}")"
fi
if [[ -z "${NEXTCLOUD_N8N_PASSWORD:-}" ]] && command -v gcloud >/dev/null 2>&1; then
  NEXTCLOUD_N8N_PASSWORD="$(gcloud secrets versions access latest --secret=nextcloud-n8n-app-password --project="${ASSET}")"
fi
if [[ -z "${ODOO_N8N_PASSWORD:-}" || -z "${NEXTCLOUD_N8N_PASSWORD:-}" ]]; then
  log "set ODOO_N8N_PASSWORD and NEXTCLOUD_N8N_PASSWORD or run where gcloud can read AssetCo secrets"
  exit 1
fi

for wf in /workflows/wf.coa.verify.json \
  /workflows/wf.supplier.folder.json \
  /workflows/wf.buyer.onboard.folder.json \
  /workflows/wf.order.handoff.json \
  /workflows/wf.notify.role.json \
  /workflows/wf.lead.score.json \
  /workflows/wf.replenishment.nudge.json; do
  docker exec "${N8N}" n8n import:workflow --input="${wf}"
  log "imported ${wf}"
done

# Render credentials inside the container so values never hit the git tree.
# The n8n image has node, not Python.
docker exec -i -e ODOO_N8N_PASSWORD -e NEXTCLOUD_N8N_PASSWORD -e VAULT_USER \
  "${N8N}" sh -s <<'SH'
set -eu
CRED_TMP="$(mktemp)"
export CRED_TMP
node -e '
const fs = require("fs");
const payload = [
  {
    id: "odooN8nFabric",
    name: "odooN8nFabric",
    type: "httpHeaderAuth",
    data: {
      name: "X-Sattva-Odoo-Password",
      value: process.env.ODOO_N8N_PASSWORD,
    },
  },
  {
    id: "nextcloudN8nVault",
    name: "nextcloudN8nVault",
    type: "httpBasicAuth",
    data: {
      user: process.env.VAULT_USER || "n8n.vault",
      password: process.env.NEXTCLOUD_N8N_PASSWORD,
    },
  },
];
fs.writeFileSync(process.env.CRED_TMP, JSON.stringify(payload));
'
n8n import:credentials --input="$CRED_TMP"
shred -u "$CRED_TMP" 2>/dev/null || rm -f "$CRED_TMP"
SH

for id in wf-coa-verify wf-supplier-folder wf-buyer-onboard-folder \
  wf-order-handoff wf-notify-role wf-lead-score wf-replenishment-nudge; do
  if docker exec "${N8N}" n8n update:workflow --id="${id}" --active=true; then
    log "activated ${id}"
  else
    log "activate ${id} in the editor once (do not edit nodes). Password not logged."
  fi
done

unset ODOO_N8N_PASSWORD NEXTCLOUD_N8N_PASSWORD
log "n8n workflows imported from git. Credentials named odooN8nFabric and nextcloudN8nVault. Values not logged."
