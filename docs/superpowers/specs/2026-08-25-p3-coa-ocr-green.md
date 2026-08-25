# P3 COA OCR — GREEN extracts to Hugging Face

**Status:** Implemented on `cursor/coa-green-ocr-952c`  
**Date:** 2026-08-25  
**Owner:** IPCo  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md` (P3 #16)  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §5.9 / §3.3  
**Prior path:** `wf.coa.verify` (manual GREEN metadata webhook)  
**Next increment:** `2026-08-25-p3-coa-ocr-sidecar.md`

## Goal

Put a DLP/hash gate in front of CoA number handling so Hugging Face can see **GREEN extracts only**. The source PDF never leaves Nextcloud. n8n never logs file bytes. Odoo still persists via `apply_coa_green`. n8n never releases the lot.

## Behaviour

- `POST /webhook/coa-ocr` with `x-sattva-webhook-hmac` accepts the same GREEN allowlist as `wf.coa.verify` (`lot_id`, basename `filename`, 64-hex `sha256`, moisture/mesh/Salmonella/TPC/pyruvic + specs).
- Unknown keys fail closed, including RED names: `bytes`, `pdf`, `path`, `file_bytes`, `nextcloud_folder_path`, `vault_href`.
- `n8n/workflows/coa-ocr-green.mjs` is the SoR for “what HF is allowed to receive”. `toHfInputs()` copies **numbers + `sha256` only** — never `lot_id`, `filename`, paths, or bytes (fabric §5.9). `classifyWithOptionalHf()` calls `https://router.huggingface.co/hf-inference/models/{HF_COA_MODEL}` only when both `HF_API_TOKEN` and `HF_COA_MODEL` are set; otherwise it returns the local GREEN extract (`ocr_source=local`). HF responses are re-allowlisted and merged onto the original persist fields.
- `wf.coa.ocr` is the imported HMAC/DLP hop: it does **not** call Hugging Face. It rejects n8n binary attachments, then `sattva.fabric.lot.apply_coa_green`. It does not WebDAV-GET, PROPFIND, download PDFs, or call `action_release` / `button_confirm`.
- Compare and officer release stay in Odoo. `coa_pass` is still not available-for-sale.

## Out of scope

Vertex DLP jobs, live PDF OCR inside Nextcloud, sending page images to HF, Keycloak, `FABRIC_MODE=live`, buyer UI, retargeting root `vercel.json`.
