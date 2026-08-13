# HoldCo / OpCo / AssetCo GCP layout and Vercel BFF rewire

**Status:** Proposed (Phase 2 BFF contract + Phase 3 GCP bootstrap; does not skip Phase 1 Compose)  
**Date:** 2026-08-13  
**Owner:** IPCo (BFF + IaC in git); AssetCo (GCP org, Secret Manager, WORM); Sattva Brokers OpCo (operations)  
**Depends on:** locked fabric `2026-08-13-sattva-brokers-system-fabric-design.md`, integrated architecture `2026-08-14-integrated-system-architecture.md`, middleware UX `2026-08-14-middleware-ux-design.md`  
**Input:** handwritten architecture (public landing → authenticated login → custom middleware → Nextcloud / Odoo / n8n)

This spec maps the sketch onto the locked HoldCo / OpCo / AssetCo / IPCo split, records hostname decisions, and defines how the Vercel **BFF** (not the Phase 0 HTML twin) talks to fabric backends. Git is canonical. Locked fabric wins every conflict.

---

## 1. What the sketch is (and is not)

The drawing is the correct product flow:

1. Public landing page.
2. Authenticated login approval.
3. Custom middleware used by employees, buyers, and suppliers.
4. Three backends: Nextcloud (RED vault), Odoo (transactional SoR + Nextcloud path/checksum), n8n (orchestration only).

It is **not** a license to:

- Point browsers at Nextcloud or n8n.
- Store COA PDFs, checksums, or partner master data on Vercel.
- Replace n8n with a Cloudflare Agents SDK chatbot or a second bus.
- Treat the current `sattva-odoo-infra` Vercel project (HTML twin) as the BFF.
- Provision Neon / Vercel Postgres as a second SoR (`integrated-architecture` §9 D6).

| Sketch box | Fabric assignment | Hostname (locked) |
| --- | --- | --- |
| Public landing | Vercel GREEN / PUBLIC site (Workstream 3 `web/`, later) | `trilokventures.org`, `www.` |
| Authenticated login | Keycloak (Phase 3); mock persona header until then | `auth.trilokventures.org` |
| Custom middleware | Next.js BFF in `middleware/` | `app.trilokventures.org` |
| Nextcloud | RED vault; BFF WebDAV service account only | `vault.trilokventures.org` (employees + Access) |
| Odoo | SoR; PCP gate; stores NC path + checksum, not file bytes | `sattva.trilokventures.org` (employees + Access) |
| n8n | Pass-through bus; no business state | `n8n.trilokventures.org` (IT + Access) |

**Hostname conflict (resolved):** the sketch labels the landing `sattva.trilokventures.org`. The locked DNS table already uses that name for **employee Odoo**. Do not move Odoo off `sattva.` to match the ink. The landing stays on apex/`www`; the Sattva **product** is reached after login at `app.`. If marketing later wants a Sattva-branded public page, add `www` copy or a path on the marketing project — do not steal the Odoo hostname.

---

## 2. Corporate structure on GCP

Food-compliance liability stays in OpCo. Software stays in IPCo. Keys and WORM stay in AssetCo. HoldCo owns billing and org policy.

```
Organization: Trilok Ventures (HoldCo)
├── folder tv-holdco-shared     billing export, org policies, essential contacts
├── folder tv-ipco              no production data; CI service accounts that deploy code
├── folder tv-assetco           Secret Manager, KMS, GCS WORM buckets
└── folder tv-sattva-opco       Sattva Brokers runtime
    ├── project sattva-prod-ca  northamerica-northeast1 (Toronto) or northeast2 (Montreal)
    └── project sattva-dev-ca   optional; same region; smaller VM
```

| Concern | Folder / project | Why |
| --- | --- | --- |
| Org policies, billing account link | HoldCo shared | Capital and shared policy |
| GitHub deploy identity (no secret values) | IPCo | Code and workflow JSON are IPCo |
| `sattva-*` secrets, WORM bucket | AssetCo, IAM-granted to OpCo SA | EquipCo / AssetCo license into OpCo |
| Compute Engine VM, firewall, static IP, GCS backup bucket (non-WORM) | `sattva-prod-ca` in OpCo | Operations runtime |
| Vercel | Not GCP | GREEN edge; two Vercel **projects** (see §4) |

Phase 3 compute stays **Compose-on-one-VM** (integrated architecture D4). No GKE, Cloud Armor, or Cloud SQL until a live CFIA audit or enterprise buyer requires them.

---

## 3. Commands that were considered and declined

| Ask | Decision | Rule |
| --- | --- | --- |
| Cloudflare Agents SDK chatbot as middleware | **No.** n8n is the only bus; onboarding is a **scripted** collector, not a freeform LLM. Cloudflare **Access** is the employee network gate already specified. | Fabric §3.6 stop list, §5.2 n8n, chat-collector spec |
| Vercel bootstrap + Neon Postgres | **No.** Odoo Postgres is the transactional database. Neon would be a second SoR. | Fabric §3.1; architecture D6 |
| `vercel --prod` of this repo root / BFF onto the mocks project | **No** without a separate Vercel project. Root `vercel.json` must keep publishing `docs/superpowers/mocks/` only. | PR #12; leaking Compose is a critical regression |
| Postman MCP setup / Flow run inspect | **Blocked here.** Postman MCP `needsAuth`. No Flow Run ID was supplied. | — |

---

## 4. Two Vercel projects (rewire without breaking the twin)

