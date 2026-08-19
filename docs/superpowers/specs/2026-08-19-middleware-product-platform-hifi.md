# Sattva Middleware — Product Platform (hi-fi) and deployment follow-along

**Status:** Proposed (Phase 0/2 design; does not skip Phase 1 Compose acceptance)  
**Date:** 2026-08-19  
**Owner:** IPCo  
**Depends on:** locked fabric `2026-08-13-sattva-brokers-system-fabric-design.md`, integrated architecture `2026-08-14-integrated-system-architecture.md`, versioned KB `2026-08-13-sattva-versioned-kb.md`, middleware UX `2026-08-14-middleware-ux-design.md`, interactive dashboard `2026-08-13-middleware-interactive-dashboard.md`, HoldCo/Vercel rewire `2026-08-13-holdco-gcp-vercel-bff-rewire.md`, internal services / D10 `2026-08-17-internal-services-mtls-pipeline-design.md`  
**Figma:** [Sattva Middleware](https://www.figma.com/design/NcyHhLoppe3f72fs5KjrvP/Sattva-Middleware?node-id=25-1382) — page `01 · Product platform 2026-08-19` (hi-fi). Prototype starts at **Product map** then **Sign-in**. Lo-fi frames on `Persona Index` stay as the Workstream 2 archive — do not overwrite them.  
**Live twin (not the BFF):** https://sattva-odoo-infra.vercel.app/sattva-middleware-portal.html?view=map  
**Product host (BFF):** `app.trilokventures.org` (`middleware/`, separate Vercel project)

This spec is the **product picture** deployers follow: one portal, seven Keycloak groups, three backends (Odoo, Nextcloud, n8n) plus Keycloak IdP and the D10 `upload.` vhost, all behind Cloudflare, no second SoR. Hi-fi frames in Figma are the visual twin of that picture. They are not a second product.

---

## 1. What you are deploying

People never hop Odoo, Nextcloud, Keycloak, n8n, GCP, and Cloudflare as peer apps. They use **one product**: the middleware portal. Everything else is identity, SoR, vault, bus, or edge.

```
Browser
  └─ Cloudflare (DNS / TLS / WAF / Access on employee hosts)
       ├─ www / apex          marketing GREEN          Workstream 3 (not this file)
       ├─ auth.               Keycloak IdP             Phase 3 identity
       ├─ app.                Next.js BFF portal       THIS PRODUCT
       ├─ sattva.             Odoo CE                  employees + Access (deep work)
       ├─ vault.              Nextcloud                employees + Access (RED files)
       ├─ upload.             Caddy vhost on VM        RED POST (D10) — not Vercel
       └─ n8n.                n8n editor               it.admin + Access
```

| Surface | Holds | Must not |
| --- | --- | --- |
| `app.` portal | GREEN UI; BFF pass-through | Business state; RED bytes; vault paths in client JSON |
| Keycloak `auth.` | Subjects + groups | CRM; PCP status |
| Odoo `sattva.` | Leads, quotes, POs, invoices, partners, PCP, lots | Files |
| Nextcloud `vault.` | RED files | Browser sessions for buyers/suppliers |
| n8n | Pass-through workflows (JSON in git) | Customer lists, PCP, invoices |
| `upload.` | RED bytes in transit to n8n → Nextcloud | Listing; anonymous POST; Vercel/R2/Blob/Worker store |
| Notion | Process wiki GREEN/AMBER | Live POs, RED PDFs, LifeOS |
| GitHub | Specs, addon, n8n JSON | Secrets |

**Two Vercel projects:** `sattva-odoo-infra` publishes `docs/superpowers/mocks/` only. The BFF is a **separate** project with Root Directory `middleware/`. Never retarget the mocks deploy.

**E1 KPI filters (HoldCo rewire):** unpaid invoices = `finance.manager` only; health = `it.admin` only; `it.admin` never sees P00042 / SO-1042.

---

## 2. Personas (locked — do not add)

| Keycloak group | Lands on | Product job | Never |
| --- | --- | --- | --- |
| `sales.exec` | E1 → E4 | Confirm POs; read supplier dossier | Approve suppliers; Confirm anyway; vault download |
| `compliance.officer` | E1 → E2 | PCP queue; Approve/Block; lot board | Edit price lists; Confirm POs |
| `finance.manager` | E1 → E6 | Invoices, commission, post in Odoo | Create POs; supplier approval |
| `logistics.exec` | E1 → E5 | Shipments, CFIA, GREEN lots | Financial terms |
| `it.admin` | E7 | Health: n8n queue, reachability `up/down` | Business rows (P00042, SO-1042) |
| `buyer` | B1 | Own GREEN lot status | Other buyers; RED; vault; supplier legal identity |
| `supplier` | P1 | Own PCP pack; upload via `upload.`; CAPA | Other suppliers; Odoo; self-set `approved` |

CEO Command Center, investors, HubSpot users, and agents are **not** portal personas.

---

## 3. Click flows (prototype = product)

Fictional names only: supplier **Example Foods Pvt Ltd**, buyer **Northshore Foods Inc**, PO **P00042**, sale **SO-1042**. Caption every sample **Mock · not SoR**.

### 3.1 Employee — quote to blocked confirm to SoD approve (10 clicks)

S1 (sales.exec) → Sign in with Trilok ID → S2 → E1 → KPI “2 confirms blocked” → E4 → Confirm P00042 → **Compliance Gate Blocked** overlay (no Confirm anyway) → View supplier compliance → E3 (read-only for sales) → S4 Sign out → S1 (compliance.officer) → E2 → Example Foods row → E3 → Approve in Odoo → sales E4 gate pill `approved` → confirm succeeds (Odoo state `purchase`).

### 3.2 Buyer — GREEN lot only (5 clicks)

S1 (buyer) → S2 → B1 (SO-1042) → B2 (timeline + moisture % / mesh pass / hash) → B3 quotes. Chrome never shows `vault.` or `n8n.`. Manufacturer legal name is not on B2.

### 3.3 Seller — pack stays pending until the officer (6 clicks)

S1 (supplier, provisioned) → S2 → P1 (`pending`, checklist) → P2 (slots) → receipt **filename + sha256**, no path → P1 still `pending`. **Mock · not SoR:** the prototype does not auto-flip PCP to `review`. `supplier_pcp_status` changes only when `compliance.officer` writes Odoo on E2/E3. P3 CAPA is a separate path and does **not** approve the supplier.

---

## 4. Screen inventory (hi-fi = deployable BFF)

Same IDs as middleware UX §4. Do not add screens. State conventions on every frame: loading / empty / error / offline. Timezone `America/Toronto`.

Hi-fi page node `25:1382`. Play prototype from P0 `26:44` or S1 `27:157`.

| ID | Figma node | Product screen | Deploy against |
| --- | --- | --- | --- |
| P0 | `26:44` | Product platform map (hosts, personas, flows, phases) | Follow-along while deploying — not a production route |
| S1 | `27:157` | Sign-in — Keycloak handoff, no local password | `auth.` OIDC PKCE; Phase 1 mock header |
| S2 | `27:171` | Role router | Keycloak primary group |
| S3 | `33:76` | Notifications — Odoo `mail.activity` view | n8n writes Odoo activities; BFF reads Odoo (optional 30-day UI cache). Not `GET /api/notifications` as a second inbox |
| S4 | `33:150` | Profile — groups visible, no self-service role edit | Session cookie |
| E1 | `27:196` | Ops dashboard — KPI cards are navigation | `GET /api/dashboard` |
| E2 | `27:305` | Compliance queue | `GET /api/compliance/queue` |
| E3 | `27:400` | Supplier dossier — cert **names + expiry**, no path strings | Odoo partner; sales read-only |
| E4 | `27:252` + overlay `27:282` | PO gate + blocked overlay | `POST /api/purchase/orders/:id/confirm` |
| E5 | `33:219` | Lot kanban GREEN metrics + hash | `GET /api/lots`. Request-access is audit-logged and fulfilled on Access-gated `vault.` (employees only) — never a PDF through `app.` |
| E6 | `33:303` | Invoices (finance) | Odoo AMBER |
| E7 | `34:85` | Health (IT) | `GET /api/health` |
| B1 | `27:454` | Buyer orders | Partner-scoped Odoo; GREEN allow-list |
| B2 | `27:470` | Order detail | GREEN metrics + hash; no vault |
| B3 | `34:173` | Quotes & contracts | Own docs: filename + sha256 |
| P1 | `27:520` | Supplier home | PCP banner from Odoo |
| P2 | `27:498` + receipt `34:248` | Document upload + receipt | D10; BFF metadata only |
| P3 | `34:214` | CAPA responses | Text → Odoo via n8n; files via D10 |

**Upload path (D10, `2026-08-17-internal-services-mtls-pipeline-design.md` §7; supersedes UX §4 P2 WebDAV-through-BFF):**

1. Browser → BFF: metadata only (filename, size, mime, client-computed sha256).
2. BFF → Odoo: create/update the attachment pointer row (hash pending).
3. BFF → n8n: mint a short-lived POST URL on `upload.trilokventures.org`.
4. Browser → origin Caddy on the **GCP/Compose VM**: file bytes. Caddy streams to n8n (`svc.n8n.vault`) → Nextcloud. n8n Save Data disabled on RED nodes. n8n writes path + verified sha256 to Odoo.
5. BFF re-reads `{filename, sha256}` from Odoo. It never receives file bytes.

Six attributes: hostname `upload.`; Cloudflare Full-strict → Caddy; Access + minted URL (not anonymous); RED in transit; Nextcloud SoR for bytes, Odoo SoR for hash/path; not R2, Vercel Blob, or a Worker store.

Until `upload.` exists, P2 is **metadata-only** (Phase 2 contract tests). No multipart to `middleware/`. Employees keep using Access-gated `vault.` until Phase 3 Caddy. Buyers and suppliers never receive the vault hostname.

**Gate copy:** “PO P00042 cannot be confirmed — Example Foods Pvt Ltd is **review**. Missing: current pest-control log. [View supplier compliance]”. Never Confirm anyway.

---

## 5. How to follow this while deploying

| Phase | What must exist | What the Figma file is |
| --- | --- | --- |
| 1 | Local Compose Odoo + addon PCP gate; mock persona header | Visual contract for E1–E5, S1–S4 |
| 2 | Separate Vercel BFF `app.`; contract tests; buyer/supplier surfaces | Visual contract for B* / P*; P2 returns mock `{filename, sha256}` only; still mock Keycloak |
| 3 | GCP VM + Cloudflare + Keycloak realm from git + Caddy `upload.` + Access on `sattva.`/`vault.`/`n8n.` | S1 chrome labelled `Phase 3 identity · design only` until realm is promoted; live D10 |

Conservative delta vs 08-17 §7 (`svc.upload.origin` listed Phase 2): this spec keeps **live** `upload.` in Phase 3 so Phase 2 cannot put RED on Vercel. Recorded here; do not “fix” 08-17 in place.

Checklist before calling a screen “shipped”:

1. Persona × route matrix matches middleware UX §7 (no extra roles).
2. Client payloads have no RED keys (`middleware/src/lib/red-keys.json`).
3. Confirm on a `pending`/`review` supplier returns the gate dialog; `confirm_anyway` is always false.
4. Buyer/supplier chrome has no vault hostname or folder path.
5. Employees may “Open in Odoo”; buyers/suppliers must not.
6. n8n overlays say “pass-through · JSON in GitHub”.
7. `FABRIC_MODE=live` rejects `x-sattva-persona`; Keycloak PKCE only (HoldCo rewire §4).

---

## 6. Design language (product, not marketing)

- Quiet operations tool. Forest/sand from the Phase 0 twin (`--nav #143528`, `--forest #1f4d3a`, `--sand #f7f4ef`). Typeface **Inter**.
- Classification: red = blocked/RED state; amber = review; green = released. Icon + label, not color alone.
- SDS (Figma Simple Design System) for Button, Tag, Dialog, Avatar, Card. Local `Sattva Portal` tokens for chrome so the shipped Tailwind/shadcn portal can match without inventing a second kit.
- WCAG 2.2 AA; keyboard path for Confirm and Approve.

---

## 7. Out of scope

Buyer self-signup, supplier self-registration, Confirm anyway, CEO Control Room on Vercel, catalogue extras, chat-collector as a second CRM, GKE/mTLS/PKI/HubSpot/Tauri, Notion Sales/PO databases, `NEXT_PUBLIC_` fabric URLs, treating the HTML twin Vercel project as `app.`, Map/`?view=map` as a production BFF route.

---

## 8. Notion

GREEN Content **inbox** (not Library until a human promotes): process walkthrough + Figma URL + this spec path. No live POs, prices, or RED. Agents write inbox only (`2026-08-13-sattva-versioned-kb.md` §8).

Inbox page: https://app.notion.com/p/3c1e8d8c60c781debf10e3574d91b49c
