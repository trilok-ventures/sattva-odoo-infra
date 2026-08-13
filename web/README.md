# Trilok Ventures — public website

Public-facing site for Trilok Ventures (HoldCo) and Sattva Brokers (OpCo).
**PUBLIC/GREEN content only.** Authentication hands off to Keycloak and routes
users into the middleware portal (`middleware/`, Workstream 2).

**Source of truth for behavior:** `docs/superpowers/specs/2026-08-14-public-web-keycloak.md`

## Status

Phase 2 scaffold: static content pages + `/signin` in **mock mode** (no live
IdP required). The Keycloak OIDC handoff (`/api/auth/login`) returns 501 until
the Phase 3 plan wires the `trilok` realm.

## Develop

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # must pass with no env vars (CI contract)
```

## Environment (production only, set in Vercel — never in git)

| Var | Purpose |
| --- | --- |
| `KEYCLOAK_ISSUER` | e.g. `https://auth.trilokventures.org/realms/trilok` |
| `KEYCLOAK_CLIENT_ID` | `web-public` client |
| `SESSION_SECRET` | encrypted session cookie key |

## Hard rules

1. No RED/AMBER content. Supplier names, COA data, and lot records never
   appear on this site.
2. The site never writes to Odoo. Inquiries go to email; Odoo lead creation
   happens only via an approved n8n inbound workflow.
3. Sign-in only routes to the portal — no protected content lives here.
