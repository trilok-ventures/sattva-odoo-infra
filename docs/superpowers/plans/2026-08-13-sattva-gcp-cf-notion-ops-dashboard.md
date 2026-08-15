# Sattva Fabric: GCP + Cloudflare + Notion Ops Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Odoo CE + Nextcloud + n8n fabric locally, expose it safely via Cloudflare Tunnel at `sattva.trilokventures.org`, and push GREEN/AMBER status events into a Notion Ops Dashboard for centralised human access — without putting RED vault files in Notion.

**Architecture:** Odoo remains transactional SoR. Nextcloud is the RED vault (paths + SHA-256 checksums stored on Odoo partners/lots). n8n is the only bus (Odoo/Nextcloud webhooks → GREEN status rows in Notion). Cloudflare Tunnel + Zero Trust Access is the edge; custom middleware is role routing (Employees / Buyers / Suppliers), not a second SoR. GCP Compose-on-VM is the Phase 3 runtime (merge existing `deploy/prod` + expand), not GKE-first.

**Tech Stack:** Odoo 18 CE, Postgres 15, Nextcloud (Apache), n8n, Redis, Docker Compose, Cloudflare Tunnel (`cloudflared`), Notion API, GCP Compute Engine + Cloud SQL (Phase 3), optional Caddy origin (from `deploy/prod`).

## Global Constraints

- Odoo CE is the only operational SoR for leads, quotes, POs, invoices, partners, lots.
- n8n is the only integration bus; no point-to-point production scripts.
- Nextcloud (+ GCS WORM in Phase 3) is the only file vault for RED evidence.
- Notion is human knowledge + GREEN/AMBER status mirrors; never RED PDFs or second CRM.
- Year-1 capital ~CAD 10k — prefer Compose-on-VM over GKE until a deal or audit forces it.
- Stop list: no new tool unless it closes a deal, reduces compliance risk, or shortens cash cycle.
- LifeOS must never be shared with investors or hires; company tasks live under Trilok/Sattva.
- Department Notion shells are shelfware until a deal needs them — do not rewrite all dept DBs.
- DNS: only touch `sattva` host records; never edit apex MX/SPF/DKIM/DMARC (Google Workspace).
- Existing sibling work: merge `deploy/cloudflare-tunnel/` and `deploy/prod/` from prior branches when implementing edge/prod tasks.

### File map (this plan)

| Path | Responsibility |
| --- | --- |
| `docker-compose.yml` | Local Phase 1 multi-service fabric |
| `docker-compose.override.yml` | Dev entrypoint / addons-path (keep working) |
| `addons/sattva_compliance/` | PCP gate, vault path, checksum, partner form views |
| `n8n/workflows/coa-verify.json` | First fabric-proving workflow (GitHub-owned) |
| `n8n/workflows/notion-ops-sync.json` | GREEN/AMBER → Notion Ops Dashboard |
| `deploy/cloudflare-tunnel/` | Tunnel ingress for odoo/n8n/files hostnames |
| `deploy/prod/` | Phase 3 Compose-on-VM blueprint |
| `docs/superpowers/specs/` | Locked fabric + KB specs (canonical) |

---

### Task 1: Partner form views + vault checksum fields

**Files:**
- Modify: `addons/sattva_compliance/__manifest__.py`
- Create: `addons/sattva_compliance/views/res_partner_views.xml`
- Modify: `addons/sattva_compliance/models/res_partner.py`
- Test: manual `odoo shell` assertions (no pytest suite in repo)

**Interfaces:**
- Consumes: existing `supplier_pcp_status`, `nextcloud_folder_path`
- Produces: `nextcloud_folder_checksum` (Char), partner form notebook page "Compliance"

- [ ] **Step 1: Write the failing verification script**

