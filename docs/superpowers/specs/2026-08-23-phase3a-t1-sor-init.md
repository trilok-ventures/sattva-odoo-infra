# Phase 3a T1 — SoR initialization (Odoo / Nextcloud / n8n)

**Status:** Proposed operating spec (does not edit the locked fabric)  
**Date:** 2026-08-23  
**Owner:** IPCo (scripts); Sattva Brokers OpCo (first live records)  
**Repo:** `trilok-ventures/sattva-odoo-infra`  
**Host:** `sattva-prod-vm` in `sattva-prod-ca` (Compose-on-VM, T1 HTTPS)  
**Companions:** locked fabric `2026-08-13-sattva-brokers-system-fabric-design.md`, architecture `2026-08-14-integrated-system-architecture.md`, versioned KB `2026-08-13-sattva-versioned-kb.md`

This document defines the **required empty-production state** for the three runtime systems of record on the Phase 3a T1 VM. It does not deploy Keycloak, WORM, or a live BFF. Locked fabric wins every conflict.

**Decision (this spec):** seed **configuration + empty convention trees + service users only**. Do not create synthetic suppliers, buyers, lots, quotes, or invoices in the production `sattva` database. First live counterparties are created by humans in Odoo; n8n then provisions vault folders (fabric §6.1).

---

## 1. What “required state” means

### 1.1 Odoo CE (`sattva` DB) — operational SoR

Fabric §3.1 / §5.1: Odoo holds leads, quotes, POs, invoices, partners, PCP status, lots. Architecture §4.1: production DB name `sattva`, `list_db = False`, `dbfilter = ^sattva$`.

| Item | Required value | Source |
| --- | --- | --- |
| Database | `sattva`, `--without-demo=all` | fabric §11; `deploy/prod/README.md` |
| Addon | `sattva_compliance` installed and up to date | fabric §3.2, §5.1 |
| Modules pulled by addon | `base`, `purchase`, `contacts`, `crm` | `__manifest__.py` `depends` |
| Partner form | Sattva Compliance page: PCP + KYC fields | addon `views/res_partner_views.xml`; fabric §8 #1 |
| PCP field | `res.partner.supplier_pcp_status` ∈ {pending, review, approved, blocked}; default `pending` | fabric §3.2 |
| Other partner fields | `risk_band` (default medium), `haccp_certified`, `brc_certified`, `nextcloud_folder_path` (readonly), `buyer_kyc_status` (default pending; **never** unlocks PO), `nextcloud_client_folder_path` | addon `models/res_partner.py` |
| PO gate | `purchase.order.button_confirm` raises UserError unless status is `approved` | fabric §3.2, §7 |
| Company | `res.company` name `Sattva Brokers`; country Canada (`base.ca`); currency CAD (`base.CAD`) | fabric §1 (Canadian brokerage) |
| CRM stages | Discovery → Proposal → Compliance Review → Contract → Execution → Retention | fabric §5.1 |
| Groups (xmlids present) | `sattva_compliance.group_compliance_officer`, `sattva_compliance.group_n8n_fabric_service` | addon `security/sattva_security.xml`; architecture §4.5 Phase 1 local groups |
| Role map (no extra named groups) | `sales.exec` → `sales_team.group_sale_salesman`; `finance.manager` → `account.group_account_manager` + `account.group_account_user` (after `account` is installed); `logistics.exec` → `stock.group_stock_user` (after `stock`); `it.admin` → `base.group_system`; `compliance.officer` → addon group | `models/notify.py` `ROLE_GROUPS`; runbook `app-local-admin-and-roles.md` |
| Operator | uid 2 only; login/email `archneo@trilokventures.org` (or `OPERATOR_EMAIL`); Settings + compliance officer | architecture §5.1 Phase 1; `set-operator-admin-email.sh` |
| Service user | `n8n.fabric`: **not** Settings; only `group_n8n_fabric_service`; password/key from AssetCo `odoo-n8n-api-key`; uid written to `ODOO_N8N_UID` (never `2`) | architecture §5.3; `n8n/workflows/README.md` |
| Event model | `sattva.fabric.event` empty at boot; types later: `supplier_folder_requested`, `buyer_folder_requested`; states `queued` → `processed` | `models/fabric_event.py`, `models/res_partner.py` |
| Abstract RPC | `sattva.fabric.vault.set_partner_path`, `sattva.fabric.notify.create_role_activity`, `sattva.fabric.handoff.create_po_intent` (draft only), `sattva.fabric.leadscore.write_score` | addon models; all `require_n8n_fabric_service` |
| Signup | `auth_signup.invitation_only = True` | `harden-odoo-operator.sh`; DNS checklist §2 |
| Demo leftovers | `demo` / `portal` users archived if present | same |
| Quotes / invoices modules | `sale_management` (quotes + SO) in-scope as a **separate** slice; `l10n_ca` (pulls `account` + CA taxes) after operator confirms CoA | fabric §3.1 money/quotes SoR |
| Lot model | **Not built.** Fabric §5.1 “Phase 1 additions (specified, not built)”. Do not fake lots on `stock.lot` | fabric §5.1; architecture §4.1 |

