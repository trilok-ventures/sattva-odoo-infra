#!/usr/bin/env bash
# Bind the existing Odoo + Nextcloud admin accounts to an operator mailbox.
# Run on the sattva-prod-vm. Does not create a second admin. Does not set
# passwords. Does not deploy Keycloak.
#
#   sudo ./deploy/gcp/set-operator-admin-email.sh
#   sudo ./deploy/gcp/set-operator-admin-email.sh --check
#   sudo ./deploy/gcp/set-operator-admin-email.sh --release-share-login
#   OPERATOR_EMAIL=you@trilokventures.org sudo -E ./deploy/gcp/set-operator-admin-email.sh
set -euo pipefail

log() { echo "$*" >&2; }

CHECK=0
RELEASE_SHARE=0
POSITIONAL=()
for arg in "$@"; do
  case "${arg}" in
    --check) CHECK=1 ;;
    --release-share-login) RELEASE_SHARE=1 ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *) POSITIONAL+=("${arg}") ;;
  esac
done

EMAIL="${OPERATOR_EMAIL:-${POSITIONAL[0]:-archneo@trilokventures.org}}"
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

export EMAIL CHECK RELEASE_SHARE
docker exec -i -e EMAIL -e CHECK -e RELEASE_SHARE "${WEB}" python3 - <<'PY'
import os
import sys

import odoo
from odoo import SUPERUSER_ID, api
from odoo.modules.registry import Registry

email = os.environ["EMAIL"]
check_only = os.environ.get("CHECK") == "1"
release_share = os.environ.get("RELEASE_SHARE") == "1"

odoo.tools.config.parse_config(["-c", "/tmp/odoo.conf", "--no-http"])
registry = Registry("sattva")
with registry.cursor() as cr:
    env = api.Environment(cr, SUPERUSER_ID, {})
    User = env["res.users"].with_context(active_test=False)
    admin = User.browse(2)
    if not admin.exists() or admin.share:
        sys.exit("uid 2 missing or is a portal/share user")
    if admin.login not in ("admin", email):
        sys.exit("refusing to mutate uid 2 login=%r" % (admin.login,))
    other = User.search([("login", "=", email), ("id", "!=", admin.id)], limit=1)
    if other:
        print(
            "conflict_uid=%s share=%s active=%s login=%s"
            % (other.id, other.share, other.active, other.login)
        )
        if check_only:
            pass
        elif release_share and other.share:
            other.active = False
            other.login = "archived.share.%s" % other.id
            other.email = False
            if other.partner_id:
                other.partner_id.email = False
            print("released_share_uid=%s" % other.id)
            other = False
        else:
            sys.exit(
                "mailbox owned by user id=%s share=%s; "
                "re-run with --release-share-login only if that user is portal/share"
                % (other.id, other.share)
            )
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
    print(
        "odoo_n8n_service=%s"
        % admin.has_group("sattva_compliance.group_n8n_fabric_service")
    )
    if other:
        sys.exit("mailbox still held by user id=%s" % other.id)
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