```bash
sudo docker exec -i sattva-odoo-web odoo shell -d sattva \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  -c /dev/null --no-http <<'PY'
Partner = env['res.partner']
assert 'nextcloud_folder_checksum' in Partner._fields, 'checksum field missing'
print('FAIL_EXPECTED_IF_MISSING_OK')
PY
```

Expected: AttributeError / assertion failure until Step 3.

- [ ] **Step 2: Add checksum field**

```python
# addons/sattva_compliance/models/res_partner.py (append fields)
nextcloud_folder_checksum = fields.Char(
    string="Nextcloud Folder Checksum",
    readonly=True,
    help="SHA-256 of the latest vault evidence package pointer (not PDF bytes).",
)
```

- [ ] **Step 3: Add form view + manifest data**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <record id="view_partner_form_sattva_compliance" model="ir.ui.view">
    <field name="name">res.partner.form.sattva.compliance</field>
    <field name="model">res.partner</field>
    <field name="inherit_id" ref="base.view_partner_form"/>
    <field name="arch" type="xml">
      <xpath expr="//notebook" position="inside">
        <page string="Compliance" name="sattva_compliance">
          <group>
            <field name="supplier_pcp_status"/>
            <field name="risk_band"/>
            <field name="haccp_certified"/>
            <field name="brc_certified"/>
            <field name="nextcloud_folder_path"/>
            <field name="nextcloud_folder_checksum"/>
          </group>
        </page>
      </xpath>
    </field>
  </record>
</odoo>
```

```python
# __manifest__.py
'data': ['views/res_partner_views.xml'],
```

- [ ] **Step 4: Module update and verify**

```bash
sudo docker exec sattva-odoo-web odoo -d sattva -u sattva_compliance \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  -c /dev/null --stop-after-init
```

Expected: `Modules loaded.` with no ERROR. Partner form shows Compliance page.

- [ ] **Step 5: Commit**

```bash
git add addons/sattva_compliance
git commit -m "feat(compliance): expose PCP fields and vault checksum on partner form"
```

---

### Task 2: Extend Compose with Nextcloud, n8n, Redis

**Files:**
- Modify: `docker-compose.yml`
- Create: `.env.example` (local fabric secrets template)
- Modify: `AGENTS.md` (service list + ports)

**Interfaces:**
- Consumes: existing `sattva_cloud_net`, Odoo `web`/`db`
- Produces: `nextcloud` (:8080), `n8n` (:5678), `redis` (internal), shared network DNS names

- [ ] **Step 1: Add services to `docker-compose.yml`**

```yaml
  redis:
    image: redis:7-alpine
    container_name: sattva-redis
    restart: always
    networks: [sattva_cloud_net]

  nextcloud:
    image: nextcloud:29-apache
    container_name: sattva-nextcloud
    depends_on: [db]
    ports: ["8080:80"]
    environment:
      - MYSQL_HOST=db
      - MYSQL_DATABASE=nextcloud
      # Phase 1 pragmatic: use Postgres sidecar OR SQLite for lab;
      # production uses dedicated Postgres DB `nextcloud` on Cloud SQL.
      - NEXTCLOUD_ADMIN_USER=${NEXTCLOUD_ADMIN_USER:-admin}
      - NEXTCLOUD_ADMIN_PASSWORD=${NEXTCLOUD_ADMIN_PASSWORD:-changeme}
      - NEXTCLOUD_TRUSTED_DOMAINS=localhost sattva.trilokventures.org files.sattva.trilokventures.org
    volumes:
      - nextcloud-data:/var/www/html
    restart: always
    networks: [sattva_cloud_net]

  n8n:
    image: n8nio/n8n:1.107.4
    container_name: sattva-n8n
    depends_on: [redis]
    ports: ["5678:5678"]
    environment:
      - N8N_HOST=n8n.sattva.trilokventures.org
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.sattva.trilokventures.org/
      - QUEUE_BULL_REDIS_HOST=redis
      - EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
      - EXECUTIONS_DATA_SAVE_ON_ERROR=all
      - N8N_DIAGNOSTICS_ENABLED=false
    volumes:
      - n8n-data:/home/node/.n8n
      - ./n8n/workflows:/workflows:ro
    restart: always
    networks: [sattva_cloud_net]