Empty at required state: `res.partner` vendors/customers (beyond the company partner), `crm.lead`, `purchase.order`, `sale.order`, `account.move`, `sattva.fabric.event`.

### 1.2 Nextcloud — RED vault

Fabric §5.3 folder convention; architecture §4.4 (VM disk in 3a; WORM in 3b); KB §9.

| Item | Required value |
| --- | --- |
| Host | `vault.trilokventures.org`, Access employees-only |
| Admin userid | `admin` (do not rename); email bound to operator mailbox |
| Empty trees (human home) | `/PCP/Supplier_Audits/`, `/PCP/Hazard_Control/`, `/PCP/Verification_Records/`, `/PCP/CAPA/`, `/PCP/Consumer_Protection/`, `/PCP/Training_Evidence/`, `/PCP/Retention_Logs/`, `/Suppliers/`, `/Clients/` |
| Service user | `n8n.vault` with app-password from `nextcloud-n8n-app-password`; same empty roots under **that** user’s WebDAV home (n8n MKCOL target) |
| Shares | `shareapi_allow_links=no`, `shareapi_allow_public_upload=no` |
| Files | **Zero** COA PDFs, PCP packs, certificates, labels |

Per-supplier `/Suppliers/{name}/Certificates/` and per-buyer `/Clients/{name}/Onboarding/` (and later `/Clients/{name}/Orders/{order}/`) are created by n8n when Odoo queues a fabric event — not pre-seeded with fake names.

**Warning (drift, not a second SoR):** T1 has two empty roots (admin vs `n8n.vault`) until a later Group Folders slice. Nextcloud remains the only vault. Do not copy trees into GCS (non-WORM) backups (`deploy/prod/README.md` Backups; architecture §4.4).

### 1.3 n8n — pass-through bus (not a SoR)

Fabric §3.1 / §5.2: credentials and workflow definitions only. Architecture §4.3: queue mode, Redis is not a SoR, RED nodes save-data disabled.

| Item | Required value |
| --- | --- |
| Editor | `n8n.trilokventures.org`, Access IT-only |
| Owner | `archneo@trilokventures.org`; do not reset an existing owner (`create-n8n-owner.sh`) |
| Postgres | database `n8n`, user `n8n` (compose init) |
| Env | `EXECUTIONS_MODE=queue`, `N8N_ENCRYPTION_KEY`, `N8N_WEBHOOK_HMAC`, `NEXTCLOUD_WEBDAV_BASE=http://nextcloud/remote.php/dav/files/n8n.vault`, `ODOO_JSON2_URL=http://odoo:8069/jsonrpc`, `ODOO_N8N_UID` = fabric uid |
| Credential names (values in n8n store, not git) | `odooN8nFabric` (httpHeaderAuth; value = `odoo-n8n-api-key`), `nextcloudN8nVault` (httpBasicAuth; user `n8n.vault`) |
| Workflows imported from git, then activated | `wf.coa.verify`, `wf.supplier.folder`, `wf.buyer.onboard.folder`, `wf.order.handoff`, `wf.notify.role`, `wf.lead.score` |
| Settings on each | `saveDataSuccessExecution=none`, `saveDataErrorExecution=none` |
| Webhooks | `/webhook/coa-verify`, `/webhook/nextcloud-coa`, `/webhook/order-handoff`, `/webhook/notify-role`, `/webhook/lead-score`; HMAC `x-sattva-webhook-hmac` |
| Cron | supplier + buyer folder poll every 5 minutes |
| Events n8n may write | vault path via `set_partner_path`; event `state=processed`; draft PO via `create_po_intent`; GREEN score; `mail.activity` via notify helper |
| Events n8n must not write | `button_confirm`; partner PCP; invoices; RED bytes in execution logs |

