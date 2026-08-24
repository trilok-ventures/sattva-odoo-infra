#!/usr/bin/env bash
# Stop Odoo workers, write uid-2 /web/login from AssetCo, recreate web.
# Running workers can cache/overwrite res.users; do not set the password
# while sattva-prod-web is up.
#
#   sudo ./deploy/gcp/recreate-odoo-web.sh
set -euo pipefail

log() { echo "$*" >&2; }

ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"
SECRET_ID="${ODOO_WEB_ADMIN_SECRET:-odoo-web-admin-password}"
EMAIL="${OPERATOR_EMAIL:-archneo@trilokventures.org}"
PROD_DIR="${PROD_DIR:-/opt/sattva/deploy/prod}"
COMPOSE=(docker compose -f "${PROD_DIR}/docker-compose.prod.yml")

if [[ ! -f "${PROD_DIR}/docker-compose.prod.yml" ]]; then
  log "missing ${PROD_DIR}/docker-compose.prod.yml"
  exit 1
fi

if [[ -z "${ODOO_WEB_ADMIN_PASSWORD:-}" ]]; then
  if ! command -v gcloud >/dev/null 2>&1; then
    log "set ODOO_WEB_ADMIN_PASSWORD or run where gcloud can read ${SECRET_ID}"
    exit 1
  fi
  ODOO_WEB_ADMIN_PASSWORD="$(gcloud secrets versions access latest --secret="${SECRET_ID}" --project="${ASSET}")"
fi
if [[ -z "${ODOO_WEB_ADMIN_PASSWORD}" ]]; then
  log "empty ${SECRET_ID}"
  exit 1
fi

cd "${PROD_DIR}"
log "Password hash length in DB before stop:"
docker exec sattva-prod-db psql -U odoo -d sattva -tAc \
  "SELECT id || ' login=' || login || ' hash_len=' || COALESCE(length(password),0) FROM res_users WHERE id=2"

log "Stopping web workers"
"${COMPOSE[@]}" stop web

log "Writing /web/login hash with workers down"
export ODOO_WEB_ADMIN_PASSWORD EMAIL
"${COMPOSE[@]}" run --rm --no-deps \
  -e ODOO_WEB_ADMIN_PASSWORD \
  -e EMAIL \
  --entrypoint python3 web - <<'PY'
import os
import sys

tpl = open("/etc/odoo/odoo.conf.template").read()
for key in ("POSTGRES_PASSWORD", "ODOO_ADMIN_PASSWD"):
    value = os.environ.get(key)
    if not value:
        raise SystemExit("missing required env %s" % key)
    tpl = tpl.replace("${%s}" % key, value)
open("/tmp/odoo.conf", "w").write(tpl)

import odoo
from odoo import SUPERUSER_ID, api
from odoo.modules.registry import Registry
from odoo.service import common

password = os.environ["ODOO_WEB_ADMIN_PASSWORD"]
email = os.environ["EMAIL"]
odoo.tools.config.parse_config(["-c", "/tmp/odoo.conf", "--no-http"])
registry = Registry("sattva")
with registry.cursor() as cr:
    env = api.Environment(cr, SUPERUSER_ID, {})
    admin = env["res.users"].browse(2)
    if not admin.exists() or admin.share:
        sys.exit("uid 2 missing or is a portal/share user")
    if admin.login != email:
        sys.exit("refusing to set password: uid 2 login=%r" % (admin.login,))
    admin.write({"password": password})
    cr.commit()
    print("odoo_uid=%s" % admin.id)
    print("odoo_login=%s" % admin.login)
uid = common.exp_authenticate("sattva", email, password, {})
print("authenticate_after_write=%s" % (uid == 2))
if uid != 2:
    sys.exit("authenticate failed after password write")
PY

log "Password hash length in DB after write:"
docker exec sattva-prod-db psql -U odoo -d sattva -tAc \
  "SELECT id || ' login=' || login || ' hash_len=' || COALESCE(length(password),0) FROM res_users WHERE id=2"

log "Recreating web"
"${COMPOSE[@]}" up -d --force-recreate --no-deps web

log "Waiting for Odoo HTTP"
ready=0
for _ in $(seq 1 40); do
  if docker exec sattva-prod-web python3 -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8069/web/login', timeout=2)" \
    >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "${ready}" -ne 1 ]]; then
  log "Odoo HTTP did not become ready"
  docker logs sattva-prod-web --tail 40 >&2 || true
  exit 1
fi

log "Verifying live jsonrpc authenticate"
docker exec -i -e ODOO_WEB_ADMIN_PASSWORD -e EMAIL sattva-prod-web python3 - <<'PY'
import json
import os
import sys
import urllib.request

payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
        "service": "common",
        "method": "authenticate",
        "args": [
            "sattva",
            os.environ["EMAIL"],
            os.environ["ODOO_WEB_ADMIN_PASSWORD"],
            {},
        ],
    },
    "id": 1,
}
req = urllib.request.Request(
    "http://127.0.0.1:8069/jsonrpc",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=20) as resp:
    body = json.loads(resp.read().decode())
uid = body.get("result")
print("live_http_authenticate=%s" % (uid == 2))
print("live_http_has_error=%s" % bool(body.get("error")))
if uid != 2:
    sys.exit("live HTTP authenticate failed")
PY

log "Odoo web recreated. Login is ${EMAIL} + ${SECRET_ID}. Value not logged."