| Vercel project | Root Directory | Domain | Talks to GCP? |
| --- | --- | --- | --- |
| `sattva-odoo-infra` (exists) | repo root, `outputDirectory=docs/superpowers/mocks` | `sattva-odoo-infra.vercel.app` | **No.** Static GREEN UX twin. |
| `sattva-middleware` (create) | `middleware/` | `app.trilokventures.org` | **Yes**, server-side only, via env from GCP Secret Manager / Vercel env. |

Rewire means: browsers call `/api/*` on the BFF; the BFF calls Odoo JSON-2, n8n webhooks, and Nextcloud WebDAV with service accounts. The HTML twin stays a clickable spec until the Next.js UI replaces it.

`FABRIC_MODE`:

| Value | Upstream | When |
| --- | --- | --- |
| `mock` (default) | In-repo demo records (Example Foods / P00042 / SO-1042) | No secrets, CI, current production BFF until GCP exists |
| `live` | Env URLs for Odoo / n8n / Nextcloud | Local Compose or GCP VM; never commit credentials |

Live mode **must not** serialize fabric URLs, API keys, vault paths, or file bytes to the client. Health reports `{mode, odoo, n8n, nextcloud}` as `mock | unset | up | down`, not hostnames. `ok` is true only when every subsystem is `mock` or `up`.

Until Keycloak exists, `FABRIC_MODE=live` returns **401** on every non-health route. The mock persona header is not production auth.

Root `.vercelignore` allowlists `docs/superpowers/mocks/` **and** `middleware/` so a second Vercel project with Root Directory `middleware/` can upload the BFF. Compose, `config/`, and `addons/` stay ignored. Root `vercel.json` remains mocks-only.

---

## 5. BFF contract (this change)

Implemented in `middleware/` against UX spec §7, with a runtime RED-key stripper (UX spec §8).

| Route | Mock behavior |
| --- | --- |
| `GET /api/health` | Mode + fabric configured/reachable flags |
| `GET /api/dashboard` | Employee KPIs; finance/IT cards hidden for sales |
| `GET /api/compliance/queue` | Review/pending rows; evidence labels, no paths |
| `GET /api/purchase/orders` | Gate state per PO |
| `POST /api/purchase/orders/:id/confirm` | 409 Compliance Gate Blocked unless `approved`; **no Confirm anyway** |
| `GET /api/lots` | GREEN moisture / mesh / pass / hash; buyer sees own lots only |
| `POST /api/documents` | Accepts metadata + hash of upload; returns `{sha256}`; never `path` |

Persona in mock/dev: header `x-sattva-persona`. Live mode returns 401 on non-health routes until Keycloak (Phase 3). Invalid persona values return 400.

---

## 6. GCP bootstrap (runbook)

See `deploy/gcp/README.md` and `deploy/gcp/bootstrap-projects.sh`. The script is idempotent and refuses to run without `gcloud` auth plus `TRILOK_GCP_ORG_ID` and `TRILOK_GCP_BILLING_ACCOUNT`. Secret **values** never enter git; names live in `deploy/gcp/secret-names.md`.

Minimum APIs on `sattva-prod-ca`: `compute`, `iam`, `secretmanager`, `storage`, `iap`. SSH via IAP only. Ingress 80/443 from Cloudflare ranges only.

Until those env vars and billing exist, **do not** pretend a GCP project was created. The BFF mock mode is the safe default.

---

## 7. Security (OWASP API Top 10 — this surface)

Findings against `postman/specs/openapi.yaml` and the BFF (score reflects scaffold, not a production IdP):

| ID | Severity | Finding | Fix in this change |
| --- | --- | --- | --- |
| SEC-001 | High | No Keycloak yet — mock persona header is spoofable | Header is **not** accepted when `FABRIC_MODE=live`; all non-health routes 401 |
| SEC-002 | Critical (prevented) | Root static deploy used to serve Compose | Unchanged: mocks-only Vercel project |
| SEC-003 | High | No rate limit on confirm | Document 429 in spec; Cloudflare rate limit on `/api/` in Phase 3 |
| SEC-004 | Medium | String fields without maxLength | OpenAPI `maxLength` on ids and hashes |
| SEC-005 | Critical (prevented) | RED keys in buyer payloads | `stripRedKeys` + contract check |
| SEC-006 | High | Admin Odoo must not be public | `sattva.` stays Access-gated; BFF uses a least-privilege service user |
| API5 | High | Confirm/approve are role-gated | Sales cannot Approve; confirm still hits Odoo gate |
| API7 | Medium | Document upload path traversal | Mock ignores client-supplied vault paths; live WebDAV uses server-side prefix |

HTTPS only on documented servers. No API keys in query strings. Password fields are not in this API.

---

## 8. Out of scope

Phase 1 Compose expansion (n8n + Nextcloud services), Keycloak realm import, Cloudflare Access policies in the dashboard, GCS WORM, HubSpot, Vertex, Cloudflare Durable Object agents, Neon, promoting this BFF onto the existing mocks Vercel project.

---

## 9. Acceptance

1. `FABRIC_MODE=mock` BFF returns GREEN/AMBER demo data with no vault path, no PDF bytes, no Confirm anyway.
2. Contract check fails if a RED key appears in a fixture response.
3. Root `vercel.json` still publishes only mocks. `.vercelignore` allowlists `middleware/` for the second project and still ignores Compose/`addons/`/`config/`.
4. GCP bootstrap script contains no secret values, logs human text to stderr, and names AssetCo vs OpCo correctly.
5. Sketch mapping in §1 is the hostname source of truth going forward.
