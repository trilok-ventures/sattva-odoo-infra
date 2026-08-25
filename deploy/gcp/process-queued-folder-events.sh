#!/usr/bin/env bash
# Process queued sattva.fabric.event folder rows the same way n8n should:
# MKCOL as n8n.vault, then set_partner_path as n8n.fabric.
# Use when the 5-minute poll no-ops. Does not approve PCP or upload files.
set -euo pipefail

log() { echo "$*" >&2; }
WEB="${ODOO_WEB_CONTAINER:-sattva-prod-web}"
NC="${NEXTCLOUD_CONTAINER:-sattva-prod-nextcloud}"
ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"
VAULT_USER="${NEXTCLOUD_N8N_USER:-n8n.vault}"

if [[ -z "${ODOO_N8N_PASSWORD:-}" ]] && command -v gcloud >/dev/null 2>&1; then
  ODOO_N8N_PASSWORD="$(gcloud secrets versions access latest --secret=odoo-n8n-api-key --project="${ASSET}")"
fi
if [[ -z "${NEXTCLOUD_N8N_PASSWORD:-}" ]] && command -v gcloud >/dev/null 2>&1; then
  NEXTCLOUD_N8N_PASSWORD="$(gcloud secrets versions access latest --secret=nextcloud-n8n-app-password --project="${ASSET}")"
fi
if [[ -z "${ODOO_N8N_PASSWORD:-}" || -z "${NEXTCLOUD_N8N_PASSWORD:-}" ]]; then
  log "set ODOO_N8N_PASSWORD and NEXTCLOUD_N8N_PASSWORD"
  exit 1
fi

UID_N8N="$(grep -E '^ODOO_N8N_UID=' /opt/sattva/deploy/prod/.env 2>/dev/null | head -1 | cut -d= -f2 || true)"
if [[ -z "${UID_N8N}" || "${UID_N8N}" == "2" ]]; then
  log "refusing ODOO_N8N_UID=${UID_N8N:-empty}"
  exit 1
fi

export ODOO_N8N_PASSWORD NEXTCLOUD_N8N_PASSWORD UID_N8N VAULT_USER
docker exec -i -e ODOO_N8N_PASSWORD -e NEXTCLOUD_N8N_PASSWORD -e UID_N8N -e VAULT_USER \
  "${WEB}" python3 - <<'PY'
import base64
import json
import os
import urllib.error
import urllib.request

uid = int(os.environ["UID_N8N"])
password = os.environ["ODOO_N8N_PASSWORD"]
vault_user = os.environ["VAULT_USER"]
vault_pass = os.environ["NEXTCLOUD_N8N_PASSWORD"]


def rpc(model, method, args, kwargs=None):
    payload = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "object",
            "method": "execute_kw",
            "args": ["sattva", uid, password, model, method, args, kwargs or {}],
        },
        "id": 1,
    }
    req = urllib.request.Request(
        "http://127.0.0.1:8069/jsonrpc",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.load(resp)
    if body.get("error"):
        raise SystemExit(body["error"])
    return body["result"]


def mkcol(path):
    url = "http://nextcloud/remote.php/dav/files/%s%s" % (vault_user, path)
    auth = ("%s:%s" % (vault_user, vault_pass)).encode()
    req = urllib.request.Request(url, method="MKCOL")
    req.add_header("Authorization", "Basic %s" % base64.b64encode(auth).decode())
    try:
        urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as exc:
        if exc.code not in (405, 409):
            raise


events = rpc(
    "sattva.fabric.event",
    "search_read",
    [[["state", "=", "queued"]]],
    {"fields": ["id", "partner_id", "requested_path", "event_type"]},
)
print("queued=%s" % len(events))
for event in events:
    path = event["requested_path"]
    partner = event["partner_id"]
    partner_id = partner[0] if isinstance(partner, list) else partner
    parts = [part for part in str(path).split("/") if part]
    prefix = ""
    for part in parts:
        prefix += "/%s" % part
        mkcol(prefix + "/")
    kind = "supplier" if "supplier" in event["event_type"] else "client"
    rpc("sattva.fabric.vault", "set_partner_path", [partner_id, path, kind])
    rpc("sattva.fabric.event", "write", [[event["id"]], {"state": "processed"}])
    print("processed id=%s type=%s path=%s" % (event["id"], event["event_type"], path))
PY

unset ODOO_N8N_PASSWORD NEXTCLOUD_N8N_PASSWORD
log "Queued folder events processed. Values not logged."
