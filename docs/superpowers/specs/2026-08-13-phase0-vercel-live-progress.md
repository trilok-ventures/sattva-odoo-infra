# Phase 0 progress — live Vercel twin, Figma, Notion

**Status:** Recorded 2026-08-13 (Phase 0 UX; no live BFF)  
**Owner:** IPCo  
**Production:** https://sattva-odoo-infra.vercel.app/  
**Git is canonical.** This page is the GREEN digest of what shipped. Do not copy RED (file bytes, partner PII, vault paths, Compose passwords) into Notion.

---

## 1. What is live

Vercel project `sattva-odoo-infra` publishes **only** `docs/superpowers/mocks/` (`vercel.json` `outputDirectory` + deny-all `.vercelignore`). Production alias is public (not SSO-gated). Preview URLs may still require Vercel SSO.

| URL | Expected |
| --- | --- |
| https://sattva-odoo-infra.vercel.app/ | 200 → landing, meta-refresh to portal `?view=map` |
| https://sattva-odoo-infra.vercel.app/sattva-middleware-portal.html | 200 interactive SPA |
| https://sattva-odoo-infra.vercel.app/supplier-onboarding-chat.html | 200 chat gallery |
| https://sattva-odoo-infra.vercel.app/figma-capture.html | 200 hash-free capture index |
| https://sattva-odoo-infra.vercel.app/docker-compose.yml | **404** `NOT_FOUND` |
| https://sattva-odoo-infra.vercel.app/config/odoo.conf | **404** |

This host is **not** `app.trilokventures.org` (Phase 2 Next.js BFF) and **not** the Workstream 3 marketing site. The Next.js scaffold stays in `middleware/` until a separate Vercel project (or Root Directory `middleware/`) is funded.

Fictional demo data only: supplier **Example Foods Pvt Ltd**, buyer **Northshore Foods Inc**, PO **P00042**, SO **SO-1042**.

---

## 2. Merged work (this repo)

| PR | What landed |
| --- | --- |
| [#7](https://github.com/trilok-ventures/sattva-odoo-infra/pull/7) | Workstream 1 — integrated architecture spec + `fabric-architect` |
| [#8](https://github.com/trilok-ventures/sattva-odoo-infra/pull/8) | Workstream 2 — middleware UX spec, Next.js scaffold, lo-fi Figma |
| [#9](https://github.com/trilok-ventures/sattva-odoo-infra/pull/9) | Scripted supplier onboarding chat collector spec + HTML gallery |
| [#11](https://github.com/trilok-ventures/sattva-odoo-infra/pull/11) | Interactive dashboard twin + employee / buyer / seller E2E flows |
| [#12](https://github.com/trilok-ventures/sattva-odoo-infra/pull/12) | Vercel 404 fix: publish mocks only; stop serving the Odoo repo root |

**404 root cause (fixed):** GitHub integration treated the Odoo repo as a static site. `/` had no `index.html` → platform `NOT_FOUND`. The same mis-deploy served Compose/config as public files. Do not point this Vercel project at the repo root again.

---

## 3. Figma (blocked — do not pretend frames were updated)

| File | Key | State on 2026-08-13 |
| --- | --- | --- |
| [Sattva Middleware](https://www.figma.com/design/NcyHhLoppe3f72fs5KjrvP) | `NcyHhLoppe3f72fs5KjrvP` | Lo-fi: `00 · Persona Index`, `E1`, `E2`, `B2`, `P2`. **Not mutated** after the Vercel go-live. |
| [Sattva Supplier Onboarding Chat](https://www.figma.com/design/gv62Ar5Zngd62TxS323GVp) | `gv62Ar5Zngd62TxS323GVp` | Created empty; never filled. |

Authenticated MCP user: Arch Neo, **View** seat, Starter (`planKey` `team::1669487108376139932`). Monthly cap ~20 calls — **hit**. `whoami` works. `use_figma`, `get_metadata`, and `generate_figma_design` all 429. Figma docs list some write tools as rate-limit exempt; this Starter/View connection still rejects them.

**Until quota or a Full/Dev seat:** the live HTML twin is the interactive source of truth. Capture recipe (hash-free) is `docs/superpowers/mocks/figma-capture.html` and dashboard spec §5.

Prototype reactions to apply after capture: ON_CLICK → NAVIGATE for Map, Flows, S1–S4, E1–E7, B1–B3, P1–P3, E4 overlay; starting points Employee / Buyer / Seller.

---

## 4. Notion tasks-setup (existing board — not a new template)

Do **not** duplicate the Notion tasks-setup wizard. The board already exists:

- Database: [Fabric Implementation Tasks](https://app.notion.com/p/46215039e82947709763fe5de85533ab)
- Data source: `collection://5b022ca0-8147-4b49-ae13-e23d4c2e6d15`
- Parent: [System Fabric](https://app.notion.com/p/3bbe8d8c60c7816ba0def605bf847c5a)
- GREEN digest: [Phase 0 middleware twin is live](https://app.notion.com/p/3bbe8d8c60c781e58667f20852d6dbf8)

Properties: Task name, Assignee, Due, Evidence Link, Phase (0/1/2/3), Plan Task, Priority, Status (Not started / In progress / Done / Archived). Views: Default table, By Status board.

Rows added/updated 2026-08-13:

| Task | Status |
| --- | --- |
| [Workstream 2](https://app.notion.com/p/3bbe8d8c60c78100ac4bd22db6ee2d98) Evidence Link → production URL | In progress |
| [Phase 0 HTML twin live on Vercel](https://app.notion.com/p/3bbe8d8c60c781f1b16afccc9cd89405) | Done |
| [Capture live Vercel into Figma](https://app.notion.com/p/3bbe8d8c60c781cb81cbda3d76e01689) | In progress (MCP capped) |
| [Next.js BFF separate Vercel project](https://app.notion.com/p/3bbe8d8c60c781abb3cfd609ba9d758b) | Not started (Phase 2) |

Workstream 2 row is the UX home. Agents write **GREEN Content inbox** only; AMBER SOPs stay Draft / `agent_ok` off.

---

## 5. Locks (unchanged)

- Scripted chat (one turn = one field or file), not freeform LLM, not Odoo chatter.
- Conditional / probation → Odoo `review`. PO still blocked until `approved`. No fifth status. No “Confirm anyway”.
- Chat/portal never store PDF bytes; Nextcloud + hash + path in Odoo.
- Buyers/sellers never see vault/n8n hostnames.
- Phase 0: spec + Notion + mocks. No live Odoo/n8n/Keycloak BFF unless a later plan is approved.

---

## 6. Out of scope (still)

Partner form views in Odoo, n8n vendor folders, Keycloak, Cloudflare Access, GCP Compose-on-VM, HubSpot, LifeOS, storing RED in Notion or the prototype.
