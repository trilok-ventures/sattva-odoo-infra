#!/usr/bin/env bash
# Create the two TRAINING counterparties (pending only). Dry-run by default.
# Does not approve PCP, upload COA, persist PO/SO, or write vault paths.
#
#   sudo ./deploy/gcp/seed-training-counterparties.sh
#   sudo ./deploy/gcp/seed-training-counterparties.sh --apply
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
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      log "unknown arg: ${arg}"
      exit 1
      ;;
  esac
done

WEB="${ODOO_WEB_CONTAINER:-sattva-prod-web}"
N8N="${N8N_CONTAINER:-sattva-prod-n8n}"
CONF="${ODOO_CONF:-/tmp/odoo.conf}"

if ! docker inspect "${WEB}" >/dev/null 2>&1; then
  log "missing container ${WEB}"
  exit 1
fi

export SEED_APPLY="${APPLY}"
log "training fixture plan (PCP stays pending; no Riverbank/Example Foods)"
docker exec -i -e ODOO_CONF="${CONF}" -e SEED_APPLY="${APPLY}" "${WEB}" python3 - <<'PY'
import os
import sys

import odoo
from odoo import SUPERUSER_ID, api
from odoo.exceptions import UserError
from odoo.modules.registry import Registry

FORBIDDEN = (
    "Riverbank Organic Farm",
    "Example Foods",
    "P00042",
    "SO-1042",
)
SUPPLIER = "TRAINING Onion Packhouse"
CLIENT = "TRAINING Canadian Buyer"
PRODUCT = "TRAINING Onion Flake"
LEAD = "TRAINING Buyer Discovery"

odoo.tools.config.parse_config(["-c", os.environ.get("ODOO_CONF", "/tmp/odoo.conf"), "--no-http"])
registry = Registry("sattva")
apply = os.environ.get("SEED_APPLY") == "1"

with registry.cursor() as cr:
    env = api.Environment(cr, SUPERUSER_ID, {})
    Partner = env["res.partner"]
    for name in FORBIDDEN:
        if Partner.search([("name", "=", name)], limit=1):
            sys.exit("refusing leftover forbidden name: %s" % name)

    supplier = Partner.search([("name", "=", SUPPLIER)], limit=1)
    client = Partner.search([("name", "=", CLIENT)], limit=1)
    product = (
        env["product.template"].search([("name", "=", PRODUCT)], limit=1)
        if "product.template" in env.registry
        else env["product.template"]
    )
    lead = (
        env["crm.lead"].search([("name", "=", LEAD)], limit=1)
        if "crm.lead" in env.registry
        else env["crm.lead"]
    )

    print("supplier_exists=%s" % bool(supplier))
    print("client_exists=%s" % bool(client))
    print("product_exists=%s" % bool(product))
    print("lead_exists=%s" % bool(lead))
    print("planned_supplier=%s" % SUPPLIER)
    print("planned_client=%s" % CLIENT)
    print("planned_pcp=pending")
    print("planned_kyc=pending")
    print("mode=%s" % ("apply" if apply else "dry-run"))

    if not apply:
        cr.rollback()
        raise SystemExit(0)

    canada = env.ref("base.ca")
    india = env.ref("base.in")
    comment = (
        "TRAINING FIXTURE — not a live counterparty. "
        "Do not set PCP approved. Archive before the first live PO."
    )

    if not supplier:
        supplier = Partner.create(
            {
                "name": SUPPLIER,
                "is_company": True,
                "supplier_rank": 1,
                "customer_rank": 0,
                "country_id": india.id,
                "comment": comment,
                "email": "training.packhouse@invalid.example",
            }
        )
    if supplier.supplier_pcp_status != "pending":
        sys.exit("refusing to keep non-pending PCP on %s" % SUPPLIER)
    if supplier.haccp_certified or supplier.brc_certified:
        sys.exit("refusing certified flags on %s" % SUPPLIER)
    if supplier.customer_rank > 0:
        sys.exit("refusing dual-rank on %s" % SUPPLIER)

    if not client:
        client = Partner.create(
            {
                "name": CLIENT,
                "is_company": True,
                "supplier_rank": 0,
                "customer_rank": 1,
                "country_id": canada.id,
                "comment": comment,
                "email": "training.buyer@invalid.example",
            }
        )
    if client.buyer_kyc_status != "pending":
        sys.exit("refusing to keep non-pending KYC on %s" % CLIENT)
    if client.supplier_rank > 0:
        sys.exit("refusing dual-rank on %s" % CLIENT)

    onion = env["product.category"].search([("name", "=", "Onion")], limit=1)
    if not product:
        vals = {
            "name": PRODUCT,
            "sattva_crop": "onion",
            "sattva_format": "flake",
            "sale_ok": True,
            "purchase_ok": True,
            "type": "consu",
        }
        if onion:
            vals["categ_id"] = onion.id
        product = env["product.template"].create(vals)

    stage = env["crm.stage"].search([("name", "=", "Discovery")], limit=1)
    if not lead:
        lead_vals = {
            "name": LEAD,
            "partner_id": client.id,
            "type": "opportunity",
        }
        if stage:
            lead_vals["stage_id"] = stage.id
        lead = env["crm.lead"].create(lead_vals)

    events = env["sattva.fabric.event"].search(
        [("partner_id", "in", [supplier.id, client.id])]
    )
    cr.commit()
    print("committed_supplier_id=%s" % supplier.id)
    print("committed_client_id=%s" % client.id)
    print("committed_product_id=%s" % product.id)
    print("committed_lead_id=%s" % lead.id)
    print("pcp_status=%s" % supplier.supplier_pcp_status)
    print("kyc_status=%s" % client.buyer_kyc_status)
    print("product_family_code=%s" % (product.product_family_code or ""))
    for event in events:
        print(
            "event id=%s type=%s state=%s path=%s"
            % (event.id, event.event_type, event.state, event.requested_path)
        )

