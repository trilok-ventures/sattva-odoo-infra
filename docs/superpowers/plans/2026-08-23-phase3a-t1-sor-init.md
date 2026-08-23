# Phase 3a T1 SoR Initialization — Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this is VM ops + existing scripts, not a greenfield TDD feature). Spec: `docs/superpowers/specs/2026-08-23-phase3a-t1-sor-init.md`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the production Odoo, Nextcloud, and n8n databases to the required empty-production state: configuration, empty vault trees, and service users — no fake Sattva counterparties.

**Architecture:** Odoo is the only transactional SoR. Nextcloud is the only RED vault. n8n is a pass-through bus. Init scripts under `deploy/gcp/` are idempotent and refuse Keycloak. First live suppliers/buyers are created by humans; n8n then MKCOLs vault paths.

**Tech Stack:** Odoo 18 `sattva` DB, Nextcloud 31, n8n 2.34 queue mode, AssetCo Secret Manager, Compose-on-VM (`sattva-prod-vm`).

## Global Constraints

- One SoR per domain (locked fabric §3.1). n8n stores no lots, invoices, or customer lists.
- `purchase.order.button_confirm` stays blocked unless `supplier_pcp_status = approved` (fabric §3.2). Do not confirm a PO to “test” the gate against a fake approved supplier.
- Seed **config + empty convention trees + service users only**. Do not create Riverbank, Example Foods, P00042, or any synthetic vendor/buyer on `sattva.`.
- Distinct secrets: `/web/login` is `odoo-web-admin-password`; Nextcloud is `nextcloud-admin-password`; n8n fabric is `odoo-n8n-api-key`.
- `n8n.fabric` is never uid 2 and never Settings (architecture §5.3).
- No Keycloak / `auth.` / `auth_oauth`. `validate-prod-stack.mjs` must keep failing if `auth.` appears.
- No WORM, no BFF `FABRIC_MODE=live`, no `upload.`, no Odoo Website.
- Lot/quarantine model is specified and **not built** (fabric §5.1). Do not fake it on `stock.lot`.
- `l10n_ca` / currency CAD is operator-gated after demo accounting is gone.

## Live inventory (2026-08-23, sattva-prod-vm)

Already in required shape:

- Odoo addon `sattva_compliance` + partner Compliance tab; PCP default `pending`.
- Company name `Sattva Brokers`, country `CA`.
- Operator uid 2 = `archneo@trilokventures.org` (Settings). Signup invitation-only.
- `n8n.fabric` uid **8**; `.env` `ODOO_N8N_UID=8`.
- Nextcloud userid `admin` + `n8n.vault`; admin has empty `/PCP/*`, `/Suppliers`, `/Clients`; public shares off.
- n8n owner `archneo@trilokventures.org`; six `wf.*` JSON already imported.

Gaps (this plan):

| Gap | Why it matters |
| --- | --- |
| Company currency **USD** + **23 posted** `account.move` | Demo furniture books. Do **not** switch to CAD until those moves are gone. |
| CRM stages still New / Qualified / Proposition / Won | Fabric §5.1 needs Discovery → … → Retention. Demo stages stay while 39 demo leads point at them. |
| Odoo demo dataset | Azure Interior, Acme Corporation, Gemini Furniture, Wood Corner, Ready Mat; 39 furniture leads; 10 POs (3 already `purchase`, created **before** the PCP gate). |
| `n8n.vault` has **no** `files/` home | Folder workflows MKCOL into that WebDAV user. |
| n8n credentials `odooN8nFabric` / `nextcloudN8nVault` | Workflows reference them; values must come from Secret Manager, not git. |
| `sale_management` not installed | Quotes SoR. Separate `--with-sales` after demo purge. |
| `l10n_ca` not installed | Canadian CoA. `--with-ca-coa` only after purge + CAD. |

---

### Task 1: Safe config slices A–E (no purge, no CAD if books exist)

**Files:**

- Run (do not rewrite unless a bug): `deploy/gcp/init-sor.sh`, `deploy/gcp/init-odoo-sor.sh`, `deploy/gcp/seed-nextcloud-vault-trees.sh`, `deploy/gcp/init-n8n-fabric.sh`, `deploy/gcp/create-n8n-owner.sh`
- Guard: `deploy/gcp/init-odoo-sor.sh` must skip `currency_id` when posted moves exist
- Test: `node deploy/gcp/init-sor.test.mjs`; `node deploy/prod/validate-prod-stack.mjs`

**Interfaces:**

- Consumes: AssetCo `odoo-n8n-api-key`, `nextcloud-n8n-app-password`; containers `sattva-prod-web`, `sattva-prod-nextcloud`, `sattva-prod-n8n`
- Produces: fabric CRM stages **added**; `n8n.vault` empty trees; named n8n credentials; n8n recreated with `ODOO_N8N_UID=8`

- [ ] **Step 1: Currency guard**