`n8n/workflows/service-register.json` Phase 1 rows that exist now: `svc.n8n.fabric`, `svc.n8n.vault`. Phase 2/3 rows (`svc.portal.*`, `svc.upload.origin`, `svc.kc.oidc`) are **not** instantiated.

---

## 2. What must NOT be seeded

| Forbidden | Rule | Evidence |
| --- | --- | --- |
| Keycloak / `auth.trilokventures.org` / `auth_oauth` / realm JSON | Phase gate; Access is the employee network gate | architecture §4.5, §5.1; fabric §6.5; `validate-prod-stack.mjs`; runbook “Keycloak is closed” |
| GCS WORM / tarball of Nextcloud into OpCo backups | WORM is Phase 3b | architecture §4.4; fabric §3.5; `backup-to-gcs.sh` |
| BFF `FABRIC_MODE=live` / `middleware.bff` user / `svc.portal.*` | Phase 2; live BFF 401 until Keycloak | holdco-rewire §4–§5; service-register `phase: 2` |
| Demo buyers / portal users on `sattva.` | Employee hostname only; no buyer personas | architecture §2, §4.7; holdco-rewire §1 hostname conflict |
| Fake production invoices, quotes, POs, lots, COA PDFs | Quarantine is default; availability is affirmative | fabric §7; dual-plane denylist |
| Synthetic named counterparties in prod (`Riverbank Organic Farm`, Example Foods, mock P00042) | Those names are **local / mock** fixtures | AGENTS.md local smoke; holdco-rewire `FABRIC_MODE=mock` |
| Second SoR (Notion CRM, HubSpot pipeline, Supabase/Neon, n8n customer list) | One SoR per domain | fabric §3.1; architecture D6 |
| Weakening or mocking the PCP gate (`button_confirm` bypass, KYC-as-approve) | Compliance gate | fabric §3.2; `test_buyer_kyc.py` |
| Copying `nextcloud-admin-password` onto Odoo `/web/login` | Distinct secrets | `secret-names.md`; runbook login table |
| Using admin uid 2 as `n8n.fabric` | Least privilege | architecture §5.3; `fetch-secrets.sh` |
| Public Nextcloud share links | RED isolation | fabric §5.3; architecture §4.4 |
| `website` / Odoo website as public site | Vercel is GREEN edge | fabric §5.11 |
| `stock` / inventory lots “to look busy” | Sattva does not hold inventory; lot model not built | fabric §1, §5.1 |
| GKE, Cloud Armor, PKI, Wazuh, HubSpot, Tauri, `upload.` | Stop list / out of this slice | fabric §3.6; `deploy/prod/README.md` |
| Secrets in git or Notion | Secrets SoR is Secret Manager | fabric §3.1 |
| n8n UI as canonical workflow store | Git JSON only | fabric §3.4; architecture §3.2 |

---

## 3. Ordered execution slices (legal now on Phase 3a T1)

Smallest first. Scripts live under `deploy/gcp/`. Run on the VM after compose is up and the operator can log into Odoo.

