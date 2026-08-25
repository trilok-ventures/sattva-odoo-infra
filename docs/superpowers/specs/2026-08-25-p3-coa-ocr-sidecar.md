# P3 COA OCR slice 2 — GREEN sidecar producer

**Status:** Implemented on `cursor/coa-green-sidecar-952c`  
**Date:** 2026-08-25  
**Owner:** IPCo  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md` (P3 #16)  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §5.9 / §3.3 / §6.2  
**Prior slice:** `2026-08-25-p3-coa-ocr-green.md` (`wf.coa.ocr` HMAC JSON webhook)

## Goal

Move GREEN CoA numbers next to the vault PDF as a **sidecar**, so operators stop pasting the full allowlist into `/webhook/coa-ocr`. n8n may WebDAV-GET **only** `*.green.json`. The source PDF never leaves Nextcloud. n8n never hashes or forwards PDF bytes. Persist remains `apply_coa_green`. n8n never releases the lot.

## Behaviour

- Nextcloud holds the RED CoA PDF (`{filename}`) and a GREEN sidecar named `{filename}.green.json` under the supplier Certificates folder (`nextcloud_folder_path`).
- Sidecar JSON is the same GREEN allowlist as slice 1 (`lot_id`, basename `filename`, 64-hex `sha256` of the **PDF**, moisture/mesh/Salmonella/TPC/pyruvic + specs). `sha256` is operator-attested; this slice does not GET the PDF to re-hash it.
- `POST /webhook/coa-ocr-sidecar` with `x-sattva-webhook-hmac` allowlists `{ lot_id, sidecar_basename }` only. `responseMode: onReceived`. Unknown keys and nested objects fail closed.
- `sidecar_basename` must be a basename ending in `.green.json` (not `.pdf`). Odoo `sattva.fabric.lot.resolve_coa_sidecar` returns `{ lot_id, sidecar_basename, vault_href }` where `vault_href` is `{supplier Certificates path}{sidecar_basename}` under `/Suppliers/`. Path comes from Odoo, not the webhook.
- n8n GETs that one href (text, size cap 8192 bytes). It rejects `%PDF` magic, n8n binary treated as PDF, paths, and any sidecar `filename` that is not the stem of `sidecar_basename`. `lot_id` in the JSON must match the trigger. Then `apply_coa_green`.
- No PROPFIND (do not list PDFs). No GET of `.pdf`. No Hugging Face node. No `action_release` / confirm. `saveData*Execution: none`.

## Allowlists

Webhook: `lot_id`, `sidecar_basename`.

Sidecar JSON: slice 1 `COA_GREEN_ALLOWLIST`. RED names (`bytes`, `pdf`, `path`, `file_bytes`, `nextcloud_folder_path`, `vault_href`) fail closed.

## Out of scope

Live Hugging Face in n8n, Vertex DLP, in-Nextcloud PDF OCR, page images to HF, order-folder sidecars, Keycloak, `FABRIC_MODE=live`, retargeting root `vercel.json`.
