#!/usr/bin/env bash
# Bind the existing Odoo + Nextcloud admin accounts to an operator mailbox.
# Run on the sattva-prod-vm. Does not create a second admin. Does not set
# passwords. Does not deploy Keycloak.
#
#   sudo ./deploy/gcp/set-operator-admin-email.sh
#   sudo ./deploy/gcp/set-operator-admin-email.sh --check
#   OPERATOR_EMAIL=you@trilokventures.org sudo -E ./deploy/gcp/set-operator-admin-email.sh
set -euo pipefail

log() { echo "$*" >&2; }

CHECK=0
if [[ "${1:-}" == "--check" ]]; then
  CHECK=1
  shift
fi
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '2,12p' "$0"
  exit 0
fi

EMAIL="${OPERATOR_EMAIL:-${1:-archneo@trilokventures.org}}"
case "${EMAIL}" in
  *@trilokventures.org) ;;
  *)
    log "refusing non-trilokventures.org mailbox: ${EMAIL}"
    exit 1
    ;;
esac

WEB="${ODOO_WEB_CONTAINER:-sattva-prod-web}"
NC="${NEXTCLOUD_CONTAINER:-sattva-prod-nextcloud}"

if ! docker inspect "${WEB}" >/dev/null 2>&1; then
  log "missing container ${WEB}"
  exit 1
fi
if ! docker inspect "${NC}" >/dev/null 2>&1; then
  log "missing container ${NC}"
  exit 1
fi

export EMAIL CHECK
docker exec -i -e EMAIL -e CHECK "${WEB}" python3 - <<'PY'
import os
import sys

import odoo
from odoo import SUPERUSER_ID, api

email = os.environ["EMAIL"]
check_only = os.environ.get("CHECK") == "1"

odoo.tools.config.parse_config(["-c", "/tmp/odoo.conf", "--no-http"])
registry = odoo.registry("sattva")
with registry.cursor() as cr:
    env = api.Environment(cr, SUPERUSER_ID, {})
    User = env["res.users"]
    admin = User.browse(2)
    if not admin.exists() or admin.share:
        sys.exit("uid 2 missing or is a portal/share user")
    if admin.login not in ("admin", email):
        sys.exit("refusing to mutate uid 2 login=%r" % (admin.login,))
    other = User.search([("login", "=", email), ("id", "!=", admin.id)], limit=1)
    if other:
        sys.exit("email already owned by another user id=%s" % other.id)
    if not check_only:
        admin.login = email
        admin.email = email
        admin.partner_id.email = email
        if not admin.has_group("base.group_system"):
            admin.groups_id = [(4, env.ref("base.group_system").id)]
        cr.commit()
    print("odoo_uid=%s" % admin.id)
    print("odoo_login=%s" % admin.login)
    print("odoo_email=%s" % (admin.email or ""))
    print("odoo_system=%s" % admin.has_group("base.group_system"))
    print("odoo_n8n_service=%s" % admin.has_group("sattva_compliance.group_n8n_fabric_service"))
PY

if [[ "${CHECK}" -eq 1 ]]; then
  docker exec "${NC}" php occ user:info admin
  docker exec "${NC}" php occ user:setting admin settings email || true
else
  docker exec "${NC}" php occ user:setting admin settings email "${EMAIL}"
  docker exec "${NC}" php occ user:info admin
fi

log "Done. Nextcloud userid stays admin. Odoo /web/login uses the mailbox as login."
log "Passwords unchanged. odoo-admin-passwd is the DB-manager master, not this login."
