# P1 GREEN CoA metric pack (Salmonella, TPC, pyruvic)

**Status:** Implemented on `cursor/paas-feature-ranking-952c` (`TestBrokerageLot` + `TestProductGreenSpecs` green)  
**Date:** 2026-08-24  
**Owner:** IPCo  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md` (P1 #8)  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §3.3 / §5.9 / §6.2 / §7  
**Prior slice:** `2026-08-24-brokerage-lot-coa-persist.md`

## Goal

Extend the GREEN CoA compare with Salmonella, TPC, and onion-only pyruvic. Persist numbers and spec thresholds on `sattva.brokerage.lot`. n8n still never sets available-for-sale. RED PDFs stay in Nextcloud.

## Behaviour

- Measurements and thresholds travel in the HMAC GREEN metadata webhook. No PDF bytes, paths, or nested objects.
- Lot snapshots: `salmonella_absent`, `spec_salmonella_required`, `tpc_cfu`, `spec_tpc_max`, `pyruvic_umol`, `spec_pyruvic_required`, `spec_pyruvic_min`.
- Compare (same formula in Odoo and `wf.coa.verify`):
  - moisture ≤ spec max
  - mesh: `not spec_mesh_required or mesh_pass`
  - Salmonella: `not spec_salmonella_required or salmonella_absent`
  - TPC: `tpc_cfu <= spec_tpc_max`
  - pyruvic: `not spec_pyruvic_required or pyruvic_umol >= spec_pyruvic_min`
- Pyruvic is required only when the product crop is onion (`product.template.spec_pyruvic_required`). The webhook carries that flag; n8n does not look up the product.
- `coa_pass` still does not mean available-for-sale. Fail stays quarantine and opens CAPA. Officer `action_release` is unchanged.
- Public `write()` still rejects every GREEN key. `_write_coa_green` still requires the n8n fabric group.

## Product spec SoR

`product.template` holds catalog GREEN specs (`sattva_crop`, moisture/mesh/TPC/Salmonella, pyruvic min). Crop `onion` computes `spec_pyruvic_required`. Officers copy those values into the webhook payload until a later dated helper reads them in Odoo.

## Out of scope

OCR, credit score, DDP/IoR, buyer portal, `/Logistics/` MKCOL, n8n confirm, Keycloak, `stock.lot`.