In `deploy/gcp/init-odoo-sor.sh`, after resolving `cad`, only write currency when there are no posted moves:

```python
posted = env["account.move"].search_count([("state", "=", "posted")]) if "account.move" in env else 0
vals = {"name": "Sattva Brokers", "country_id": canada.id}
if posted:
    print("warning_skip_cad_posted_moves=%s" % posted)
else:
    vals["currency_id"] = cad.id
company.write(vals)
```

- [ ] **Step 2: Policy tests**

```bash
node deploy/gcp/init-sor.test.mjs
node deploy/prod/validate-prod-stack.mjs
```

Expected: both print a pass line; no `auth.trilokventures.org`.

- [ ] **Step 3: Copy scripts to the VM and run A–E**

```bash
# on sattva-prod-vm, after this branch is present under /opt/sattva or scripts copied
sudo ./deploy/gcp/init-sor.sh
# do NOT pass --with-sales or --with-ca-coa yet
```

Expected stderr/stdout includes `n8n_fabric_uid=8`, `warning_existing_counterparties=...Azure Interior...`, `warning_skip_cad_posted_moves=23`, Nextcloud seed for `admin` and `n8n.vault`, n8n import/activate, n8n recreate.

- [ ] **Step 4: Verify**

```text
company=Sattva Brokers country=CA currency=USD   # USD until Task 2
crm_stages contains Discovery,Proposal,Compliance Review,Contract,Execution,Retention
n8n.vault files: PCP/*, Suppliers, Clients
n8n list:workflow shows six wf-* ids
```

- [ ] **Step 5: Commit** the currency guard + this plan if not already committed.

---

### Task 2: Purge Odoo furniture demo (`--purge-odoo-demo`)

**Files:**

- Create: `deploy/gcp/purge-odoo-demo.sh`
- Modify: `deploy/gcp/init-sor.sh` to accept `--purge-odoo-demo` (optional, not default)
- Test: extend `deploy/gcp/init-sor.test.mjs` so the purge script refuses Riverbank/Example Foods and only matches known Odoo demo names / `demo` xmlids

**Interfaces:**

- Consumes: `sattva` DB with Azure Interior / furniture leads / USD moves
- Produces: those rows cancelled or unlinked; fabric CRM stages only; then CAD is legal

Known demo partner names on this VM: `Azure Interior`, `Acme Corporation`, `Gemini Furniture`, `Wood Corner`, `Ready Mat`. Leads are chairs/desks/open-space furniture. POs `P00001`–`P00010`.

Do **not** unlink uid 2, company partner, or `n8n.fabric`. Do **not** invent Sattva suppliers to replace them.

- [ ] **Step 1: Script cancels demo POs, archives demo partners, unlinks demo leads, then leftover empty CRM stages**
- [ ] **Step 2: Dry-run prints counts; apply requires `--apply`**
- [ ] **Step 3: Re-run `init-odoo-sor.sh` so currency becomes CAD**
- [ ] **Step 4: Confirm PCP gate still blocks a *temporary* pending supplier created in a rolled-back cursor (no commit)**

---

### Task 3: Optional money modules (after Task 2)

**Files:** `deploy/gcp/init-odoo-sor.sh` flags already exist.

- [ ] `--with-sales` installs `sale_management` (`--without-demo=all`) so quotes live in Odoo (fabric §3.1).
- [ ] `--with-ca-coa` installs `l10n_ca` only after the operator accepts a Canadian chart of accounts. Not default.

---

### Task 4: First live records (human, not this script)

1. Sales creates a real vendor in Odoo → `supplier_pcp_status=pending`.
2. n8n `wf.supplier.folder` MKCOLs `/Suppliers/{name}/Certificates/` on `n8n.vault` and `set_partner_path`.
3. Certificates land in Nextcloud (no public shares).
4. Compliance sets `review` then `approved` on the partner form tab.
5. Only then may a PO confirm.

Buyer path: `buyer_kyc_status` + `/Clients/{name}/Onboarding/`. KYC never unlocks `button_confirm`.

---

### Stop list (do not schedule)

| Item | Until |
| --- | --- |
| Keycloak / `auth.` / OIDC | dated spec + `realm-trilok.json` + validator/Caddy together |
| Human `sales.exec` / finance / logistics users | real people + mailboxes |
| Nextcloud Group Folders | later slice to unify admin vs `n8n.vault` roots |
| Lot / quarantine model | new addon plan |
| BFF live / `middleware.bff` / `upload.` | Phase 2 |
| GCS WORM | Phase 3b |

## Acceptance

1. `node deploy/gcp/init-sor.test.mjs` and `node deploy/prod/validate-prod-stack.mjs` pass.
2. After Task 1: fabric CRM stages exist; `n8n.vault` trees exist; credentials imported; no new counterparties created.
3. After Task 2: demo furniture rows gone; currency CAD; PCP gate still blocks pending.
4. No `auth.` vhost, no WORM, no `FABRIC_MODE=live`.
