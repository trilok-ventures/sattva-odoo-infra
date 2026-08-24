# P1 sale gates and partner fields (SFC, exporter IDs, 3PL, Incoterms)

**Status:** Implementing  
**Date:** 2026-08-24  
**Owner:** IPCo  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md` (P1 #3–7, #9)  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §3.2 / §5.3

## Goal

Gate **sale** confirmation in Odoo Python. Store AMBER buyer SFC, exporter IDs, and 3PL/forwarder fields on `res.partner`. Restrict Incoterms to FOB / CIF / DAP. Queue per-SO vault folders. n8n never calls confirm.

## Behaviour

- Buyer `buyer_sfc_status` ∈ {pending, active, suspended, expired}; default pending. Confirm requires **active**. KYC complete does not unlock PO or SO.
- Supplier AMBER pointers: Spices Board RCM, FSSAI, optional US FDA, `steam_sterilization_cap`, `last_audit_date`. PDFs stay in `/Suppliers/{name}/Certificates/`. Officer still sets `supplier_pcp_status`.
- 3PL / forwarder: `is_logistics_partner` (not `supplier_rank`). `forwarder_status` default pending. CBSA bond / insurance are Char pointers. `cfia_swi_capable` plus FOB/CIF/DAP capability flags. Creating a logistics-only partner must not queue a supplier vault folder.
- `sale.order`: `sattva_incoterm` FOB/CIF/DAP (no DDP), `forwarder_id`, `purchase_intent_id`, `nextcloud_order_folder_path`.
- Every confirm: SFC active + approved forwarder whose Incoterm flags include the order term.
- First confirm for a buyer also requires a linked PO intent whose supplier is PCP-approved. Subsequent confirms skip that extra. n8n does not confirm.
- SO create queues `order_folder_requested` for `/Clients/{name}/Orders/{SO}/`. `sattva.fabric.vault.set_order_path` is the n8n write path.

## Module note

The addon depends on `sale` so `sale.order` exists when the module loads. Production **sale_management** app enablement (menus, quotes UX, no demo data) remains a separate Phase 3a T1 ops slice.

## Out of scope

Salmonella/TPC/pyruvic (P1 #8), credit score, DDP/IoR, n8n draft→sale, Keycloak, buyer portal.
