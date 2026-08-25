# P2 traceability dossier hash index

**Status:** Implemented on `cursor/paas-feature-ranking-952c` (`TestDossierIndex` green)  
**Date:** 2026-08-25  
**Owner:** IPCo  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md` (P2 #13; substitute for P4 #29)  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §3.1 / §5.2 / §5.3 / §6.2 / §8.6  
**Prior slices:** `2026-08-24-brokerage-lot-coa-persist.md`, `2026-08-24-p1-sale-gates-partner-fields.md`

## Goal

Index the filenames and SHA-256 hashes of files already in the order vault folder onto Odoo. Nextcloud remains the file SoR. This is not a digitally signed pack (Phase 3 PKI / P4 #29).

## Behaviour

- Model `sattva.dossier.entry`: `filename` (basename), `sha256` (64 hex), `vault_href` (AMBER path under `/Clients/{name}/Orders/{SO}/`), optional `doc_kind` ∈ {coa, bl, packing, other}, `sale_order_id` required, `lot_id` optional. No binary fields, no `mail.thread` (no Odoo filestore archive). Mismatch activities live on the lot.
- Public `create` / `write` / `unlink` are denied. The only write path is `sattva.fabric.dossier.apply_index` (n8n fabric service). Users and officers may read.
- `apply_index(sale_order_id, lot_id, entries)` upserts by `(sale_order_id, filename)`. Same hash is idempotent. A new hash updates the row (tracking). Unknown keys, nested objects, file bytes, and path-like filenames are rejected. Cap 20 entries per call.
- `vault_href` must equal `{order_path}{filename}` where `order_path` ends with `/` and is the sale order’s `nextcloud_order_folder_path`. Webhook callers do not supply a vault path. If `lot_id` and the order’s PO intent are both set, the lot’s `purchase_order_id` must match.
- `wf.dossier.index` is HMAC (`N8N_WEBHOOK_HMAC`, IT/operator — not the public inbound secret). Payload allowlist: `sale_order_id`, optional `lot_id`. `responseMode: onReceived`. `saveData*Execution: none`.
- n8n PROPFIND-lists the order folder, GET-hashes each file **in memory**, then drops the binary before the Odoo call. Logs and the persist payload may contain filenames and hashes only. No file GET body is written to Odoo, Vercel, HF, or Notion.
- Indexing never calls `button_confirm`, `action_confirm`, `action_release`, or `action_reject`. A COA filename whose hash disagrees with `lot.coa_sha256` opens a compliance activity; lot state is unchanged.
- `doc_kind` is inferred from the basename when omitted (`coa`, packing-list tokens, bill-of-lading tokens; else `other`).

## Allowlists

Webhook: `sale_order_id`, `lot_id`.

Index entry: `filename`, `sha256`, `vault_href`, `doc_kind`.

## Out of scope

PKI / CMS signatures, `/Logistics/` MKCOL, buyer portal file bytes, OCR, `stock.lot`, n8n confirm/release, public inbound HMAC reuse, retargeting root `vercel.json`.
