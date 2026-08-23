#!/usr/bin/env bash
# Cancel/archive Odoo 18 *furniture demo* rows on the production sattva DB.
# Default is dry-run. Mutates only with --apply after a fresh pg_dump.
# Does not create partners, confirm POs, install Keycloak, or seed vault files.
#
#   sudo ./deploy/gcp/purge-odoo-demo.sh
#   sudo ./deploy/gcp/purge-odoo-demo.sh --apply
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
DUMP_DIR="${PURGE_DUMP_DIR:-/var/backups/sattva}"
BUCKET="${TRILOK_GCP_BACKUP_BUCKET:-sattva-prod-ca-backups}"

if ! docker inspect "${WEB}" >/dev/null 2>&1; then
  log "missing container ${WEB}"
  exit 1
fi

if [[ "${APPLY}" == "1" && "${PURGE_ODOO_DEMO_BACKUP_ACK:-}" != "1" ]]; then
  if ! docker inspect "${DB}" >/dev/null 2>&1; then
    log "missing container ${DB} (needed for pg_dump before --apply)"
    exit 1
  fi
  stamp="$(date -u +%F_%H%M%S)"
  sudo mkdir -p "${DUMP_DIR}"
  dump="${DUMP_DIR}/sattva_pre_purge_${stamp}.dump"
  log "dumping sattva to ${dump} (Nextcloud RED is not copied)"
  docker exec "${DB}" pg_dump -U odoo -d sattva -Fc > "${dump}"
  if [[ ! -s "${dump}" ]]; then
    log "refusing --apply: empty dump ${dump}"
    exit 1
  fi
  log "local_dump_bytes=$(wc -c < "${dump}")"
  if command -v gcloud >/dev/null 2>&1; then
    gcloud storage cp "${dump}" "gs://${BUCKET}/odoo/" \
      && log "uploaded dump to gs://${BUCKET}/odoo/" \
      || log "warning_gcs_upload_failed (local dump kept; not a Nextcloud tarball)"
  fi
elif [[ "${APPLY}" == "1" ]]; then
  log "PURGE_ODOO_DEMO_BACKUP_ACK=1 — skipping new pg_dump"
fi

export PURGE_APPLY="${APPLY}"
export ODOO_CONF="${CONF}"
docker exec -i -e PURGE_APPLY -e ODOO_CONF "${WEB}" python3 - <<'PY'
import os
import sys

import odoo
from odoo import SUPERUSER_ID, api
from odoo.modules.registry import Registry

APPLY = os.environ.get("PURGE_APPLY") == "1"
FORBIDDEN = (
    "Riverbank Organic Farm",
    "Example Foods",
    "P00042",
    "SO-1042",
)
DEMO_COMPANY_NAMES = (
    "Azure Interior",
    "Acme Corporation",
    "Gemini Furniture",
    "Wood Corner",
    "Ready Mat",
    "Lumber Inc",
    "OpenWood",
    "The Jackson Group",
)
FABRIC_STAGES = (
    "Discovery",
    "Proposal",
    "Compliance Review",
    "Contract",
    "Execution",
    "Retention",
)