```

Add volumes `nextcloud-data`, `n8n-data`. Prefer a **dedicated Postgres database** `nextcloud` on the existing `db` service for Phase 1 (create via init SQL) rather than MySQL — adjust env to official Nextcloud Postgres vars if choosing that path.

- [ ] **Step 2: Bring stack up and smoke-check**

```bash
sudo docker compose up -d
sudo docker compose ps
curl -sf http://localhost:5678/healthz
curl -sI http://localhost:8080 | head -5
curl -sf http://localhost:8069/web/health
```

Expected: all three healthy; Redis has no published port.

- [ ] **Step 3: Document ports in AGENTS.md**

Add Nextcloud `8080`, n8n `5678`, Redis internal-only.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example AGENTS.md
git commit -m "feat(compose): add Nextcloud, n8n, and Redis to local fabric"
```

---

### Task 3: Vendor folder provisioning (Odoo → n8n → Nextcloud)

**Files:**
- Create: `n8n/workflows/vendor-folder-provision.json`
- Create: `addons/sattva_compliance/models/res_partner_hooks.py` (or extend `res_partner.py`)
- Modify: `addons/sattva_compliance/models/__init__.py`

**Interfaces:**
- Consumes: Odoo `res.partner` create when `supplier_rank > 0`
- Produces: Nextcloud path `/Suppliers/{sanitized_name}/Certificates/` written to `nextcloud_folder_path`

- [ ] **Step 1: Define webhook contract**

Odoo automated action / controller POST to n8n:

```json
{
  "event": "vendor.created",
  "partner_id": 42,
  "name": "Riverbank Organic Farm",
  "folder_hint": "/Suppliers/Riverbank_Organic_Farm/Certificates/"
}
```

- [ ] **Step 2: Implement n8n workflow**

Nodes: Webhook → HTTP Request (Nextcloud WebDAV MKCOL) → HTTP Request (Odoo JSON-RPC write `nextcloud_folder_path`) → Respond. Persist **no** file bodies in execution data.

- [ ] **Step 3: Acceptance test**

```bash
# Create vendor in Odoo UI or shell; then:
sudo docker exec -i sattva-odoo-web odoo shell -d sattva \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  -c /dev/null --no-http <<'PY'
p = env['res.partner'].search([('name','=','Riverbank Organic Farm')], limit=1)
assert p.nextcloud_folder_path and p.nextcloud_folder_path.startswith('/Suppliers/')
print('PASS', p.nextcloud_folder_path)
PY
```

- [ ] **Step 4: Commit**

```bash
git add n8n/workflows/vendor-folder-provision.json addons/sattva_compliance
git commit -m "feat(fabric): provision Nextcloud supplier folders via n8n"
```

---

### Task 4: COA verify workflow (fabric proving path)

**Files:**
- Create: `n8n/workflows/coa-verify.json`
- Create: `n8n/fixtures/coa-pass.green.json`
- Create: `n8n/fixtures/coa-fail.green.json`
- Create: `docs/superpowers/runbooks/coa-verify.md`

**Interfaces:**
- Consumes: Nextcloud webhook on `/Clients/*/Orders/*/COA/*.pdf`
- Produces: Odoo lot GREEN fields + `sha256` checksum; Notion Ops event (Task 5); **PDF stays in Nextcloud**

- [ ] **Step 1: Specify GREEN extract schema**

```json
{
  "lot_ref": "SO-001-L1",
  "moisture_pct": 5.2,
  "mesh_pass": true,
  "coa_sha256": "abc123...",
  "result": "pass",
  "nextcloud_path": "/Clients/Acme/Orders/SO-001/COA/coa.pdf"
}
```

- [ ] **Step 2: Build workflow with pass/fail fixtures**

