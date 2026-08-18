# Sattva Middleware Portal

Authenticated operations BFF between people and the Sattva fabric
(Odoo CE SoR and n8n bus). Holds **no business state** and has no WebDAV
credentials or connection to the Nextcloud vault.

**Behavior spec:** `docs/superpowers/specs/2026-08-14-middleware-ux-design.md`  
**GCP / HoldCo rewire:** `docs/superpowers/specs/2026-08-13-holdco-gcp-vercel-bff-rewire.md`  
**Lo-fi + live HTML twin:** https://sattva-odoo-infra.vercel.app/

## Status

Phase 2 BFF contract is implemented in **mock mode** (`FABRIC_MODE=mock`).
Live adapters are Odoo JSON-2 (`svc.portal.odoo`) and n8n webhooks
(`svc.portal.n8n`) only. The BFF never speaks WebDAV. File bytes go to
origin `upload.` (production) or `127.0.0.1:8091` (local T0 test sink).
Do not treat mock KPIs as production SoR.

## Two Vercel projects

The GitHub-connected project `sattva-odoo-infra` publishes **only**
`docs/superpowers/mocks/` (PR #12). This `middleware/` app needs a **separate**
Vercel project with Root Directory `middleware/` (`app.trilokventures.org`).
Do not change the mocks project's Root Directory to this folder.

## Local

```bash
cp .env.example .env.local   # FABRIC_MODE=mock
npm install
npm run dev                  # http://127.0.0.1:3010
npm run test                 # needs the server up, or runs unit strip checks
```

Mock persona: header `x-sattva-persona` (`sales` | `compliance` | `finance` |
`it` | `buyer` | `supplier` | `logistics`). In `FABRIC_MODE=live`, every non-health `/api` route is 401 until Keycloak.

## Hard rules

1. No RED data (file bytes, PII, vault paths) in any client-bound payload.
2. The supplier compliance gate is never bypassable (`confirm_anyway` is always false).
3. The only portal-local storage allowed later is the 30-day notifications inbox.
4. Never `NEXT_PUBLIC_` for Odoo, n8n, or Nextcloud URLs or keys.

## Stack (locked)

- Next.js App Router on Vercel (separate project)
- Keycloak OIDC in Phase 3; mock header until then
- BFF route handlers call Odoo / n8n **server-side only**; document bytes upload
  directly to the separately allowlisted origin