conf = os.environ.get("ODOO_CONF", "/tmp/odoo.conf")
odoo.tools.config.parse_config(["-c", conf, "--no-http"])
registry = Registry("sattva")
with registry.cursor() as cr:
    env = api.Environment(cr, SUPERUSER_ID, {})
    Partner = env["res.partner"].with_context(active_test=False)
    User = env["res.users"].with_context(active_test=False)
    Data = env["ir.model.data"]
    company = env["res.company"].browse(1)
    if not company.exists():
        sys.exit("res.company id 1 missing")

    protected = Partner.browse()
    protected |= company.partner_id
    for uid in (1, 2):
        user = User.browse(uid)
        if user.exists():
            protected |= user.partner_id
    fabric = User.search([("login", "=", "n8n.fabric")], limit=1)
    if fabric:
        protected |= fabric.partner_id
    for xmlid in (
        "base.partner_root",
        "base.partner_admin",
        "base.public_partner",
        "base.main_partner",
    ):
        rec = env.ref(xmlid, raise_if_not_found=False)
        if rec:
            protected |= rec

    def xmlids(model, module=None, name_prefix=None, name_contains=None, name_in=None):
        domain = [("model", "=", model)]
        if module:
            domain.append(("module", "=", module))
        recs = Data.search(domain)
        ids = []
        for rec in recs:
            name = rec.name or ""
            if name_prefix and not name.startswith(name_prefix):
                continue
            if name_contains and name_contains not in name:
                continue
            if name_in is not None and name not in name_in:
                continue
            if rec.res_id:
                ids.append(rec.res_id)
        return ids

    def has_forbidden(name):
        text = name or ""
        return any(needle in text for needle in FORBIDDEN)

    demo = Partner.browse(
        xmlids(
            "res.partner",
            module="base",
            name_in=("partner_demo", "partner_demo_portal"),
        )
        + xmlids("res.partner", module="base", name_prefix="res_partner_")
    )
    named = Partner.search([("name", "in", list(DEMO_COMPANY_NAMES))])
    demo |= named
    if demo:
        children = Partner.search(
            [("id", "child_of", demo.ids), ("id", "not in", demo.ids)]
        )
        demo |= children

    overlap = demo & protected
    if overlap:
        sys.exit(
            "refusing to purge protected partners: %s"
            % ",".join("%s:%s" % (p.id, p.name) for p in overlap)
        )
    demo -= protected

    for partner in demo:
        if has_forbidden(partner.name):
            sys.exit("refusing forbidden partner name %s" % partner.name)
        for user in partner.user_ids:
            if user.id in (1, 2) or user.has_group("base.group_system"):
                sys.exit(
                    "refusing partner %s linked to Settings/system user %s"
                    % (partner.name, user.login)
                )

    leads = env["crm.lead"].browse() if "crm.lead" in env.registry else Partner.browse()
    if "crm.lead" in env.registry:
        leads = env["crm.lead"].browse(xmlids("crm.lead", module="crm", name_prefix="crm_case_"))
        if demo:
            leads |= env["crm.lead"].search([("partner_id", "in", demo.ids)])
        for lead in leads:
            if has_forbidden(lead.name):
                sys.exit("refusing forbidden lead name %s" % lead.name)
            partner = lead.partner_id
            if partner and partner not in demo and partner not in protected:
                sys.exit(
                    "refusing lead %s with non-demo partner %s"
                    % (lead.name, partner.name)
                )

    pos = env["purchase.order"].browse() if "purchase.order" in env.registry else Partner.browse()
    if "purchase.order" in env.registry:
        pos = env["purchase.order"].browse(
            xmlids("purchase.order", module="purchase", name_prefix="purchase_order_")
        )
        if demo:
            pos |= env["purchase.order"].search([("partner_id", "in", demo.ids)])
        for po in pos:
            if has_forbidden(po.name):
                sys.exit("refusing forbidden PO name %s" % po.name)
            partner = po.partner_id
            if partner and partner not in demo:
                sys.exit(
                    "refusing PO %s with non-demo partner %s"
                    % (po.name, partner.name)
                )

    moves = env["account.move"].browse() if "account.move" in env.registry else Partner.browse()
    statements = (
        env["account.bank.statement"].browse()
        if "account.bank.statement" in env.registry
        else Partner.browse()
    )
    if "account.bank.statement" in env.registry:
        statements = env["account.bank.statement"].browse(
            xmlids(
                "account.bank.statement",
                module="account",
                name_contains="demo",
            )
        )
    if "account.move" in env.registry:
        moves = env["account.move"].browse(
            xmlids("account.move", module="account", name_contains="demo")
        )
        if demo:
            moves |= env["account.move"].search([("partner_id", "in", demo.ids)])
        if statements:
            moves |= statements.mapped("line_ids").mapped("move_id")
        for move in moves:
            if has_forbidden(move.name or "") or has_forbidden(move.partner_id.name or ""):
                sys.exit("refusing forbidden move %s" % (move.name or move.id))
            partner = move.partner_id
            if (
                partner
                and partner not in demo
                and partner != company.partner_id
                and partner not in protected
            ):
                sys.exit(
                    "refusing move %s with non-demo partner %s"
                    % (move.name or move.id, partner.name)
                )
        posted = env["account.move"].search([("state", "=", "posted")])
        leftover = posted - moves
        demo_journals = moves.mapped("journal_id")
        for move in leftover:
            partner = move.partner_id
            if partner and partner not in demo and partner != company.partner_id:
                sys.exit(
                    "refusing posted move outside demo selection: %s partner=%s"
                    % (move.name or move.id, partner.name)
                )
            if move.journal_id in demo_journals and (
                not partner or partner == company.partner_id
            ):
                moves |= move
            else:
                sys.exit(
                    "refusing posted move outside demo selection: %s"
                    % (move.name or move.id)
                )

    pickings = (
        env["stock.picking"].browse()
        if "stock.picking" in env.registry
        else Partner.browse()
    )
    if "stock.picking" in env.registry and pos:
        pickings = env["stock.picking"].search(
            [("origin", "in", pos.mapped("name"))]
        )

    demo = demo.exists()
    leads = leads.exists()
    pos = pos.exists()
    moves = moves.exists()
    statements = statements.exists()
    pickings = pickings.exists()

    print("mode=%s" % ("apply" if APPLY else "dry-run"))
    print(
        "demo_partners=%s"
        % ",".join("%s:%s" % (p.id, p.name) for p in demo.sorted("id"))
    )
    print("demo_partner_count=%s" % len(demo))
    print("demo_lead_count=%s" % len(leads))
    print("demo_po_count=%s" % len(pos))
    print(
        "demo_po_states=%s"
        % ",".join("%s:%s" % (po.name, po.state) for po in pos)
    )
    posted_demo = moves.filtered(lambda move: move.state == "posted")
    print("demo_move_count=%s" % len(moves))
    print("demo_move_posted=%s" % len(posted_demo))
    print("demo_statement_count=%s" % len(statements))
    print("demo_picking_count=%s" % len(pickings))
    print(
        "protected_skipped=%s"
        % ",".join("%s:%s" % (p.id, p.name) for p in protected)
    )

    if not APPLY:
        print("dry_run=1 (pass --apply to mutate)")
        cr.rollback()
        sys.exit(0)

    lock_fields = (
        "fiscalyear_lock_date",
        "tax_lock_date",
        "hard_lock_date",
        "sale_lock_date",
        "purchase_lock_date",
    )
    for field in lock_fields:
        if field in company._fields and company[field]:
            print("clearing_%s=%s" % (field, company[field]))
            company[field] = False

    if moves:
        moves.line_ids.remove_move_reconcile()
        posted = moves.filtered(lambda move: move.state == "posted")
        if posted:
            posted.button_draft()
    if statements:
        statements.mapped("line_ids").unlink()
        statements.unlink()
    leftover_moves = moves.exists()
    draft = leftover_moves.filtered(lambda move: move.state == "draft")
    if draft:
        draft.button_cancel()
    leftover_moves = leftover_moves.exists()
    if leftover_moves:
        leftover_moves.unlink()

    if pickings:
        cancelable = pickings.filtered(lambda picking: picking.state not in ("cancel", "draft"))
        if cancelable:
            cancelable.action_cancel()
        pickings.exists().unlink()

    if pos:
        open_pos = pos.filtered(lambda po: po.state not in ("cancel", "draft"))
        if open_pos:
            open_pos.button_cancel()
        draft_pos = pos.exists().filtered(lambda po: po.state == "draft")
        if draft_pos:
            draft_pos.button_cancel()
        pos.exists().unlink()

    if leads:
        leads.unlink()

    archived_users = []
    archived = []
    demo_users = User.search([("partner_id", "in", demo.ids)])
    for user in demo_users:
        if user.id in (1, 2) or user.has_group("base.group_system"):
            sys.exit(
                "refusing partner %s linked to Settings/system user %s"
                % (user.partner_id.name, user.login)
            )
        if user.login == "n8n.fabric":
            sys.exit("refusing to archive n8n.fabric")
        user.active = False
        archived_users.append("%s:%s" % (user.id, user.login))
    env.flush_all()
    for partner in demo.exists():
        # Partner.write() searches users in self.env; active_test=False
        # would treat already-archived demo/portal users as blockers.
        partner.with_context(active_test=True).write({"active": False})
        archived.append("%s:%s" % (partner.id, partner.name))
    print("archived_users=%s" % (",".join(archived_users) if archived_users else "none"))
    print("archived_partners=%s" % (",".join(archived) if archived else "none"))

    if "crm.stage" in env.registry:
        Stage = env["crm.stage"]
        leftovers = Stage.search(
            [("name", "not in", list(FABRIC_STAGES)), ("team_id", "=", False)]
        )
        unused = leftovers.filtered(
            lambda stage: not env["crm.lead"].search_count(
                [("stage_id", "=", stage.id)]
            )
        )
        print(
            "unlinked_crm_stages=%s"
            % (",".join(unused.mapped("name")) if unused else "none")
        )
        unused.unlink()

    if "account.move" in env.registry:
        still_posted = env["account.move"].search_count([("state", "=", "posted")])
        if still_posted:
            sys.exit("posted account.move remain after purge: %s" % still_posted)
        print("posted_moves_after=0")
    print(
        "purchase_orders_after=%s"
        % (env["purchase.order"].search_count([]) if "purchase.order" in env.registry else 0)
    )
    print(
        "crm_leads_after=%s"
        % (env["crm.lead"].search_count([]) if "crm.lead" in env.registry else 0)
    )
    cr.commit()
    print("purge_applied=1")
PY
