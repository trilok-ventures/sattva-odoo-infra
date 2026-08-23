#!/usr/bin/env bash
# Drop and recreate the Odoo sattva DB with --without-demo=all.
# Does not drop n8n or Nextcloud. Does not seed counterparties or lots.
# Default is dry-run. --apply dumps sattva, then replaces that database only.
#
#   sudo ./deploy/gcp/reset-odoo-empty.sh
#   sudo ./deploy/gcp/reset-odoo-empty.sh --apply
set -euo pipefail

log() { echo "$*" >&2; }

APPLY=0
for arg in "$@"; do
  case "${arg}" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    --keycloak|--with-keycloak|--auth)
      log "refusing Keycloak. See docs/runbooks/app-local-admin-and-roles.md"
      exit 1
      ;;
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
DB="${ODOO_DB_CONTAINER:-sattva-prod-db}"
CONF="${ODOO_CONF:-/tmp/odoo.conf}"
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROD="${ODOO_PROD_DIR:-$(cd -- "${HERE}/../prod" && pwd)}"
DUMP_DIR="${PURGE_DUMP_DIR:-/var/backups/sattva}"
BUCKET="${TRILOK_GCP_BACKUP_BUCKET:-sattva-prod-ca-backups}"
COMPOSE=(docker compose -f "${PROD}/docker-compose.prod.yml" --env-file "${PROD}/.env")
INSTALL_MODULES="sattva_compliance,sale_management"

if ! docker inspect "${WEB}" >/dev/null 2>&1; then
  log "missing container ${WEB}"
  exit 1
fi
if ! docker inspect "${DB}" >/dev/null 2>&1; then
  log "missing container ${DB}"
  exit 1
fi
if [[ ! -f "${PROD}/docker-compose.prod.yml" || ! -f "${PROD}/.env" ]]; then
  log "missing ${PROD}/docker-compose.prod.yml or .env"
  exit 1
fi

export RESET_APPLY="${APPLY}"
log "inventory of current sattva (read-only)"
docker exec -i -e ODOO_CONF="${CONF}" -e RESET_APPLY "${WEB}" python3 - <<'PY'
import os
import odoo
from odoo import SUPERUSER_ID, api
from odoo.modules.registry import Registry

odoo.tools.config.parse_config(["-c", os.environ.get("ODOO_CONF", "/tmp/odoo.conf"), "--no-http"])
registry = Registry("sattva")
with registry.cursor() as cr:
    env = api.Environment(cr, SUPERUSER_ID, {})
    mods = sorted(
        env["ir.module.module"].search([("state", "=", "installed")]).mapped("name")
    )
    extra = [
        name
        for name in mods
        if name
        in (
            "website",
            "website_sale",
            "auth_oauth",
            "stock",
            "hr",
            "mass_mailing",
            "project",
            "l10n_us",
        )
    ]
    print("installed_count=%s" % len(mods))
    print("extra_apps=%s" % (",".join(extra) if extra else "none"))
    print(
        "products=%s"
        % (
            env["product.template"].with_context(active_test=False).search_count([])
            if "product.template" in env.registry
            else 0
        )
    )
    print(
        "sale_orders=%s"
        % (env["sale.order"].search_count([]) if "sale.order" in env.registry else 0)
    )
    print(
        "purchase_orders=%s"
        % (env["purchase.order"].search_count([]) if "purchase.order" in env.registry else 0)
    )
    print("leads=%s" % (env["crm.lead"].search_count([]) if "crm.lead" in env.registry else 0))
    print(
        "posted_moves=%s"
        % (
            env["account.move"].search_count([("state", "=", "posted")])
            if "account.move" in env.registry
            else 0
        )
    )
    print("mode=dry-run" if os.environ.get("RESET_APPLY") != "1" else "mode=apply")
PY

if [[ "${APPLY}" != "1" ]]; then
  log "dry_run=1 — will drop ONLY postgres database sattva (not n8n, not Nextcloud)"
  log "pass --apply to dump, drop, install ${INSTALL_MODULES} --without-demo=all"
  exit 0
fi

if [[ "${RESET_ODOO_EMPTY_BACKUP_ACK:-}" != "1" ]]; then
  stamp="$(date -u +%F_%H%M%S)"
  sudo mkdir -p "${DUMP_DIR}"
  dump="${DUMP_DIR}/sattva_pre_empty_reset_${stamp}.dump"
  log "dumping sattva to ${dump} (n8n and Nextcloud are not copied)"
  docker exec "${DB}" pg_dump -U odoo -d sattva -Fc > "${dump}"
  if [[ ! -s "${dump}" ]]; then
    log "refusing --apply: empty dump ${dump}"
    exit 1
  fi
  log "local_dump_bytes=$(wc -c < "${dump}")"
  if command -v gcloud >/dev/null 2>&1; then
    gcloud storage cp "${dump}" "gs://${BUCKET}/odoo/" \
      && log "uploaded dump to gs://${BUCKET}/odoo/" \
      || log "warning_gcs_upload_failed (local dump kept)"
  fi
else
  log "RESET_ODOO_EMPTY_BACKUP_ACK=1 — skipping new pg_dump"
fi

cd "${PROD}"
log "Stopping Odoo web so dropdb can run"
"${COMPOSE[@]}" stop web

log "Terminating sessions and dropping postgres database sattva (n8n DB kept)"
docker exec "${DB}" psql -U odoo -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'sattva' AND pid <> pg_backend_pid();"
docker exec "${DB}" dropdb -U odoo --if-exists sattva
docker exec "${DB}" createdb -U odoo sattva
log "created empty postgres database sattva"

log "Clearing leftover Odoo filestore for sattva"
"${COMPOSE[@]}" run --rm --no-deps --entrypoint bash web -c \
  'rm -rf /var/lib/odoo/filestore/sattva; echo filestore_cleared=1'

log "Installing ${INSTALL_MODULES} --without-demo=all (no website, stock, hr, mailing, l10n_us)"
"${COMPOSE[@]}" run --rm --no-deps -T --entrypoint bash web -s <<'EOS'
set -euo pipefail
python3 - <<'PY'
import os
tpl = open("/etc/odoo/odoo.conf.template").read()
for key in ("POSTGRES_PASSWORD", "ODOO_ADMIN_PASSWD"):
    value = os.environ.get(key)
    if not value:
        raise SystemExit("missing required env %s" % key)
    tpl = tpl.replace("${%s}" % key, value)
open("/tmp/odoo.conf", "w").write(tpl)
PY
odoo -c /tmp/odoo.conf -d sattva -i sattva_compliance,sale_management \
  --without-demo=all --stop-after-init
EOS

log "Starting web against the new empty database"
"${COMPOSE[@]}" up -d --no-deps web

ready=0
for _ in $(seq 1 40); do
  if docker exec "${WEB}" python3 -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8069/web/login', timeout=2)" \
    >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 3
done
if [[ "${ready}" -ne 1 ]]; then
  log "Odoo HTTP did not become ready after empty install"
  docker logs "${WEB}" --tail 50 >&2 || true
  exit 1
fi

log "Applying Sattva SoR config (company/CAD/stages/n8n.fabric)"
"${HERE}/init-odoo-sor.sh" --with-sales

log "Binding uid 2 to the operator mailbox"
"${HERE}/set-operator-admin-email.sh"

log "Writing /web/login hash and recreating workers"
"${HERE}/recreate-odoo-web.sh"

log "Empty Odoo reset finished. n8n and Nextcloud databases were not dropped."
log "Recreate n8n after ODOO_N8N_UID is written (init-sor slice E)."
