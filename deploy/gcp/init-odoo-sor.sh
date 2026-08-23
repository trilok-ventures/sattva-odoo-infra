#!/usr/bin/env bash
# Phase 3a T1 Odoo required state: company, CRM stages, n8n.fabric, harden.
# Does not create partners, leads, POs, invoices, or lots.
# Does not install website, auth_oauth, stock, or Keycloak.
#
#   sudo ./deploy/gcp/init-odoo-sor.sh
#   sudo ./deploy/gcp/init-odoo-sor.sh --with-sales
#   sudo ./deploy/gcp/init-odoo-sor.sh --with-ca-coa
set -euo pipefail

log() { echo "$*" >&2; }

WITH_SALES=0
WITH_CA_COA=0
for arg in "$@"; do
  case "${arg}" in
    --with-sales) WITH_SALES=1 ;;
    --with-ca-coa) WITH_CA_COA=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      log "unknown arg: ${arg}"
      exit 1
      ;;
  esac
done

WEB="${ODOO_WEB_CONTAINER:-sattva-prod-web}"
CONF="${ODOO_CONF:-/tmp/odoo.conf}"
ENV_FILE="${ODOO_PROD_ENV:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../prod" && pwd)/.env}"
ASSET="${TRILOK_GCP_ASSET_PROJECT:-tv-assetco-secrets}"

if ! docker inspect "${WEB}" >/dev/null 2>&1; then
  log "missing container ${WEB}"
  exit 1
fi

if [[ -z "${ODOO_N8N_PASSWORD:-}" ]] && command -v gcloud >/dev/null 2>&1; then
  ODOO_N8N_PASSWORD="$(gcloud secrets versions access latest --secret=odoo-n8n-api-key --project="${ASSET}" || true)"
fi

extra_modules=""
if [[ "${WITH_SALES}" == "1" ]]; then
  extra_modules="${extra_modules},sale_management"
fi
if [[ "${WITH_CA_COA}" == "1" ]]; then
  extra_modules="${extra_modules},l10n_ca"
fi
extra_modules="${extra_modules#,}"

if [[ -n "${extra_modules}" ]]; then
  log "Installing modules (no demo): ${extra_modules}"
  docker exec "${WEB}" odoo -d sattva -i "${extra_modules}" \
    -c "${CONF}" --without-demo=all --stop-after-init
fi

export ODOO_N8N_PASSWORD
export ODOO_CONF="${CONF}"
UID_LINE="$(
  docker exec -i -e ODOO_N8N_PASSWORD -e ODOO_CONF "${WEB}" python3 - <<'PY'
import os
import sys

import odoo
from odoo import SUPERUSER_ID, api
from odoo.modules.registry import Registry