Use fixtures for local tests without calling HF on RED PDFs. Production path: download → extract GREEN numbers → compare Odoo spec → write hash + flags → notify.

- [ ] **Step 3: Verify RED boundary**

```bash
sudo docker logs sattva-n8n 2>&1 | grep -i '\.pdf' && echo 'FAIL pdf leaked' || echo 'PASS no pdf in logs'
```

- [ ] **Step 4: Commit**

```bash
git add n8n docs/superpowers/runbooks/coa-verify.md
git commit -m "feat(n8n): add COA verify workflow with GREEN fixtures"
```

---

### Task 5: Notion Ops Dashboard + live webhook sync

**Files:**
- Create: `n8n/workflows/notion-ops-sync.json`
- Create: `docs/superpowers/runbooks/notion-ops-dashboard.md`
- Notion (manual/MCP): database under Knowledge Base — **not LifeOS**

**Interfaces:**
- Consumes: n8n events `vendor.pcp_status_changed`, `lot.coa_verified`, `po.blocked`, `invoice.posted` (GREEN/AMBER only)
- Produces: Notion database rows with deep links to Odoo/Nextcloud UI (URLs), never file bytes

- [ ] **Step 1: Create Notion database `Fabric Ops Events` under Sattva KB**

Properties:

| Property | Type |
| --- | --- |
| Title | title |
| Event | select (`vendor.pcp`, `coa.verify`, `po.blocked`, `invoice.posted`) |
| Status | select (`info`, `pass`, `fail`, `blocked`) |
| Odoo Ref | rich_text |
| Odoo URL | url |
| Vault Path | rich_text (path only) |
| Checksum | rich_text |
| Role Audience | multi_select (`Employee`, `Buyer`, `Supplier`) |
| Department | select (IT, Compliance, Sales, Finance, Logistics) |
| Occurred At | date |
| Dedupe Key | rich_text (idempotency) |

- [ ] **Step 2: Create Ops Dashboard page**

Sections (one job each):

1. **Now** — linked board of open `fail`/`blocked` events
2. **Resources** — deep links: Odoo, Nextcloud (Employees only), n8n, System Fabric, SOPs
3. **Departments** — lean pointers to existing department shells (no CRM tables)
4. **Investor GREEN** — separate child page; KPIs only; no AMBER prices

- [ ] **Step 3: n8n Notion node**

Upsert by `Dedupe Key` = `{event}:{odoo_model}:{odoo_id}:{checksum}`. On Notion 429, retry with backoff. Never attach files.

- [ ] **Step 4: Acceptance**

Trigger a fixture `coa.verify` fail → row appears with Status `fail`, Vault Path set, no attachment.

- [ ] **Step 5: Commit**

```bash
git add n8n/workflows/notion-ops-sync.json docs/superpowers/runbooks/notion-ops-dashboard.md
git commit -m "feat(notion): sync GREEN fabric events to Ops Dashboard"
```

---

### Task 6: Cloudflare Tunnel multi-hostname edge + Access

**Files:**
- Merge from `origin/cursor/cf-tunnel-runbook-9921`: `deploy/cloudflare-tunnel/`
- Modify: `deploy/cloudflare-tunnel/config.yml`
- Modify: `deploy/cloudflare-tunnel/README.md`

**Interfaces:**
- Consumes: local Odoo `:8069`, n8n `:5678`, Nextcloud `:8080`
- Produces: public hostnames behind Cloudflare Access policies by role

- [ ] **Step 1: Ingress map**

| Hostname | Origin | Access policy |
| --- | --- | --- |
| `sattva.trilokventures.org` | `localhost:8069` | Employees (Google Workspace) |
| `n8n.sattva.trilokventures.org` | `localhost:5678` | Employees IT only |
| `files.sattva.trilokventures.org` | `localhost:8080` | Employees Compliance/IT — **no Buyers/Suppliers** |
| `www` / marketing | Vercel (Phase 2) | Public |