| # | Slice | Status | What it does |
| --- | --- | --- | --- |
| A | Odoo config (no transactional rows) | **in-scope now** | Company name/country/currency; fabric CRM stages; invitation-only; archive demo/portal; ensure `n8n.fabric` + `ODOO_N8N_UID`; add compliance group on uid 2; assert addon + gate loaded |
| B | Nextcloud empty trees + share lockdown | **in-scope now** | `seed-nextcloud-vault-trees.sh` + `harden-nextcloud.sh`; create `n8n.vault` if missing |
| C | n8n owner (if none) | **in-scope now** | `create-n8n-owner.sh` — exits 0 if owner exists; never reset |
| D | n8n import + credentials + activate | **in-scope now** | Import `n8n/workflows/wf.*.json`; render creds from Secret Manager into a shredded temp file; activate; no node edits |
| E | Recreate n8n after `ODOO_N8N_UID` | **in-scope now** | Compose picks up uid; workflows can `execute_kw` |
| F | `sale_management` | **in-scope now** (separate flag) | Quotes/SO SoR. `--with-sales` on the Odoo init script |
| G | `l10n_ca` / chart of accounts | **in-scope now but operator-gated** | Needed to invoice. Do not auto-run; `--with-ca-coa` after the operator accepts Canadian CoA |
| H | Human role users (`sales.exec`, …) | **blocked** | No second humans exist to attach. Operator remains `it.admin`. Create users when people join; do not invent mailboxes |
| I | Group Folders (one vault tree) | **later** | Collapses admin vs `n8n.vault` homes. Reduces compliance risk; not required to accept T1 empty state |
| J | Lot / quarantine model | **later** | Fabric §5.1 specified, not built. Needs a dated implementation plan + addon fields. Do not use `stock.lot` as a fake brokerage lot |
| K | `middleware.bff`, `upload.`, BFF live | **blocked** | Phase 2; holdco-rewire §4 |
| L | Keycloak realm + OIDC | **blocked** | This slice forbids it. Unlock list in `docs/runbooks/app-local-admin-and-roles.md` |
| M | WORM bucket / 7-year archive job | **later** | Phase 3b; architecture §4.4 |
| N | First live supplier / buyer / lot | **later (human)** | Sales/compliance create in Odoo; default `pending`; n8n MKCOL; officer approves after vault evidence — fabric §6.1–§6.2 |

Orchestrator: `deploy/gcp/init-sor.sh` runs A–E (and optional F/G). It refuses Keycloak flags. `--purge-odoo-demo` is optional and dry-run by default; `--apply` dumps `sattva` then cancels xmlid/name-selected furniture demo rows so slice A can write CAD.

---

## 4. Synthetic sample data?

**No — not in the production `sattva` database.**

| Environment | Allowed |
| --- | --- |
| `sattva` on `sattva-prod-vm` | Config, groups, service users, empty vault roots, imported workflows |
| Local Compose / addon tests | Synthetic partners (`Synthetic Spice Supplier`, etc.) inside `TransactionCase` only |
| Vercel mocks project | Example Foods / P00042 under `FABRIC_MODE=mock` |
| GKE security-test spec | Synthetic records **if** that cluster is ever built — not this VM |

A fake approved supplier on production would either (a) let a real PO confirm against a non-entity or (b) train operators to treat `approved` as a convenience flag. Both violate fabric §3.2 and §7 (“Quarantine is the default”).

---

## 5. Acceptance

1. Policy tests: `node deploy/gcp/init-sor.test.mjs` and existing `validate-prod-stack.mjs` pass.
2. On the VM after A–E: company is Sattva Brokers / CA / CAD; six CRM stages exist; `n8n.fabric` uid ≠ 2; Nextcloud trees exist; public shares off; six workflows imported with save-data `none`.
3. Partner/lead/PO/invoice counts for real counterparties remain 0 until a human creates them.
4. Confirming a PO for a later `pending` supplier still raises Compliance Gate Blocked.
5. No `auth.` vhost, no WORM, no BFF live, no Keycloak container.

---

## 6. Traceability

| Requirement | Source | This spec |
| --- | --- | --- |
| One SoR per domain | fabric §3.1 | §1, §2 |
| PCP gate | fabric §3.2 | §1.1, §2 |
| Vault folders | fabric §5.3 | §1.2 |
| n8n pass-through | fabric §5.2 | §1.3 |
| Phase 3a T1 only | architecture §1, §4; prod README | §3 L–M |
| No demo buyers on `sattva.` | architecture §2; holdco-rewire §1 | §2 |
| Distinct Odoo vs Nextcloud passwords | secret-names.md; admin runbook | §2 |

---

## 7. Decision (2026-08-23) — furniture demo purge

Odoo 18 was installed with demo data on this VM. That furniture dataset is not a Sattva SoR. `deploy/gcp/purge-odoo-demo.sh` may cancel/unlink xmlid-selected demo POs, leads, and `account.move` rows and **archive** (not unlink) demo partners, including `base.res_partner_main1` / `main2` (Chester Reed / Dwayne Newman). It must not select every child of the company partner. `--apply` requires a fresh `pg_dump` of `sattva` (or `PURGE_ODOO_DEMO_BACKUP_ACK=1`). After posted demo moves are gone, slice A writes `base.CAD`. `l10n_ca` stays `--with-ca-coa`.
