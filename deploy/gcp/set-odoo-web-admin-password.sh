#!/usr/bin/env bash
# Set the existing Odoo uid-2 /web/login password from AssetCo
# odoo-web-admin-password. Does not print the secret. Does not copy
# nextcloud-admin-password. Does not create a second admin.
#
# On sattva-prod-vm (VM SA must be secretAccessor):
#   sudo ./deploy/gcp/set-odoo-web-admin-password.sh
set -euo pipefail

log() { echo "$*" >&2; }

ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"
SECRET_ID="${ODOO_WEB_ADMIN_SECRET:-odoo-web-admin-password}"
WEB="${ODOO_WEB_CONTAINER:-sattva-prod-web}"
EMAIL="${OPERATOR_EMAIL:-archneo@trilokventures.org}"

if ! docker inspect "${WEB}" >/dev/null 2>&1; then
  log "missing container ${WEB}"
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

export ODOO_WEB_ADMIN_PASSWORD EMAIL
docker exec -i -e ODOO_WEB_ADMIN_PASSWORD -e EMAIL "${WEB}" python3 - <<'PY'
import os
import sys

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
    print("odoo_system=%s" % admin.has_group("base.group_system"))

uid = common.exp_authenticate("sattva", email, password, {})
print("authenticate_web_secret=%s" % (uid == 2))
if uid != 2:
    sys.exit("authenticate failed after password write")
PY

log "Odoo /web/login password set from ${SECRET_ID}. Value not logged."
log "Nextcloud still uses nextcloud-admin-password. Do not reuse it here."
