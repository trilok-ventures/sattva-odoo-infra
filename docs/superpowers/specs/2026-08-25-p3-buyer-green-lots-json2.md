# P3 buyer GREEN lots — read-only JSON-2 adapter

**Status:** In progress on `cursor/buyer-green-lots-952c`  
**Date:** 2026-08-25  
**Owner:** IPCo  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md` (P3 #15)  
**Prior slice:** `2026-08-25-p3-buyer-green-lots.md` (mock B1/B2 board)  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §5.6 / §8 Phase 2  
**HoldCo BFF:** `2026-08-13-holdco-gcp-vercel-bff-rewire.md` §4–§5

## Goal

The operations BFF reads GREEN brokerage-lot status from Odoo over JSON-2 (`svc.portal.odoo` / `middleware.bff` style credentials). The mock persona header remains the only auth until Keycloak. `FABRIC_MODE=live` stays off (401 on every non-health route).

## Behaviour

- Browsers still call `/api/lots` and `/lots` on `middleware/` only. Root `vercel.json` stays mocks-only. No `NEXT_PUBLIC_` fabric URLs, no WebDAV, no file bytes, no vault paths.
- When `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, and `ODOO_API_KEY` are all set, `lots()` calls `sattva.fabric.portal.list_lots` (search/read projection). Other adapter methods stay on the in-repo mock.
- When any of those vars is unset (CI, local without secrets), `lots()` stays on the mock fixtures (L-882 released + L-901 quarantine with `coa_pass=true`).
- `list_lots` is read-only. It never calls `write`, `action_release`, `action_reject`, `button_confirm`, or `action_confirm`. n8n fabric service cannot call it.
- Buyer persona passes `ODOO_BUYER_PARTNER_ID`. Lots are those linked via `sattva.dossier.entry` to that partner’s sale orders. Missing partner id → empty list (fail closed). Employees pass no partner id and see every lot.
- Payload keys match slice 1. Odoo does **not** send `officer_released`; the BFF derives it from `state === "available"`. `coa_pass` remains the GREEN compare field and is never treated as available-for-sale.
- Buyers still 403 suppliers. Mill legal identity and `vault_href` never leave Odoo on this path.

## Out of scope

`FABRIC_MODE=live`, Keycloak, B3 quotes/contracts, PDF bytes, `sale_management` production enablement, retargeting root `vercel.json`, OCR / Hugging Face, n8n calling this method.