conf = os.environ.get("ODOO_CONF", "/tmp/odoo.conf")
odoo.tools.config.parse_config(["-c", conf, "--no-http"])
registry = Registry("sattva")
with registry.cursor() as cr:
    env = api.Environment(cr, SUPERUSER_ID, {})
    Module = env["ir.module.module"]
    compliance = Module.search([("name", "=", "sattva_compliance")], limit=1)
    if not compliance or compliance.state != "installed":
        sys.exit("sattva_compliance is not installed")
    forbidden = Module.search(
        [
            ("name", "in", ["website", "website_sale", "auth_oauth", "auth_oidc"]),
            ("state", "=", "installed"),
        ]
    )
    if forbidden:
        sys.exit("refusing installed modules: %s" % ",".join(forbidden.mapped("name")))

    company = env["res.company"].browse(1)
    if not company.exists():
        sys.exit("res.company id 1 missing")
    canada = env.ref("base.ca")
    cad = env.ref("base.CAD")
    vals = {"name": "Sattva Brokers", "country_id": canada.id}
    posted = 0
    if "account.move" in env:
        posted = env["account.move"].search_count([("state", "=", "posted")])
    if posted:
        print("warning_skip_cad_posted_moves=%s" % posted)
    else:
        vals["currency_id"] = cad.id
    company.write(vals)

    Stage = env["crm.stage"]
    wanted = [
        ("Discovery", 10, False),
        ("Proposal", 20, False),
        ("Compliance Review", 30, False),
        ("Contract", 40, False),
        ("Execution", 50, False),
        ("Retention", 60, True),
    ]
    keep_ids = []
    for name, sequence, is_won in wanted:
        stage = Stage.search(
            [("name", "=", name), ("team_id", "=", False)], limit=1
        )
        vals = {"name": name, "sequence": sequence, "is_won": is_won}
        if stage:
            stage.write(vals)
        else:
            stage = Stage.create(vals)
        keep_ids.append(stage.id)
    leftovers = Stage.search(
        [("team_id", "=", False), ("id", "not in", keep_ids)]
    )
    unused = leftovers.filtered(
        lambda stage: not env["crm.lead"].search_count([("stage_id", "=", stage.id)])
    )
    unused.unlink()

    ICP = env["ir.config_parameter"].sudo()
    ICP.set_param("auth_signup.invitation_only", "True")
    ICP.set_param("auth_signup.reset_password", "True")

    User = env["res.users"].with_context(active_test=False)
    admin = User.browse(2)
    compliance_group = env.ref(
        "sattva_compliance.group_compliance_officer", raise_if_not_found=False
    )
    fabric_group = env.ref(
        "sattva_compliance.group_n8n_fabric_service", raise_if_not_found=False
    )
    if not fabric_group:
        sys.exit("group_n8n_fabric_service missing")
    if admin.exists() and not admin.share and compliance_group:
        if compliance_group not in admin.groups_id:
            admin.groups_id = [(4, compliance_group.id)]

    archived = []
    for user in User.search([("login", "in", ["demo", "portal"])]):
        if user.id in (1, 2) or user.has_group("base.group_system"):
            continue
        if user.login == "n8n.fabric":
            continue
        user.active = False
        archived.append("%s:%s" % (user.id, user.login))

    login = "n8n.fabric"
    fabric = User.search([("login", "=", login)], limit=1)
    if fabric and fabric.id == 2:
        sys.exit("refusing to reuse uid 2 as n8n.fabric")
    if not fabric:
        fabric = User.create(
            {
                "name": "n8n.fabric",
                "login": login,
                "groups_id": [(6, 0, [fabric_group.id])],
            }
        )
    else:
        fabric.groups_id = [(6, 0, [fabric_group.id])]
        fabric.active = True
    if fabric.has_group("base.group_system"):
        sys.exit("n8n.fabric must not have Settings")

    password = os.environ.get("ODOO_N8N_PASSWORD") or ""
    if password:
        fabric.password = password

    Partner = env["res.partner"]
    seeded = Partner.search(
        [
            "|",
            ("supplier_rank", ">", 0),
            ("customer_rank", ">", 0),
            ("id", "!=", company.partner_id.id),
        ]
    )
    if seeded:
        print(
            "warning_existing_counterparties=%s"
            % ",".join("%s:%s" % (p.id, p.name) for p in seeded[:20]),
            file=sys.stderr,
        )

    cr.commit()
    print("company=%s country=%s currency=%s" % (company.name, company.country_id.code, company.currency_id.name))
    print("crm_stages=%s" % ",".join(stage_name for stage_name, _, _ in wanted))
    print("n8n_fabric_uid=%s" % fabric.id)
    print("archived=%s" % (",".join(archived) if archived else "none"))
    print("signup_invitation_only=%s" % ICP.get_param("auth_signup.invitation_only"))
    print("pcp_default=pending")
PY
)"

log "${UID_LINE}"
FABRIC_UID="$(printf '%s\n' "${UID_LINE}" | awk -F= '/^n8n_fabric_uid=/{print $2}' | tail -1)"
if [[ -z "${FABRIC_UID}" || "${FABRIC_UID}" == "2" ]]; then
  log "refusing ODOO_N8N_UID=${FABRIC_UID:-empty}"
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  if grep -q '^ODOO_N8N_UID=' "${ENV_FILE}"; then
    sed -i "s/^ODOO_N8N_UID=.*/ODOO_N8N_UID=${FABRIC_UID}/" "${ENV_FILE}"
  else
    printf 'ODOO_N8N_UID=%s\n' "${FABRIC_UID}" >> "${ENV_FILE}"
  fi
  log "Wrote ODOO_N8N_UID=${FABRIC_UID} into ${ENV_FILE} (value is a uid, not a secret)."
else
  log "ODOO_N8N_UID=${FABRIC_UID} — set this in deploy/prod/.env then recreate n8n."
fi

log "Odoo SoR config applied. No partners/leads/POs/invoices created."
