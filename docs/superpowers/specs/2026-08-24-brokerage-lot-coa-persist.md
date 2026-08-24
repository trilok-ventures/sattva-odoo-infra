# Brokerage lot and GREEN COA persist (P0)

**Status:** Implemented on `cursor/paas-feature-ranking-952c` (tests: `TestBrokerageLot` green)  
**Date:** 2026-08-24  
**Owner:** IPCo  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md`  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §5.1 / §6.2 / §7

## Goal

Give Odoo a brokerage lot SoR row (not `stock.lot`) that defaults to quarantine. Persist `wf.coa.verify` GREEN compare onto that row. n8n never sets available-for-sale.

## Behaviour

- Model `sattva.brokerage.lot`: `state` ∈ {quarantine, available, rejected}; default quarantine.
- GREEN fields only: filename (basename), sha256, moisture %, mesh pass, spec thresholds, `coa_pass`.
- `sattva.fabric.lot.apply_coa_green` is the only n8n write path. Requires `group_n8n_fabric_service`. Always leaves `state=quarantine`. Fail opens a CAPA `mail.activity` for a human compliance officer.
- `action_release` is compliance-officer-only and requires `coa_pass`.
- RED PDF stays in Nextcloud. Filename must not contain `/` or `..`.

## Out of scope

Salmonella/TPC/pyruvic (P1 #8), buyer UI, OCR, `stock.quant`, n8n confirm.
