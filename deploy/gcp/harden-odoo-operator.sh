#!/usr/bin/env bash
# Disable public signup and archive leftover demo users. Run on the VM.
# Does not create users. Does not change passwords.
set -euo pipefail

log() { echo "$*" >&2; }
WEB="${ODOO_WEB_CONTAINER:-sattva-prod-web}"

if ! docker inspect "${WEB}" >/dev/null 2>&1; then
  log "missing container ${WEB}"
  exit 1
fi

docker exec -i "${WEB}" python3 - <<'PY'
import odoo
from odoo import SUPERUSER_ID, api
from odoo.modules.registry import Registry

odoo.tools.config.parse_config(["-c", "/tmp/odoo.conf", "--no-http"])
registry = Registry("sattva")
with registry.cursor() as cr:
    env = api.Environment(cr, SUPERUSER_ID, {})
    ICP = env["ir.config_parameter"].sudo()
    ICP.set_param("auth_signup.invitation_only", "True")
    ICP.set_param("auth_signup.reset_password", "True")
    User = env["res.users"].with_context(active_test=False)
    admin = User.browse(2)
    compliance = env.ref("sattva_compliance.group_compliance_officer", raise_if_not_found=False)
    if admin.exists() and not admin.share and compliance and compliance not in admin.groups_id:
        admin.groups_id = [(4, compliance.id)]
    archived = []
    for user in User.search([("login", "in", ["demo", "portal"])]):
        if user.id in (1, 2) or user.has_group("base.group_system"):
            continue
        if user.login == "n8n.fabric":
            continue
        user.active = False
        archived.append("%s:%s" % (user.id, user.login))
    settings = User.search([("share", "=", False), ("active", "=", True)]).filtered(
        lambda u: u.has_group("base.group_system") and u.id != 1
    )
    cr.commit()
    print("signup_invitation_only=%s" % ICP.get_param("auth_signup.invitation_only"))
    print("archived=%s" % ",".join(archived) if archived else "archived=none")
    print("settings_uids=%s" % ",".join(str(u.id) for u in settings))
PY

log "Odoo signup is invitation-only. Demo leftovers archived when present."
