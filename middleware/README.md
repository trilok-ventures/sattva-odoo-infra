# Sattva Middleware Portal

The authenticated operations portal between people and the Sattva fabric
(Odoo CE SoR, n8n bus, Nextcloud vault). Holds **no business state** — every
read/write passes through a BFF layer to the fabric.

**Source of truth for behavior:** `docs/superpowers/specs/2026-08-14-middleware-ux-design.md`
**Lo-fi screens:** Figma file _Sattva Middleware_ (https://www.figma.com/design/NcyHhLoppe3f72fs5KjrvP)

## Status

Phase 1–2 scaffold. This directory currently contains the app shell, design
tokens, and the BFF route contract stubs only — no business logic until the
Phase 1 implementation plan is approved (see the integrated architecture spec,
`docs/superpowers/specs/2026-08-14-integrated-system-architecture.md` §7).

## Vercel (this monorepo)

The GitHub-connected Vercel project must **not** publish the repo root as a
static site: that 404s on `/` (no `index.html`) and would serve
`docker-compose.yml` / `config/odoo.conf`. Root `vercel.json` deploys only
`docs/superpowers/mocks/` (interactive dashboard twin). Production:
https://sattva-odoo-infra.vercel.app/ (PR #12). Figma capture index:
https://sattva-odoo-infra.vercel.app/figma-capture.html.

When the Phase 2 BFF is funded, create a **separate** Vercel project (or set
this project's Root Directory to `middleware/`) so `app.trilokventures.org`
runs this Next.js app. Do not point the Odoo repo root at production.

## Stack (locked by fabric spec)

- Next.js (App Router) on Vercel, project `app.trilokventures.org` (Phase 2+)
- Keycloak OIDC (authorization code + PKCE); Phase 1 local falls back to Odoo users
- Tailwind + shadcn/ui tokens, per the UX spec §6
- BFF route handlers call Odoo (JSON-2/XML-RPC), n8n webhooks, and Nextcloud
  WebDAV **server-side only** — no fabric credentials ever reach the browser

## Hard rules (enforced in review by the fabric-architect subagent)

1. No RED data (file bytes, PII, vault paths) in any client-bound payload.
2. The supplier compliance gate is never bypassable from the portal.
3. The only portal-local storage is the 30-day notifications inbox.
4. Every BFF route declares its persona field allow-list; contract tests assert it.