# Rolled-back PCP probe — TRAINING rows stay; no PO is committed
with registry.cursor() as cr:
    env = api.Environment(cr, SUPERUSER_ID, {})
    supplier = env["res.partner"].search([("name", "=", SUPPLIER)], limit=1)
    product = env["product.template"].search([("name", "=", PRODUCT)], limit=1)
    po = env["purchase.order"].create(
        {
            "partner_id": supplier.id,
            "order_line": [
                (
                    0,
                    0,
                    {
                        "product_id": product.product_variant_id.id,
                        "product_qty": 1,
                        "price_unit": 1,
                    },
                )
            ],
        }
    )
    blocked = False
    try:
        po.button_confirm()
    except UserError as exc:
        blocked = "Compliance Gate Blocked" in str(exc)
        print("pcp_gate_blocked=%s" % blocked)
    if not blocked:
        sys.exit("PCP gate did not block the TRAINING supplier")
    cr.rollback()
    print("pcp_gate_rollback=1")
PY

if [[ "${APPLY}" != "1" ]]; then
  log "dry_run=1 — pass --apply to create the TRAINING partner pair"
  exit 0
fi

if docker inspect "${N8N}" >/dev/null 2>&1; then
  log "Triggering n8n folder workflows (MKCOL + set_partner_path). No COA upload."
  docker exec "${N8N}" n8n execute --id=wf-supplier-folder >/tmp/n8n-training-supplier.log 2>&1 \
    && log "n8n_execute=wf-supplier-folder" \
    || log "warning_n8n_supplier_execute_failed (cron will retry)"
  docker exec "${N8N}" n8n execute --id=wf-buyer-onboard-folder >/tmp/n8n-training-buyer.log 2>&1 \
    && log "n8n_execute=wf-buyer-onboard-folder" \
    || log "warning_n8n_buyer_execute_failed (cron will retry)"
else
  log "n8n container missing; folder events stay queued until n8n polls"
fi

log "Training counterparties ready. PCP stays pending. See docs/runbooks/training-counterparties.md"