Buyers/Suppliers do **not** get Nextcloud hostnames. Phase 2 buyer UI is Vercel → Odoo API (GREEN only).

- [ ] **Step 2: Update config.yml hostnames**

```yaml
ingress:
  - hostname: sattva.trilokventures.org
    service: http://localhost:8069
  - hostname: n8n.sattva.trilokventures.org
    service: http://localhost:5678
  - hostname: files.sattva.trilokventures.org
    service: http://localhost:8080
  - service: http_status:404
```

- [ ] **Step 3: Zero Trust Access apps**

Create three Access applications matching hostnames. IdP = Google Workspace. Middleware later maps JWT email → Employee/Buyer/Supplier; for Phase 1, Employees-only Access is enough.

- [ ] **Step 4: Verify**

```bash
curl -I https://sattva.trilokventures.org/web/login
# Expect Cloudflare Access redirect when unauthenticated
```

- [ ] **Step 5: Commit**

```bash
git add deploy/cloudflare-tunnel
git commit -m "feat(edge): multi-hostname Cloudflare Tunnel for Odoo n8n Nextcloud"
```

---

### Task 7: Custom middleware contract (role router, not SoR)

**Files:**
- Create: `docs/superpowers/specs/2026-08-13-sattva-edge-middleware.md`
- Create: `middleware/README.md` (Phase 2 code stub location)

**Interfaces:**
- Consumes: Cloudflare Access JWT / future OIDC
- Produces: route decision `{role, allowed_origins[]}` — never stores lots/invoices

- [ ] **Step 1: Lock role matrix**

| Role | Landing | Odoo | Nextcloud | n8n | Notion |
| --- | --- | --- | --- | --- | --- |
| Employee | Ops Dashboard | Full ACL by group | Path ACL | IT only | KB + Ops Events |
| Buyer | Vercel portal (P2) | Portal user / API GREEN | Never | Never | Investor/buyer GREEN subtree |
| Supplier | Vercel portal (P2) | Portal user limited | Never (upload via controlled link/n8n) | Never | Supplier SOP subset |

- [ ] **Step 2: Document handshake**

```
Browser → CF Access → (optional Worker/middleware) → Tunnel → service
```

Middleware may: validate role claim, rewrite path, strip cookies to vault. Middleware must not: persist business state, proxy RED bytes to Notion, become CRM.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-13-sattva-edge-middleware.md middleware/README.md
git commit -m "docs(edge): lock middleware role router contract"
```

---

### Task 8: Phase 3 GCP Compose-on-VM blueprint (no GKE yet)

**Files:**
- Merge/adapt from `origin/cursor/prod-deploy-blueprint-9921`: `deploy/prod/`
- Modify: `deploy/prod/docker-compose.prod.yml` to add n8n + Nextcloud + Redis
- Create: `deploy/prod/terraform/README.md` (module list only)

**Interfaces:**
- Consumes: Phase 1 compose topology
- Produces: single Toronto VM + Cloud SQL (or Postgres on VM for MVP) + GCS WORM bucket + Secret Manager + Tunnel or Caddy+CF Full Strict

- [ ] **Step 1: Choose topology (locked for this plan)**

**Primary:** 1× e2-standard-2 (Montreal/Toronto) running Compose: Odoo, n8n, Nextcloud, Redis, Caddy/cloudflared. Postgres: Cloud SQL db-f1-micro → db-custom as load grows **or** Postgres on-box for first 90 days if CAD budget is tight. RED files: GCS bucket with object retention (7 years) mounted/synced from Nextcloud external storage.

Reject for now: GKE, Cloud Armor, Vault PKI, Wazuh (Phase Roadmap out-of-scope).

- [ ] **Step 2: Terraform module list**

```
terraform/
  vpc/
  gce-sattva/
  cloudsql-odoo/          # optional if on-box Postgres
  gcs-worm-vault/
  secret-manager/
  iam-iap/                # enable when leaving Tunnel-only
