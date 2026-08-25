# P3 buyer GREEN lot status (mock BFF)

**Status:** Implemented on `cursor/buyer-green-lots-952c` (middleware build + contract-check green). Next increment: `2026-08-25-p3-buyer-green-lots-json2.md`.  
**Date:** 2026-08-25  
**Owner:** IPCo  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md` (P3 #15; after P2 #14)  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §5.6 / §8 Phase 2  
**Prior slices:** `2026-08-24-brokerage-lot-coa-persist.md`, `2026-08-14-middleware-ux-design.md`  
**HoldCo BFF:** `2026-08-13-holdco-gcp-vercel-bff-rewire.md`

## Goal

Buyers (and employees in mock) can read GREEN lot status and **officer release** on the operations BFF in `middleware/` (`app.trilokventures.org`). `coa_pass` is never treated as available-for-sale. Live Keycloak stays off.

## Behaviour

- UI lives in `middleware/` only. Root `vercel.json` stays mocks-only. No `NEXT_PUBLIC_` fabric URLs, no WebDAV, no file bytes, no vault paths.
- `FABRIC_MODE=live` remains 401 on every non-health route **and** on HTML pages (Next.js middleware). Mock persona header / `?persona=` is not production auth.
- `GET /api/lots` returns GREEN fields plus `officer_released` (true only when lot `state === available`, the officer `action_release` flag) and `coa_present` (64-hex SHA-256 present). `coa_pass` stays the GREEN compare result and is labeled separately.
- Mock fixtures include **both** a released lot and a quarantined lot with `coa_pass=true` so the UI cannot collapse compare-pass into release. Buyers see only lots on their mock order `SO-1042`. Suppliers are 403.
- Screens: `/lots` (B1 cards) and `/lots/[id]` (B2 GREEN metrics + truncated hash). No COA download. No mill legal identity beyond optional display name (omitted for buyers). No B3 quotes in this slice.
- HTML twin `docs/superpowers/mocks/sattva-middleware-portal.html` B1/B2 copy is updated to the same two-signal contract so the mocks project does not teach the wrong model.

## Allowlists

Lot JSON (GREEN + officer flag): `id`, `sku`, `state`, `officer_released`, `coa_present`, `coa_pass`, `coa_sha256`, `moisture_pct`, `mesh_pass`, `salmonella_absent`, `tpc_cfu`, `pyruvic_umol`, `buyer_order`.

## Out of scope

`FABRIC_MODE=live`, Keycloak, B3 quotes/contracts, PDF bytes, `sale_management` ops install, retargeting root `vercel.json`, OCR / Hugging Face. Live Odoo JSON-2 lot adapter is the next increment (`2026-08-25-p3-buyer-green-lots-json2.md`).
