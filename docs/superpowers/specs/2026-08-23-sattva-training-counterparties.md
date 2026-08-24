# Phase 3a T1 — training counterparties (operator-gated)

**Status:** Operating spec (does not edit the locked fabric)  
**Date:** 2026-08-23  
**Owner:** IPCo (script); Sattva Brokers OpCo (training use)  
**Supersedes for this fixture only:** `2026-08-23-phase3a-t1-sor-init.md` §4 “no counterparties on prod”  
**Companion:** empty-reset `2026-08-23-sattva-empty-odoo-reset.md`

The operator asked for **one sample supplier** and **one sample client** on the
live `sattva` database so Contacts, Compliance fields, fabric events, and n8n
folder endpoints can be used for internal training and documentation.

These rows are **labeled TRAINING fixtures**, not live counterparties. They do
not unlock the PCP gate. They are not Riverbank / Example Foods / P00042.

## Decision

Create exactly two `res.partner` rows (plus optional catalog/lead furniture
listed below). Leave every compliance flag at the model default. Let n8n
create vault folders. Do **not** write `approved`, do **not** upload COA
PDFs, do **not** persist a PO/SO/invoice.

| Row | Name | Role | Compliance defaults |
| --- | --- | --- | --- |
| Supplier | `TRAINING Onion Packhouse` | `supplier_rank=1` | `supplier_pcp_status=pending`, `risk_band=medium`, HACCP/BRC false |
| Client | `TRAINING Canadian Buyer` | `customer_rank=1` | `buyer_kyc_status=pending` (never unlocks PO) |
| Catalog (optional, GREEN) | `TRAINING Onion Flake` | `product.template` | `sattva_crop=onion`, `sattva_format=flake`; spec thresholds unset |
| Lead (optional) | `TRAINING Buyer Discovery` | `crm.lead` on the client | Discovery stage; GREEN score empty until `wf.lead.score` |

## What the script must not do

- Mention or create `Riverbank Organic Farm`, `Example Foods`, `P00042`, `SO-1042`
- Set `supplier_pcp_status=approved` (or `blocked` / `review`)
- Set `haccp_certified` / `brc_certified` true, or `buyer_kyc_status=complete`
- Call `button_confirm`, `create_po_intent`, or persist RFQ/SO/invoice/lot
- MKCOL or `set_partner_path` itself (n8n is the only folder writer)
- Upload files to Nextcloud
- Run from `init-sor.sh` (SoR init stays empty-config)
- Impersonate `n8n.fabric` or copy `odoo-n8n-api-key`

## Endpoints exercised (live)

| Endpoint | How training hits it |
| --- | --- |
| `res.partner.create` | script `--apply` |
| `sattva.fabric.event` `supplier_folder_requested` / `buyer_folder_requested` | partner create hook |
| `wf.supplier.folder` / `wf.buyer.onboard.folder` | n8n poll or `n8n execute` after apply |
| `sattva.fabric.vault.set_partner_path` | n8n only, after MKCOL |
| `purchase.order.button_confirm` | rolled-back probe only (must stay blocked) |
| `wf.lead.score` | optional GREEN POST (`hashed_partner_id`, `stage_rank`, `days_in_stage`, `product_family_code`, `order_count`, `lead_id`) |
| `wf.coa.verify` / `wf.order.handoff` / `wf.notify.role` | documented, not seeded (RED / money / activities) |

## Command

```bash
sudo ./deploy/gcp/seed-training-counterparties.sh          # dry-run
sudo ./deploy/gcp/seed-training-counterparties.sh --apply
```

Idempotent: re-apply searches by exact TRAINING name and refuses to rewrite PCP.

## After first live supplier

Archive these TRAINING partners (and the TRAINING product/lead) before the first
live PO. Do not treat `approved` as a convenience flag on either fixture.