```

- [ ] **Step 3: Cost envelope target**

Keep recurring infra ≤ ~CAD 150–250/mo until revenue; Tunnel + Access free tier / existing CF plan; defer IAP+Armor until enterprise buyer requires.

- [ ] **Step 4: Acceptance (docs-only until VM exists)**

`deploy/prod/README.md` lists exact boot steps including n8n/Nextcloud; secrets via `.env` locally and Secret Manager in GCP.

- [ ] **Step 5: Commit**

```bash
git add deploy/prod
git commit -m "docs(prod): Compose-on-VM GCP blueprint with n8n and Nextcloud"
```

---

### Task 9: Odoo security groups + department mapping

**Files:**
- Create: `addons/sattva_compliance/security/sattva_groups.xml`
- Create: `addons/sattva_compliance/security/ir.model.access.csv`
- Modify: `addons/sattva_compliance/__manifest__.py`

**Interfaces:**
- Produces: groups `sattva_sales_exec`, `sattva_compliance_officer`, `sattva_finance_manager`, `sattva_logistics_exec`

- [ ] **Step 1: Map departments → groups (lean)**

| Department shell | Primary Odoo group | Notion | Vault |
| --- | --- | --- | --- |
| Sales & BD | `sattva_sales_exec` | view KB | no |
| Supplier & Procurement | `sattva_sales_exec` + compliance read | view | supplier path read |
| Compliance & Regulatory | `sattva_compliance_officer` | edit SOPs | PCP paths |
| Logistics & Ops | `sattva_logistics_exec` | view | client order paths |
| Finance & Accounts | `sattva_finance_manager` | view | invoices path |
| IT & Data | admin | Ops Dashboard edit | admin |
| BI / Marketing / HR | read-only Odoo / none | GREEN content | no |

- [ ] **Step 2: XML groups + ACL for compliance fields**

Only `sattva_compliance_officer` (and admin) may write `supplier_pcp_status` to `approved`.

- [ ] **Step 3: Commit**

```bash
git add addons/sattva_compliance/security
git commit -m "feat(security): add Sattva department-aligned Odoo groups"
```

---

### Task 10: Fabric Implementation Tasks board (Notion, not LifeOS)

**Files:**
- Create: `docs/superpowers/runbooks/fabric-tasks-board-setup.md`
- Notion: typed Tasks database under Knowledge Base / System Fabric

**Interfaces:**
- Consumes: this plan’s Task 1–9
- Produces: board usable by `tasks-build` skill

- [ ] **Step 1: Create database under Sattva KB (not LifeOS Tasks DB)**

Recommended properties: Task Name (title), Status (To Do / In Progress / Done), Priority, Phase (0–3), Department, Plan Task #, Evidence Link (url), Blocked Reason (text).

- [ ] **Step 2: Seed rows for Tasks 1–9 of this plan**

- [ ] **Step 3: Document URL in runbook + link from System Fabric**

- [ ] **Step 4: Commit runbook**

```bash
git add docs/superpowers/runbooks/fabric-tasks-board-setup.md
git commit -m "docs(notion): Fabric Implementation Tasks board setup"
```

---

## Self-review checklist

1. **Spec coverage:** Fabric Phase 1 acceptance (views, PO gate, folder provision, COA workflow, GREEN logs) mapped to Tasks 1–4; Notion dashboard + webhooks Task 5; CF edge Task 6; middleware Task 7; GCP Path Task 8; RBAC Task 9; task board Task 10.
2. **Placeholder scan:** No TBD steps; concrete files and commands.
3. **Type consistency:** `nextcloud_folder_path` + `nextcloud_folder_checksum` used consistently; roles Employee/Buyer/Supplier match middleware matrix.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-13-sattva-gcp-cf-notion-ops-dashboard.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — executing-plans with checkpoints

Which approach?
