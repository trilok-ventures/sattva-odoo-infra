# P2 replenishment nudge (CRM, not inventory)

**Status:** Implemented on `cursor/replenishment-nudge-952c` (`TestReplenishmentNudge` 10/10 green)  
**Date:** 2026-08-25  
**Owner:** IPCo  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md` (P2 #14; next slice after §5 item 7 / P2 #13)  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §3.1 / §3.3 / §5.2  
**Prior slices:** `2026-08-24-p2-credit-score-v1.md`, `2026-08-25-p2-dossier-hash-index.md`

## Goal

Open one sales `mail.activity` on the **buyer** when the last confirmed SO plus assumed ocean transit (paper: 45-day stockout) is due. Sattva does not hold stock. Forecast is CRM, not `stock.quant`.

## Behaviour

- Constant `ASSUMED_OCEAN_TRANSIT_DAYS = 45`. Not a warehouse lead time, not `stock.rule`, not `ir.config_parameter` in this slice.
- Last confirmed SO = newest `sale.order` in `sale` or `done` for the commercial partner (`partner_id` child_of). Draft / cancel do not count. Delivery contacts attribute to `commercial_partner_id`.
- Due date = `date_order` (date part) + 45 days. Scan creates the activity only when `due <= today`.
- Activity is on `res.partner` (the buyer), assigned via the existing notify helper (`sales.exec` → first eligible human `sales_team.group_sale_salesman`, never the n8n fabric service user). Summary: `SATTVA: Replenishment nudge [{SO name}]`. `date_deadline` is the due date. GREEN/AMBER only: buyer id, SO id/name, due date. No COA bytes, emails, or vault paths.
- `sattva.fabric.notify.create_partner_role_activity` is the partner-shaped sibling of `create_role_activity`. `wf.notify.role` stays lead-only.
- `scan_replenishment_nudges(partner_id=False)` is n8n-fabric (or superuser cron) only. Optional `partner_id` limits to that commercial buyer. Return value is a list of `{activity_id, partner_id, sale_order_id}` — ids only.
- Idempotency: partner field `sattva_replenishment_nudge_so_id` (readonly AMBER pointer) stores the last SO that already opened a nudge. Writes require context `sattva_replenishment_scan` **and** `require_n8n_fabric_service` (superuser cron still passes). A newer confirmed SO can open a later nudge once *its* due date arrives. An open activity with the same summary is also skipped.
- Odoo `ir.cron` runs the scan daily (business rule lives with SO data). `wf.replenishment.nudge` is HMAC pass-through for an IT/operator trigger (`N8N_WEBHOOK_HMAC`, not the public inbound secret). Payload allowlist: optional `partner_id`. `saveData*Execution: none`. n8n does not compute due dates, hold forecast state, confirm SO/PO, or release lots.
- Scan never creates `stock.quant`, `stock.warehouse`, orderpoints, replenishment orders, or `stock.lot`. n8n still must not call `button_confirm`, `action_confirm`, or `action_release`.

## Allowlists

Webhook: optional `partner_id` (positive integer). Nested objects and unknown keys are rejected. Empty `{}` scans every buyer.

## Out of scope

Odoo inventory as brokerage stock, buyer portal / live BFF, Keycloak, `sale_management` ops install, retargeting root `vercel.json`, PKI dossiers, live bureau credit.
