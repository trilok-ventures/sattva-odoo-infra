# Brokerage lot and GREEN COA persist (P0)

**Status:** Implemented on `cursor/paas-feature-ranking-952c` (tests: `TestBrokerageLot` green)  
**Date:** 2026-08-24  
**Owner:** IPCo  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md`  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §5.1 / §6.2 / §7

## Goal

Give Odoo a brokerage lot SoR row (not `stock.lot`) that defaults to quarantine. Persist `wf.coa.verify` GREEN compare onto that row. n8n never sets available-for-sale.

## Behaviour

- Model `sattva.brokerage.lot`: `state` ∈ {quarantine, available, rejected}; default quarantine. `create` always stores quarantine and drops GREEN values. Public `write` rejects GREEN fields and any `state` change even if the client injects context flags. GREEN persist is `_write_coa_green` (always quarantine). `state=available` / `rejected` only via `action_release` / `action_reject` calling `super().write`.
- GREEN fields only: filename (strict basename), sha256, moisture %, mesh pass, spec thresholds, `coa_pass`. Mesh pass is required only when `spec_mesh_required`.
- `sattva.fabric.lot.apply_coa_green` is the only n8n write path. Requires `group_n8n_fabric_service`. Always leaves `state=quarantine`. Fail opens a CAPA `mail.activity` for a human compliance officer.
- `action_release` is compliance-officer-only, denies the n8n fabric group even if dual-grouped, and requires quarantine + `coa_pass` + a 64-hex `coa_sha256`.
- RED PDF stays in Nextcloud. Lot chatter rejects attachments. Filename must be `os.path.basename` with no `/`, `\`, NUL, or `..`.
- HMAC GREEN metadata webhook is the persist path. The Nextcloud COA webhook node stays disconnected (OCR is out of scope).

## Out of scope

Salmonella/TPC/pyruvic (P1 #8), buyer UI, OCR, `stock.quant`, n8n confirm.
