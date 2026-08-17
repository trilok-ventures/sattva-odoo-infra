# Internal Services and n8n Workers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the named internal-service register, n8n queue workers, Git-owned workflows, buyer KYC (separate from PCP), GREEN lead-score, Odoo-activity notifications, GREEN catalogue BFF, and metadata-only uploads real in the local fabric and mock BFF.

**Architecture:** Keep Odoo as SoR, n8n as pass-through bus, Nextcloud as vault. The Vercel BFF stays GREEN: it never receives file bytes or vault paths. RED bytes, when tested locally, POST to a loopback origin uploader, not to Next.js. Do not implement T2 mTLS, CAS, GKE, or live Keycloak in this plan.

**Tech Stack:** Docker Compose; Odoo 18; `sattva_compliance`; n8n queue mode + Redis worker; Nextcloud; Node 22 (workflow validator, BFF contract-check, local upload origin); Next.js 15 middleware BFF.

## Global Constraints

- Locked fabric wins: one SoR per domain; n8n stores no business state; RED never reaches Vercel, Hugging Face, Tavily, or Notion.
- `purchase.order.button_confirm` stays blocked unless `supplier_pcp_status = approved`. Never call confirm from n8n.
- Do not reuse `supplier_pcp_status` for buyers. Buyer completeness is `buyer_kyc_status` only.
- Lead-score payloads allow only `hashed_partner_id`, `stage_rank`, `days_in_stage`, `product_family_code`, `order_count`. No names, emails, notes, or PDFs.
- No `NEXT_PUBLIC_` fabric URLs. No secrets in git. No CAS, Cloud Service Mesh, Vault PKI, or Caddy mTLS snippets.
- Do not execute `docs/superpowers/plans/2026-08-17-gke-security-test-environment.md` as part of this plan.
- Root `vercel.json` stays mocks-only (`outputDirectory: docs/superpowers/mocks`).
- Compose published ports bind to `127.0.0.1` only.
- Do not edit committed `config/odoo.conf`. Local Odoo flags come from `docker-compose.override.yml` (`-c /dev/null`).

## Current repo baseline (do not redo)

- `docker-compose.yml` already has `web`, `db`, `nextcloud`, `n8n` (`EXECUTIONS_MODE=queue`), `redis`. **Missing `n8n-worker`.** All published ports are already loopback.
- `addons/sattva_compliance` already has PCP fields, `button_confirm` gate, `sattva.fabric.event`, supplier folder events, `group_n8n_fabric_service`. **No** `buyer_kyc_status`, **no** `crm.lead` score fields, **no** handoff model.
- `n8n/workflows/` is README-only (no JSON yet).
- Middleware BFF: mock adapter, `POST /api/documents` metadata-only (supplier persona), `red-keys.json` strip. Persona union lacks `logistics`. Health still treats Nextcloud as a BFF dependency.
- `deploy/gcp/secret-names.md` still lists Vercel Nextcloud WebDAV — Task 10 deletes those rows.
- Existing test `test_non_supplier_creation_does_not_queue_folder_request` creates `supplier_rank: 0` and asserts **zero** fabric events. Keep `customer_rank` at `0` there so buyer-folder work does not break it.

## Phase split (one plan, two gates)

Spec §15 sequences Phase 1 workers before Phase 2 BFF contracts. This plan keeps them in one file so the spine is reviewable, with a hard gate before GREEN scoring.

| Tasks | Spec gate | Start when |
| --- | --- | --- |
| 1–6, 11 | Phase 1 local fabric | Immediately |
| 7–10 | Phase 2 mock BFF | **Task 7 must not start** until Task 2 healthcheck prints success **and** Task 4 `validate-workflows.mjs` prints `workflow validation passed` |
| 12 | CI policy | After Tasks 1–11 files exist |

Deferred (separate dated plan after CFIA audit or enterprise buyer): AssetCo CAS, Caddy client-auth, production `upload.trilokventures.org` Caddy vhost, live Keycloak, GKE, live Hugging Face OCR.

## File Structure

- Create: `n8n/workflows/service-register.json` — identity register the CI schema-checks.
- Create: `n8n/workflows/validate-register.mjs`
- Create: `n8n/workflows/validate-workflows.mjs` — RED-log and node-shape policy.
- Create: `n8n/workflows/leadscore.mjs` — GREEN allowlist scorer (unit-tested).
- Create: `n8n/workflows/wf.supplier.folder.json`
- Create: `n8n/workflows/wf.buyer.onboard.folder.json`
- Create: `n8n/workflows/wf.coa.verify.json`
- Create: `n8n/workflows/wf.lead.score.json`
- Create: `n8n/workflows/wf.notify.role.json`
- Create: `n8n/workflows/wf.order.handoff.json`
- Create: `n8n/workflows/fixtures/coa-pass.json` and `coa-fail.json`
- Modify: `docker-compose.yml` — add `n8n-worker` (no published ports) and optional `upload-origin`.
- Modify: `deploy/local/compose-healthcheck.sh` — require worker; forbid worker host ports.
- Modify: `addons/sattva_compliance/` — `buyer_kyc_status`, `nextcloud_client_folder_path`, customer folder events, `sattva.fabric.vault.set_partner_path`, `crm.lead` GREEN score, notify helper, handoff helper, tests. Do not grant `group_n8n_fabric_service` generic `res.partner` write.
- Modify: `middleware/` — activities, catalogue, mint-upload-url; drop BFF WebDAV health requirement.
- Create: `deploy/local/upload-origin/server.mjs` — loopback POST-only byte sink for local tests.
- Modify: `deploy/gcp/secret-names.md` — remove Vercel Nextcloud WebDAV; add origin-upload secret names.
- Modify: `.github/workflows/n8n-workflows.yml` — validate workflow JSON on PR.

---

### Task 1: Service identity register and schema check

**Files:**
- Create: `n8n/workflows/service-register.json`
- Create: `n8n/workflows/validate-register.mjs`
- Test: run `node n8n/workflows/validate-register.mjs`

**Interfaces:**
- Produces JSON object `{ "services": ServiceRow[] }` where `ServiceRow` has keys `id`, `caller`, `callee`, `hostname`, `ingress`, `tls_rung`, `access_policy`, `data_class`, `sor`, `phase`.
- Later tasks must use these exact `id` strings: `svc.portal.odoo`, `svc.portal.n8n`, `svc.n8n.fabric`, `svc.n8n.vault`, `svc.upload.origin`, `svc.leadscore.green`, `svc.catalogue.green`, `svc.notify.cache`, `svc.kc.oidc`.
- Consumes nothing.

- [ ] **Step 1: Write the failing register validator**

Create `n8n/workflows/validate-register.mjs`:

```javascript
#!/usr/bin/env node
import { readFileSync } from "node:fs";

const REQUIRED = [
  "id",
  "caller",
  "callee",
  "hostname",
  "ingress",
  "tls_rung",
  "access_policy",
  "data_class",
  "sor",
  "phase",
];
const ALLOWED_IDS = new Set([
  "svc.portal.odoo",
  "svc.portal.n8n",
  "svc.n8n.fabric",
  "svc.n8n.vault",
  "svc.upload.origin",
  "svc.leadscore.green",
  "svc.catalogue.green",
  "svc.notify.cache",
  "svc.kc.oidc",
]);
const FORBIDDEN_IDS = new Set(["svc.portal.nc"]);

const register = JSON.parse(readFileSync(new URL("./service-register.json", import.meta.url)));
const ids = new Set();
for (const row of register.services) {
  for (const key of REQUIRED) {
    if (!row[key] || String(row[key]).trim() === "") {
      throw new Error(`missing ${key} on ${row.id || "?"}`);
    }
  }
  if (FORBIDDEN_IDS.has(row.id)) throw new Error("svc.portal.nc is forbidden");
  if (!ALLOWED_IDS.has(row.id)) throw new Error(`unknown id ${row.id}`);
  if (ids.has(row.id)) throw new Error(`duplicate ${row.id}`);
  ids.add(row.id);
  if (row.id === "svc.portal.odoo" && /nextcloud|webdav/i.test(JSON.stringify(row))) {
    throw new Error("BFF Odoo row must not mention Nextcloud");
  }
  if (row.id === "svc.upload.origin" && /vercel/i.test(row.hostname)) {
    throw new Error("upload origin must not be Vercel");
  }
  if (row.id === "svc.leadscore.green") {
    if (!String(row.callee).includes("leadscore.mjs")) {
      throw new Error("svc.leadscore.green callee must be local leadscore.mjs until HF plan");
    }
    if (/huggingface\.co/i.test(row.callee)) {
      throw new Error("svc.leadscore.green must not call huggingface.co in this plan");
    }
  }
  if (row.id === "svc.portal.n8n" && !/AMBER metadata/i.test(row.data_class)) {
    throw new Error("svc.portal.n8n data_class must be AMBER metadata");
  }
  if (row.id === "svc.kc.oidc" && String(row.phase) !== "3") {
    throw new Error("svc.kc.oidc phase must be 3");
  }
}
for (const id of ALLOWED_IDS) {
  if (!ids.has(id)) throw new Error(`missing ${id}`);
}
console.log("service-register validation passed");
```

- [ ] **Step 2: Run validator without the JSON**

Run:

```bash
node n8n/workflows/validate-register.mjs
```

Expected: FAIL with `ENOENT` for `service-register.json`.

- [ ] **Step 3: Add the register**

Create `n8n/workflows/service-register.json`:

```json
{
  "services": [
    {
      "id": "svc.portal.odoo",
      "caller": "Vercel BFF",
      "callee": "Odoo JSON-2",
      "hostname": "sattva.trilokventures.org",
      "ingress": "Access service token or origin allowlist",
      "tls_rung": "T1 HTTPS",
      "access_policy": "BFF service account svc.portal.odoo only; browsers never see the URL",
      "data_class": "AMBER in; GREEN/AMBER out per persona",
      "sor": "Reads/writes Odoo only; persists nothing",
      "phase": "2"
    },
    {
      "id": "svc.portal.n8n",
      "caller": "Vercel BFF",
      "callee": "n8n webhook",
      "hostname": "n8n.trilokventures.org",
      "ingress": "webhook path, IT Access + webhook HMAC",
      "tls_rung": "T1 HTTPS",
      "access_policy": "Metadata/triggers only (record id, sha256, filename, stage). No file bytes",
      "data_class": "AMBER metadata",
      "sor": "n8n does not keep business state",
      "phase": "2"
    },
    {
      "id": "svc.n8n.fabric",
      "caller": "n8n workers",
      "callee": "Odoo",
      "hostname": "odoo (Compose-internal)",
      "ingress": "cluster-internal only",
      "tls_rung": "T0 local; T1 prod",
      "access_policy": "Least-privilege Odoo user n8n.fabric",
      "data_class": "AMBER + GREEN extracts",
      "sor": "Pass-through; RED save-data disabled",
      "phase": "1"
    },
    {
      "id": "svc.n8n.vault",
      "caller": "n8n workers",
      "callee": "Nextcloud WebDAV",
      "hostname": "nextcloud (Compose-internal)",
      "ingress": "cluster-internal only; not reachable from Vercel",
      "tls_rung": "T0 local; T1 prod",
      "access_policy": "Nextcloud app-password scoped to /PCP/, /Clients/, /Suppliers/",
      "data_class": "RED in transit",
      "sor": "Move files; Odoo stores path + sha256; log metadata only",
      "phase": "1"
    },
    {
      "id": "svc.upload.origin",
      "caller": "Browser",
      "callee": "origin Caddy then n8n vault hop",
      "hostname": "upload.trilokventures.org",
      "ingress": "POST only, no listing",
      "tls_rung": "T1 HTTPS",
      "access_policy": "Minted after BFF metadata call. Max body 100MB. Bytes never touch Vercel",
      "data_class": "RED in transit",
      "sor": "Writes via svc.n8n.vault; Odoo stores path + sha256",
      "phase": "2"
    },
    {
      "id": "svc.leadscore.green",
      "caller": "n8n workers",
      "callee": "local leadscore.mjs (HF wiring is a later plan)",
      "hostname": "none (in-process)",
      "ingress": "n8n Code node / local module",
      "tls_rung": "T0 local until HF plan",
      "access_policy": "n8n worker only. Allowlist hashed_partner_id, stage_rank, days_in_stage, product_family_code, order_count",
      "data_class": "GREEN",
      "sor": "writes crm.lead.sattva_green_score only",
      "phase": "2"
    },
    {
      "id": "svc.catalogue.green",
      "caller": "Vercel BFF",
      "callee": "Odoo product via svc.portal.odoo",
      "hostname": "sattva.trilokventures.org",
      "ingress": "same as svc.portal.odoo",
      "tls_rung": "T1",
      "access_policy": "Anonymous PUBLIC/GREEN cards. Authenticated buyer: GREEN + own AMBER quotes",
      "data_class": "GREEN / PUBLIC",
      "sor": "No separate catalogue DB",
      "phase": "2"
    },
    {
      "id": "svc.notify.cache",
      "caller": "Vercel BFF",
      "callee": "Odoo mail.activity via svc.portal.odoo",
      "hostname": "sattva.trilokventures.org",
      "ingress": "same as svc.portal.odoo",
      "tls_rung": "T1",
      "access_policy": "Role-filtered. 30-day UI cache of mail.activity. No unique inbox records",
      "data_class": "AMBER pointers",
      "sor": "Odoo is SoR; BFF cache is disposable",
      "phase": "2"
    },
    {
      "id": "svc.kc.oidc",
      "caller": "BFF, Odoo, n8n, Nextcloud",
      "callee": "Keycloak",
      "hostname": "auth.trilokventures.org",
      "ingress": "/admin Access-only",
      "tls_rung": "T1",
      "access_policy": "Public login endpoints; confidential clients for origin apps",
      "data_class": "Identity",
      "sor": "Keycloak is IdP, not CRM",
      "phase": "3"
    }
  ]
}
```

`svc.upload.origin` `hostname` is the production name `upload.trilokventures.org`. Local tests later bind `127.0.0.1:8091` as a **test-only** stand-in (Task 10). Do not put Vercel in that field.

- [ ] **Step 4: Re-run validator**

```bash
node n8n/workflows/validate-register.mjs
```

Expected: `service-register validation passed`.

- [ ] **Step 5: Commit**

```bash
git add n8n/workflows/service-register.json n8n/workflows/validate-register.mjs
git commit -m "feat: add internal service identity register"
```

---

### Task 2: n8n queue worker in Compose

**Files:**
- Modify: `docker-compose.yml`
- Modify: `deploy/local/compose-healthcheck.sh`

**Interfaces:**
- Consumes existing `n8n` + `redis` on `sattva_cloud_net`.
- Produces service name `n8n-worker` with `command: ["worker"]`, **no** `ports` key, same `N8N_ENCRYPTION_KEY` and `QUEUE_BULL_REDIS_HOST=redis` as `n8n`, same `n8n-data` volume so queue workers see editor credentials.

- [ ] **Step 1: Extend the healthcheck to require a worker with no host ports**

In `deploy/local/compose-healthcheck.sh`, insert this block **immediately before** `if errors:` (after the `required_hostnames` loop, around the current line 66):

```python
worker = services.get("n8n-worker")
if worker is None:
    errors.append("missing service: n8n-worker")
else:
    if worker.get("ports"):
        errors.append("n8n-worker must not publish host ports")
    command = worker.get("command") or []
    if "worker" not in command:
        errors.append("n8n-worker command must include worker")
    if "sattva_cloud_net" not in (worker.get("networks") or {}):
        errors.append("n8n-worker is not attached to sattva_cloud_net")
    environment = worker.get("environment") or {}
    env_map = environment if isinstance(environment, dict) else {}
    if isinstance(environment, list):
        env_map = dict(item.split("=", 1) for item in environment if "=" in item)
    if env_map.get("EXECUTIONS_MODE") != "queue":
        errors.append("n8n-worker EXECUTIONS_MODE must be queue")
    if env_map.get("QUEUE_BULL_REDIS_HOST") != "redis":
        errors.append("n8n-worker must use redis queue host")
```

Do **not** add `n8n-worker` to `required_hostnames`. That map currently requires loopback **host** ports; the worker must have none.

- [ ] **Step 2: Run healthcheck (expect fail)**

```bash
cp deploy/local/.env.example .env
./deploy/local/compose-healthcheck.sh .env
```

Expected: exit `1` with `missing service: n8n-worker`.

- [ ] **Step 3: Add the worker service**

Append to `docker-compose.yml` before the `volumes:` key (same image tag as `n8n`, no ports). Mount the same data volume so the worker can decrypt credentials created in the editor:

```yaml
  n8n-worker:
    image: n8nio/n8n:latest
    container_name: sattva-n8n-worker
    command: ["worker"]
    depends_on:
      - redis
      - n8n
    environment:
      - EXECUTIONS_MODE=queue
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY:?set N8N_ENCRYPTION_KEY}
      - QUEUE_BULL_REDIS_HOST=redis
    volumes:
      - n8n-data:/home/node/.n8n
    restart: always
    networks:
      - sattva_cloud_net
```

Pin both `n8n` and `n8n-worker` to the same image tag already used (`n8nio/n8n:latest` until a digest pin lands in a later plan). Do not publish `5678` on the worker. Do not add n8n Postgres in this task (current editor already uses queue mode without it).

- [ ] **Step 4: Re-run healthcheck**

```bash
./deploy/local/compose-healthcheck.sh .env
```

Expected: `Compose fabric is valid and all published ports are loopback-only.`

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml deploy/local/compose-healthcheck.sh
git commit -m "feat: add n8n queue worker to local fabric"
```

---

### Task 3: Workflow RED-log validator

**Files:**
- Create: `n8n/workflows/validate-workflows.mjs`
- Create: `n8n/workflows/fixtures/bad-save-data.json` (test fixture only; do not import to n8n)

**Interfaces:**
- `validate-workflows.mjs <files...>` exits `0` and prints `workflow validation passed` when every node has `id`, `type`, `name` and the file text does not contain `saveDataSuccessExecution` / `saveDataErrorExecution` set to `"all"`.
- Workflow `settings.saveDataSuccessExecution` and `settings.saveDataErrorExecution` must equal `"none"`.

- [ ] **Step 1: Write the validator**

```javascript
#!/usr/bin/env node
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (!files.length) throw new Error("usage: validate-workflows.mjs <workflow.json...>");

for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (text.includes('saveDataSuccessExecution":"all"') || text.includes('saveDataSuccessExecution": "all"')) {
    throw new Error(`${file}: saveDataSuccessExecution all is forbidden`);
  }
  if (text.includes('saveDataErrorExecution":"all"') || text.includes('saveDataErrorExecution": "all"')) {
    throw new Error(`${file}: saveDataErrorExecution all is forbidden`);
  }
  const wf = JSON.parse(text);
  if (wf.settings?.saveDataSuccessExecution !== "none") {
    throw new Error(`${file}: settings.saveDataSuccessExecution must be none`);
  }
  if (wf.settings?.saveDataErrorExecution !== "none") {
    throw new Error(`${file}: settings.saveDataErrorExecution must be none`);
  }
  if (!Array.isArray(wf.nodes) || wf.nodes.length === 0) {
    throw new Error(`${file}: nodes required`);
  }
  for (const node of wf.nodes) {
    if (!node.id || !node.type || !node.name) {
      throw new Error(`${file}: node missing id/type/name`);
    }
  }
}
console.log("workflow validation passed");
```

- [ ] **Step 2: Add a forbidden fixture and prove the validator fails**

`n8n/workflows/fixtures/bad-save-data.json`:

```json
{
  "name": "bad",
  "nodes": [{ "id": "a", "name": "x", "type": "n8n-nodes-base.manualTrigger" }],
  "connections": {},
  "settings": {
    "saveDataSuccessExecution": "all",
    "saveDataErrorExecution": "none"
  }
}
```

Run:

```bash
node n8n/workflows/validate-workflows.mjs n8n/workflows/fixtures/bad-save-data.json
```

Expected: FAIL mentioning `saveDataSuccessExecution`.

- [ ] **Step 3: Commit**

```bash
git add n8n/workflows/validate-workflows.mjs n8n/workflows/fixtures/bad-save-data.json
git commit -m "test: reject n8n workflows that persist execution data"
```

---

### Task 4: Supplier folder and COA workflows

**Files:**
- Create: `addons/sattva_compliance/models/vault.py`
- Modify: `addons/sattva_compliance/models/__init__.py`
- Create: `addons/sattva_compliance/tests/test_vault_path.py`
- Modify: `addons/sattva_compliance/tests/__init__.py`
- Create: `n8n/workflows/wf.supplier.folder.json`
- Create: `n8n/workflows/wf.coa.verify.json`
- Create: `n8n/workflows/fixtures/coa-pass.json`
- Create: `n8n/workflows/fixtures/coa-fail.json`
- Modify: `n8n/workflows/README.md`

**Interfaces:**
- `env["sattva.fabric.vault"].set_partner_path(partner_id: int, requested_path: str, kind: "supplier" | "client")` writes **only** `nextcloud_folder_path` (`supplier`) or `nextcloud_client_folder_path` (`client`). It never writes `supplier_pcp_status`, `buyer_kyc_status`, or other partner fields. n8n calls this method; it must **not** `execute_kw res.partner write`.
- `wf.supplier.folder` consumes Odoo `sattva.fabric.event` rows with `event_type=supplier_folder_requested` and `state=queued`. Produces Nextcloud MKCOL for `requested_path`, calls `set_partner_path(..., "supplier")`, sets event `state=processed`. Uses credential **names** `odooN8nFabric` and `nextcloudN8nVault` (n8n credential store; not git).
- `wf.coa.verify` has two triggers that share the Compare node: (1) a GREEN metadata webhook for unit fixtures, (2) a Nextcloud **webhook** node that maps upload events to `{ filename, sha256, moisture_pct, mesh_pass, spec_moisture_max, spec_mesh_required }`. If the payload contains `bytes`, `pdf`, `path`, `nextcloud_folder_path`, or `file_bytes`, Compare **throws** (fail closed) — do not `delete` and continue. The Nextcloud trigger is a webhook **n8n receives**; it does **not** download PDF bytes, call Hugging Face, or write Odoo lots. Nextcloud Flow (or a test `curl`) POSTs GREEN metadata JSON. Fixture JSON is not Phase 1 COA acceptance by itself; the Nextcloud trigger is required in the same workflow file.

- [ ] **Step 1: Add GREEN COA fixtures**

`n8n/workflows/fixtures/coa-pass.json`:

```json
{
  "filename": "SYNTHETIC-COA-pass.pdf",
  "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "moisture_pct": 4.8,
  "mesh_pass": true,
  "spec_moisture_max": 6.0,
  "spec_mesh_required": true
}
```

`n8n/workflows/fixtures/coa-fail.json`:

```json
{
  "filename": "SYNTHETIC-COA-fail.pdf",
  "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "moisture_pct": 12.0,
  "mesh_pass": false,
  "spec_moisture_max": 6.0,
  "spec_mesh_required": true
}
```

- [ ] **Step 2: Add `sattva.fabric.vault.set_partner_path` then `wf.supplier.folder.json`**

`addons/sattva_compliance/models/vault.py`:

```python
from odoo import api, models
from odoo.exceptions import UserError


class FabricVault(models.AbstractModel):
    _name = "sattva.fabric.vault"
    _description = "Write vault path pointers without touching PCP"

    @api.model
    def set_partner_path(self, partner_id, requested_path, kind):
        if kind not in ("supplier", "client"):
            raise UserError("unknown path kind")
        if not requested_path or ".." in str(requested_path):
            raise UserError("invalid requested_path")
        partner = self.env["res.partner"].browse(int(partner_id))
        if not partner.exists():
            raise UserError("partner not found")
        field = (
            "nextcloud_folder_path" if kind == "supplier" else "nextcloud_client_folder_path"
        )
        current = partner[field]
        if current and current != requested_path:
            raise UserError("vault path already set")
        partner.sudo().write({field: requested_path})
        return True
```

Append `from . import vault` in `models/__init__.py`.

`addons/sattva_compliance/tests/test_vault_path.py`:

```python
from odoo.exceptions import UserError
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestVaultPath(TransactionCase):
    def test_set_supplier_path_does_not_change_pcp(self):
        partner = self.env["res.partner"].create(
            {"name": "Synthetic Vault Mill", "supplier_rank": 1}
        )
        self.assertEqual(partner.supplier_pcp_status, "pending")
        self.env["sattva.fabric.vault"].set_partner_path(
            partner.id, "/Suppliers/Synthetic_Vault_Mill/Certificates/", "supplier"
        )
        self.assertEqual(
            partner.nextcloud_folder_path,
            "/Suppliers/Synthetic_Vault_Mill/Certificates/",
        )
        self.assertEqual(partner.supplier_pcp_status, "pending")

    def test_set_partner_path_rejects_unknown_kind(self):
        partner = self.env["res.partner"].create({"name": "Synthetic Vault X"})
        with self.assertRaises(UserError):
            self.env["sattva.fabric.vault"].set_partner_path(
                partner.id, "/tmp/nope", "inbox"
            )
```

Set `tests/__init__.py` to:

```python
from . import test_supplier_folder_request
from . import test_vault_path
```

`nextcloud_client_folder_path` is added in Task 5; until then `kind="client"` will KeyError if called — Task 6 is the first client caller.

Do not add `res.partner` rows to `ir.model.access.csv` for `group_n8n_fabric_service`.

Minimal importable workflow (credentials by **name** only). Include the WebDAV MKCOL hop so n8n, not Vercel, creates the folder. The write node calls `set_partner_path`, not `res.partner.write`:

```json
{
  "name": "wf.supplier.folder",
  "nodes": [
    {
      "id": "poll-events",
      "name": "Poll queued folder events",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [0, 0],
      "parameters": { "rule": { "interval": [{ "field": "minutes", "minutesInterval": 5 }] } }
    },
    {
      "id": "search-events",
      "name": "Search queued events",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [220, 0],
      "parameters": {
        "method": "POST",
        "url": "={{$env.ODOO_JSON2_URL}}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":{\"service\":\"object\",\"method\":\"execute_kw\",\"args\":[\"sattva\",\"{{$env.ODOO_N8N_UID}}\",\"{{$credentials.odooN8nFabric.apiKey}}\",\"sattva.fabric.event\",\"search_read\",[[\"event_type\",\"=\",\"supplier_folder_requested\"],[\"state\",\"=\",\"queued\"]],{\"fields\":[\"id\",\"partner_id\",\"requested_path\"]}]}}"
      }
    },
    {
      "id": "mkcol-vault",
      "name": "MKCOL Nextcloud path",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [440, 0],
      "parameters": {
        "method": "MKCOL",
        "url": "={{$env.NEXTCLOUD_WEBDAV_BASE}}{{$json.requested_path}}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpBasicAuth"
      }
    },
    {
      "id": "write-partner-path",
      "name": "Write nextcloud_folder_path",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [660, 0],
      "parameters": {
        "method": "POST",
        "url": "={{$env.ODOO_JSON2_URL}}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":{\"service\":\"object\",\"method\":\"execute_kw\",\"args\":[\"sattva\",\"{{$env.ODOO_N8N_UID}}\",\"{{$credentials.odooN8nFabric.apiKey}}\",\"sattva.fabric.vault\",\"set_partner_path\",[{{$json.partner_id}},\"{{$json.requested_path}}\",\"supplier\"]]}}"
      }
    },
    {
      "id": "mark-event-processed",
      "name": "Mark event processed",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [880, 0],
      "parameters": {
        "method": "POST",
        "url": "={{$env.ODOO_JSON2_URL}}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":{\"service\":\"object\",\"method\":\"execute_kw\",\"args\":[\"sattva\",\"{{$env.ODOO_N8N_UID}}\",\"{{$credentials.odooN8nFabric.apiKey}}\",\"sattva.fabric.event\",\"write\",[[{{$json.id}}],{\"state\":\"processed\"}]]}}"
      }
    }
  ],
  "connections": {
    "Poll queued folder events": {
      "main": [[{ "node": "Search queued events", "type": "main", "index": 0 }]]
    },
    "Search queued events": {
      "main": [[{ "node": "MKCOL Nextcloud path", "type": "main", "index": 0 }]]
    },
    "MKCOL Nextcloud path": {
      "main": [[{ "node": "Write nextcloud_folder_path", "type": "main", "index": 0 }]]
    },
    "Write nextcloud_folder_path": {
      "main": [[{ "node": "Mark event processed", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "saveDataSuccessExecution": "none",
    "saveDataErrorExecution": "none",
    "executionTimeout": 60
  }
}
```

Credential store names: `odooN8nFabric`, Nextcloud basic auth `nextcloudN8nVault`. Never commit passwords. MKCOL URL is built at runtime from env + Odoo `requested_path`; the BFF never sees it.

- [ ] **Step 3: Add `wf.coa.verify.json` with GREEN compare plus Nextcloud webhook**

Include both triggers. Compare deletes RED keys and emits `coa_sha256` only (no filename, no supplier name):

```json
{
  "name": "wf.coa.verify",
  "nodes": [
    {
      "id": "coa-nextcloud-hook",
      "name": "Nextcloud COA webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [0, 180],
      "webhookId": "wf-coa-nextcloud",
      "parameters": {
        "httpMethod": "POST",
        "path": "nextcloud-coa",
        "responseMode": "lastNode",
        "options": {}
      }
    },
    {
      "id": "coa-webhook",
      "name": "COA metadata webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [0, 0],
      "webhookId": "wf-coa-verify",
      "parameters": {
        "httpMethod": "POST",
        "path": "coa-verify",
        "responseMode": "lastNode",
        "options": {}
      }
    },
    {
      "id": "coa-compare",
      "name": "Compare GREEN metrics",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [240, 0],
      "parameters": {
        "jsCode": "const b = $input.first().json;\nconst forbidden = ['bytes','pdf','path','nextcloud_folder_path','file_bytes'];\nfor (const k of Object.keys(b)) { if (forbidden.includes(k)) { throw new Error('RED key forbidden in COA compare: ' + k); } }\nconst coa_pass = Number(b.moisture_pct) <= Number(b.spec_moisture_max) && Boolean(b.mesh_pass) === Boolean(b.spec_mesh_required);\nreturn [{ json: { coa_pass, moisture_pct: b.moisture_pct, mesh_pass: b.mesh_pass, coa_sha256: b.sha256 } }];"
      }
    }
  ],
  "connections": {
    "COA metadata webhook": {
      "main": [[{ "node": "Compare GREEN metrics", "type": "main", "index": 0 }]]
    },
    "Nextcloud COA webhook": {
      "main": [[{ "node": "Compare GREEN metrics", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "saveDataSuccessExecution": "none",
    "saveDataErrorExecution": "none",
    "executionTimeout": 30
  }
}
```

- [ ] **Step 4: Validate both workflows and replace the README**

```bash
node n8n/workflows/validate-workflows.mjs \
  n8n/workflows/wf.supplier.folder.json \
  n8n/workflows/wf.coa.verify.json
```

Expected: `workflow validation passed`.

Then run the Odoo vault tests (same docker `-u` command as Task 5 Step 2). Expected: `test_set_supplier_path_does_not_change_pcp` passes.

Replace `n8n/workflows/README.md` with:

```markdown
# n8n workflows (source of truth)

Production workflow JSON lives here, reviewed in PRs, imported to staging
then production. Do not treat the n8n editor as canonical.

Compose runs `n8n` (editor, host 127.0.0.1:5678) plus `n8n-worker` (no
host ports) on Redis (`EXECUTIONS_MODE=queue`).

RED-touching nodes: `settings.saveDataSuccessExecution` and
`settings.saveDataErrorExecution` must be `none` so execution logs never
keep COA bytes or vault paths. CI runs `validate-workflows.mjs`.

Local `127.0.0.1:8091` (`deploy/local/upload-origin`) is an ephemeral T0
test sink. It is not Nextcloud and not production `upload.trilokventures.org`.

Credential names used by workflows (values stay in the n8n store, not git):
`odooN8nFabric`, `nextcloudN8nVault`.
```

- [ ] **Step 5: Commit**

```bash
git add addons/sattva_compliance n8n/workflows
git commit -m "feat: add supplier folder and COA n8n workflows"
```

---

### Task 5: Buyer KYC field and customer folder events

**Files:**
- Modify: `addons/sattva_compliance/__manifest__.py` — add `'crm'` to `depends` (needed by Task 7; add it here so one module update covers both).
- Modify: `addons/sattva_compliance/models/res_partner.py`
- Create: `addons/sattva_compliance/tests/test_buyer_kyc.py`
- Modify: `addons/sattva_compliance/tests/__init__.py`
- Modify: `addons/sattva_compliance/tests/test_supplier_folder_request.py` — set `customer_rank: 0` on the non-supplier case so it cannot emit a buyer folder.

**Interfaces:**
- Produces `res.partner.buyer_kyc_status` ∈ `{pending, review, complete, blocked}`, default `pending`.
- Produces `res.partner.nextcloud_client_folder_path` (Char, readonly), empty until n8n calls `set_partner_path(..., "client")`. Supplier vault pointer stays `nextcloud_folder_path`. Dual-role partners keep **two** Odoo pointers into **one** vault; do not overwrite one with the other.
- Produces `sattva.fabric.event` `event_type=buyer_folder_requested` with `requested_path=/Clients/{sanitized}/Onboarding/` when `customer_rank > 0`.
- Consumes existing `sattva.fabric.event` model and `sattva.fabric.vault.set_partner_path`. Must not change `button_confirm` logic.
- A partner that is both customer and supplier may emit **two** events. Do not set `supplier_pcp_status` from KYC.

- [ ] **Step 1: Write the failing tests**

`addons/sattva_compliance/tests/test_buyer_kyc.py`:

```python
from odoo.exceptions import UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestBuyerKyc(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_fabric_service_kyc",
            groups="sattva_compliance.group_n8n_fabric_service",
        )

    def test_customer_create_queues_onboarding_folder_and_pending_kyc(self):
        partner = self.env["res.partner"].create(
            {"name": "Synthetic Foods Inc", "customer_rank": 1}
        )
        event = self.env["sattva.fabric.event"].with_user(self.fabric_user).search(
            [
                ("event_type", "=", "buyer_folder_requested"),
                ("partner_id", "=", partner.id),
            ]
        )
        self.assertEqual(len(event), 1)
        self.assertEqual(
            event.requested_path,
            "/Clients/Synthetic_Foods_Inc/Onboarding/",
        )
        self.assertEqual(partner.buyer_kyc_status, "pending")
        self.assertEqual(partner.supplier_pcp_status, "pending")

    def test_buyer_kyc_complete_does_not_unlock_po(self):
        supplier = self.env["res.partner"].create(
            {
                "name": "Synthetic Mill",
                "supplier_rank": 1,
                "buyer_kyc_status": "complete",
                "supplier_pcp_status": "pending",
            }
        )
        product = self.env["product.product"].create({"name": "SYNTHETIC-ONION"})
        po = self.env["purchase.order"].create(
            {
                "partner_id": supplier.id,
                "order_line": [
                    (0, 0, {"product_id": product.id, "product_qty": 1, "price_unit": 1.0})
                ],
            }
        )
        with self.assertRaises(UserError) as err:
            po.button_confirm()
        self.assertIn("Compliance Gate Blocked", str(err.exception))

    def test_dual_role_keeps_two_vault_pointers(self):
        partner = self.env["res.partner"].create(
            {
                "name": "Synthetic Dual",
                "supplier_rank": 1,
                "customer_rank": 1,
            }
        )
        events = self.env["sattva.fabric.event"].search(
            [("partner_id", "=", partner.id)]
        )
        self.assertEqual(
            set(events.mapped("event_type")),
            {"supplier_folder_requested", "buyer_folder_requested"},
        )
        self.env["sattva.fabric.vault"].set_partner_path(
            partner.id, "/Suppliers/Synthetic_Dual/Certificates/", "supplier"
        )
        self.env["sattva.fabric.vault"].set_partner_path(
            partner.id, "/Clients/Synthetic_Dual/Onboarding/", "client"
        )
        self.assertEqual(
            partner.nextcloud_folder_path,
            "/Suppliers/Synthetic_Dual/Certificates/",
        )
        self.assertEqual(
            partner.nextcloud_client_folder_path,
            "/Clients/Synthetic_Dual/Onboarding/",
        )
```

In `tests/__init__.py` add:

```python
from . import test_supplier_folder_request
from . import test_vault_path
from . import test_buyer_kyc
```

In `test_supplier_folder_request.py`, change the non-supplier create vals to:

```python
{
    "name": "Synthetic Buyer",
    "supplier_rank": 0,
    "customer_rank": 0,
}
```

- [ ] **Step 2: Run tests (expect fail on missing field)**

If Compose is down, start it per `AGENTS.md` (`sudo dockerd` then `sudo docker compose up -d`) and install/update the addon once so `-u` can run tests.

```bash
DBPASS=$(grep '^ODOO_DB_PASSWORD=' .env | cut -d= -f2-)
sudo docker exec sattva-odoo-web odoo -d sattva -u sattva_compliance \
  --test-enable --stop-after-init \
  --test-tags /sattva_compliance \
  --db_host=db --db_port=5432 --db_user=odoo --db_password="$DBPASS" \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  -c /dev/null
```

Expected: FAIL until `buyer_kyc_status` and customer create hook exist.

- [ ] **Step 3: Implement the field and hook**

In `__manifest__.py` change depends to:

```python
    'depends': ['base', 'purchase', 'contacts', 'crm'],
```

In `res_partner.py`, replace `create()` and add the field. Keep the existing PCP / risk / cert / path fields. The `create` method becomes:

```python
    @api.model_create_multi
    def create(self, vals_list):
        partners = super().create(vals_list)
        events = []
        for partner in partners.filtered(lambda record: record.supplier_rank > 0):
            folder_name = re.sub(r"\W+", "_", partner.name).strip("_")
            events.append(
                {
                    "event_type": "supplier_folder_requested",
                    "partner_id": partner.id,
                    "requested_path": f"/Suppliers/{folder_name}/Certificates/",
                }
            )
        for partner in partners.filtered(lambda record: record.customer_rank > 0):
            folder_name = re.sub(r"\W+", "_", partner.name).strip("_")
            events.append(
                {
                    "event_type": "buyer_folder_requested",
                    "partner_id": partner.id,
                    "requested_path": f"/Clients/{folder_name}/Onboarding/",
                }
            )
        if events:
            self.env["sattva.fabric.event"].sudo().create(events)
        return partners

    buyer_kyc_status = fields.Selection(
        [
            ("pending", "Pending KYC"),
            ("review", "KYC Review"),
            ("complete", "KYC Complete"),
            ("blocked", "KYC Blocked"),
        ],
        string="Buyer KYC Status",
        default="pending",
        tracking=True,
        help="Buyer onboarding completeness. Never used by purchase.order.button_confirm.",
    )

    nextcloud_client_folder_path = fields.Char(
        string="Nextcloud Client Vault Path",
        readonly=True,
        help="Path in Nextcloud for buyer onboarding docs. Separate from supplier nextcloud_folder_path.",
    )
```

Do not set `supplier_pcp_status` from KYC. Do not edit `purchase_order.py`.

- [ ] **Step 4: Re-run tests**

Same docker command as Step 2.

Expected: `Modules loaded.` Both new tests pass. Existing supplier folder test still passes. PCP gate still blocks pending suppliers.

- [ ] **Step 5: Commit**

```bash
git add addons/sattva_compliance
git commit -m "feat: add buyer KYC status separate from supplier PCP"
```

---

### Task 6: Buyer onboarding folder workflow

**Files:**
- Create: `n8n/workflows/wf.buyer.onboard.folder.json`

**Interfaces:**
- Consumes `sattva.fabric.event` rows with `event_type=buyer_folder_requested` and `state=queued`.
- Produces Nextcloud MKCOL for `requested_path`, calls `set_partner_path(..., "client")` which writes `res.partner.nextcloud_client_folder_path`, sets event `state=processed`.
- Must not copy files to Notion. Must not write `supplier_pcp_status` or `nextcloud_folder_path`.

- [ ] **Step 1: Add `wf.buyer.onboard.folder.json`**

```json
{
  "name": "wf.buyer.onboard.folder",
  "nodes": [
    {
      "id": "poll-buyer-events",
      "name": "Poll queued buyer folder events",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [0, 0],
      "parameters": { "rule": { "interval": [{ "field": "minutes", "minutesInterval": 5 }] } }
    },
    {
      "id": "search-buyer-events",
      "name": "Search queued buyer events",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [220, 0],
      "parameters": {
        "method": "POST",
        "url": "={{$env.ODOO_JSON2_URL}}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":{\"service\":\"object\",\"method\":\"execute_kw\",\"args\":[\"sattva\",\"{{$env.ODOO_N8N_UID}}\",\"{{$credentials.odooN8nFabric.apiKey}}\",\"sattva.fabric.event\",\"search_read\",[[\"event_type\",\"=\",\"buyer_folder_requested\"],[\"state\",\"=\",\"queued\"]],{\"fields\":[\"id\",\"partner_id\",\"requested_path\"]}]}}"
      }
    },
    {
      "id": "mkcol-buyer-vault",
      "name": "MKCOL Nextcloud buyer path",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [440, 0],
      "parameters": {
        "method": "MKCOL",
        "url": "={{$env.NEXTCLOUD_WEBDAV_BASE}}{{$json.requested_path}}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpBasicAuth"
      }
    },
    {
      "id": "write-buyer-partner-path",
      "name": "Write buyer nextcloud_client_folder_path",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [660, 0],
      "parameters": {
        "method": "POST",
        "url": "={{$env.ODOO_JSON2_URL}}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":{\"service\":\"object\",\"method\":\"execute_kw\",\"args\":[\"sattva\",\"{{$env.ODOO_N8N_UID}}\",\"{{$credentials.odooN8nFabric.apiKey}}\",\"sattva.fabric.vault\",\"set_partner_path\",[{{$json.partner_id}},\"{{$json.requested_path}}\",\"client\"]]}}"
      }
    },
    {
      "id": "mark-buyer-event-processed",
      "name": "Mark buyer event processed",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [880, 0],
      "parameters": {
        "method": "POST",
        "url": "={{$env.ODOO_JSON2_URL}}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":{\"service\":\"object\",\"method\":\"execute_kw\",\"args\":[\"sattva\",\"{{$env.ODOO_N8N_UID}}\",\"{{$credentials.odooN8nFabric.apiKey}}\",\"sattva.fabric.event\",\"write\",[[{{$json.id}}],{\"state\":\"processed\"}]]}}"
      }
    }
  ],
  "connections": {
    "Poll queued buyer folder events": {
      "main": [[{ "node": "Search queued buyer events", "type": "main", "index": 0 }]]
    },
    "Search queued buyer events": {
      "main": [[{ "node": "MKCOL Nextcloud buyer path", "type": "main", "index": 0 }]]
    },
    "MKCOL Nextcloud buyer path": {
      "main": [[{ "node": "Write buyer nextcloud_client_folder_path", "type": "main", "index": 0 }]]
    },
    "Write buyer nextcloud_client_folder_path": {
      "main": [[{ "node": "Mark buyer event processed", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "saveDataSuccessExecution": "none",
    "saveDataErrorExecution": "none",
    "executionTimeout": 60
  }
}
```

- [ ] **Step 2: Validate**

```bash
node n8n/workflows/validate-workflows.mjs n8n/workflows/wf.buyer.onboard.folder.json
```

Expected: `workflow validation passed`.

- [ ] **Step 3: Commit**

```bash
git add n8n/workflows/wf.buyer.onboard.folder.json
git commit -m "feat: add buyer onboarding folder n8n workflow"
```

---

### Task 7: GREEN lead score

Do not start this task until Task 2 healthcheck prints success and Task 4 `validate-workflows.mjs` prints `workflow validation passed`.

**Files:**
- Create: `n8n/workflows/leadscore.mjs`
- Create: `n8n/workflows/leadscore.test.mjs`
- Create: `n8n/workflows/wf.lead.score.json`
- Modify: `addons/sattva_compliance/models/__init__.py`
- Create: `addons/sattva_compliance/models/crm_lead.py`
- Create: `addons/sattva_compliance/tests/test_lead_green_score.py`
- Modify: `addons/sattva_compliance/tests/__init__.py`

**Interfaces:**
- `scoreLead(features: { hashed_partner_id: string, stage_rank: number, days_in_stage: number, product_family_code: string, order_count: number }): { score: number, qualified: boolean }`
- `assertGreenPayload(payload: object): void` throws if any key is outside the allowlist or a required key is missing.
- Odoo field `crm.lead.sattva_green_score` (Float, readonly) and `sattva_lead_qualified` (Boolean, readonly). n8n writes these; BFF only reads them.
- Qualification threshold: `score >= 0.7`. On qualify, do **not** silently move stage in this task; Task 8 creates the activity.
- Hugging Face HTTP is **not** in this task.

- [ ] **Step 1: Write failing Node tests**

`n8n/workflows/leadscore.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { assertGreenPayload, scoreLead } from "./leadscore.mjs";

assert.throws(() => assertGreenPayload({ email: "a@b.c", stage_rank: 1 }));
assert.throws(() => assertGreenPayload({ hashed_partner_id: "x", notes: "call me" }));
const ok = {
  hashed_partner_id: "cafebabedeadbeef",
  stage_rank: 2,
  days_in_stage: 3,
  product_family_code: "ONION",
  order_count: 0,
};
assert.doesNotThrow(() => assertGreenPayload(ok));
const low = scoreLead({ ...ok, stage_rank: 0, days_in_stage: 0, order_count: 0 });
assert.equal(low.qualified, false);
const high = scoreLead({ ...ok, stage_rank: 3, days_in_stage: 1, order_count: 2 });
assert.equal(high.qualified, true);
assert.ok(high.score >= 0.7);
console.log("leadscore tests passed");
```

Run:

```bash
node n8n/workflows/leadscore.test.mjs
```

Expected: FAIL `ERR_MODULE_NOT_FOUND` for `./leadscore.mjs`.

- [ ] **Step 2: Implement `leadscore.mjs`**

```javascript
export const LEAD_SCORE_ALLOWLIST = [
  "hashed_partner_id",
  "stage_rank",
  "days_in_stage",
  "product_family_code",
  "order_count",
];

export function assertGreenPayload(payload) {
  if (payload == null || typeof payload !== "object") throw new Error("payload required");
  for (const key of Object.keys(payload)) {
    if (!LEAD_SCORE_ALLOWLIST.includes(key)) {
      throw new Error(`RED/AMBER key forbidden in lead score: ${key}`);
    }
  }
  for (const key of LEAD_SCORE_ALLOWLIST) {
    if (!(key in payload)) throw new Error(`missing ${key}`);
  }
}

export function scoreLead(features) {
  assertGreenPayload(features);
  const stage = Number(features.stage_rank) || 0;
  const recency = Math.max(0, 10 - (Number(features.days_in_stage) || 0)) / 10;
  const orders = Math.min(Number(features.order_count) || 0, 3) / 3;
  const score = Math.min(1, (stage / 3) * 0.5 + recency * 0.3 + orders * 0.2);
  return { score: Math.round(score * 100) / 100, qualified: score >= 0.7 };
}
```

Re-run Step 1 tests. Expected: `leadscore tests passed`.

- [ ] **Step 3: Odoo field + test**

`addons/sattva_compliance/models/crm_lead.py`:

```python
from odoo import fields, models


class CrmLead(models.Model):
    _inherit = "crm.lead"

    sattva_green_score = fields.Float(string="GREEN Lead Score", readonly=True)
    sattva_lead_qualified = fields.Boolean(string="Pitch Qualified", readonly=True)
```

`models/__init__.py`:

```python
from . import fabric_event
from . import res_partner
from . import purchase_order
from . import crm_lead
```

`addons/sattva_compliance/tests/test_lead_green_score.py`:

```python
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestLeadGreenScore(TransactionCase):
    def test_green_score_fields_require_no_pii(self):
        lead = self.env["crm.lead"].create({"name": "SYNTHETIC-LEAD"})
        lead.write({"sattva_green_score": 0.81, "sattva_lead_qualified": True})
        self.assertEqual(lead.sattva_green_score, 0.81)
        self.assertTrue(lead.sattva_lead_qualified)
        self.assertFalse(lead.description)
```

Import from `tests/__init__.py`:

```python
from . import test_supplier_folder_request
from . import test_vault_path
from . import test_buyer_kyc
from . import test_lead_green_score
```

Run the same Odoo `-u sattva_compliance --test-enable` command as Task 5. Expected: `test_green_score_fields_require_no_pii` passes.

- [ ] **Step 4: `wf.lead.score.json`**

n8n Code nodes cannot import repo files. Paste the two functions into `jsCode` and keep them in sync with `leadscore.mjs` (first line of the Code node is the comment below). Output `{ score, qualified, lead_id }`. Following HTTP node writes Odoo.

```json
{
  "name": "wf.lead.score",
  "nodes": [
    {
      "id": "lead-score-webhook",
      "name": "Lead score webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [0, 0],
      "webhookId": "wf-lead-score",
      "parameters": {
        "httpMethod": "POST",
        "path": "lead-score",
        "responseMode": "lastNode",
        "options": {}
      }
    },
    {
      "id": "score-green",
      "name": "Score GREEN allowlist",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [240, 0],
      "parameters": {
        "jsCode": "// keep in sync with n8n/workflows/leadscore.mjs\nconst LEAD_SCORE_ALLOWLIST = ['hashed_partner_id','stage_rank','days_in_stage','product_family_code','order_count'];\nfunction assertGreenPayload(payload) {\n  if (payload == null || typeof payload !== 'object') throw new Error('payload required');\n  for (const key of Object.keys(payload)) {\n    if (!LEAD_SCORE_ALLOWLIST.includes(key) && key !== 'lead_id') {\n      throw new Error('RED/AMBER key forbidden in lead score: ' + key);\n    }\n  }\n  for (const key of LEAD_SCORE_ALLOWLIST) {\n    if (!(key in payload)) throw new Error('missing ' + key);\n  }\n}\nfunction scoreLead(features) {\n  assertGreenPayload(features);\n  const stage = Number(features.stage_rank) || 0;\n  const recency = Math.max(0, 10 - (Number(features.days_in_stage) || 0)) / 10;\n  const orders = Math.min(Number(features.order_count) || 0, 3) / 3;\n  const score = Math.min(1, (stage / 3) * 0.5 + recency * 0.3 + orders * 0.2);\n  return { score: Math.round(score * 100) / 100, qualified: score >= 0.7 };\n}\nconst b = $input.first().json;\nconst scored = scoreLead(b);\nreturn [{ json: { score: scored.score, qualified: scored.qualified, lead_id: b.lead_id } }];"
      }
    },
    {
      "id": "write-lead-score",
      "name": "Write crm.lead GREEN score",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [480, 0],
      "parameters": {
        "method": "POST",
        "url": "={{$env.ODOO_JSON2_URL}}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":{\"service\":\"object\",\"method\":\"execute_kw\",\"args\":[\"sattva\",\"{{$env.ODOO_N8N_UID}}\",\"{{$credentials.odooN8nFabric.apiKey}}\",\"crm.lead\",\"write\",[[{{$json.lead_id}}],{\"sattva_green_score\":{{$json.score}},\"sattva_lead_qualified\":{{$json.qualified}}}]]}}"
      }
    }
  ],
  "connections": {
    "Lead score webhook": {
      "main": [[{ "node": "Score GREEN allowlist", "type": "main", "index": 0 }]]
    },
    "Score GREEN allowlist": {
      "main": [[{ "node": "Write crm.lead GREEN score", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "saveDataSuccessExecution": "none",
    "saveDataErrorExecution": "none",
    "executionTimeout": 30
  }
}
```

The Code node treats `lead_id` as a routing key, not a scoring feature (`assertGreenPayload` ignores it). `leadscore.mjs` used by unit tests must **not** accept `lead_id` — tests never pass it.

```bash
node n8n/workflows/validate-workflows.mjs n8n/workflows/wf.lead.score.json
```

Expected: `workflow validation passed`.

- [ ] **Step 5: Commit**

```bash
git add n8n/workflows/leadscore.mjs n8n/workflows/leadscore.test.mjs \
  n8n/workflows/wf.lead.score.json addons/sattva_compliance
git commit -m "feat: add GREEN lead score worker and Odoo fields"
```

---

### Task 8: Role notifications as Odoo activities

**Files:**
- Create: `addons/sattva_compliance/models/notify.py`
- Modify: `addons/sattva_compliance/models/__init__.py`
- Create: `addons/sattva_compliance/tests/test_notify_activity.py`
- Modify: `addons/sattva_compliance/tests/__init__.py`
- Create: `n8n/workflows/wf.notify.role.json`

**Interfaces:**
- `env["sattva.fabric.notify"].create_role_activity(lead_id: int, summary: str, role: str) -> mail.activity`
- Creates `mail.activity` on `crm.lead` with `summary` prefixed `SATTVA:` and `activity_type_id` = To Do.
- Allowed `role` values: `sales.exec`, `compliance.officer`, `finance.manager`, `logistics.exec`, `it.admin`.
- Mapping: qualified lead → activity for `sales.exec` (Odoo `sales_team.group_sale_salesman` until Keycloak groups exist). Do not write a portal inbox table.
- n8n calls this via JSON-2 `execute_kw` on `sattva.fabric.notify`. Integer `lead_id` (not a recordset) so XML-RPC/JSON-2 works.

- [ ] **Step 1: Failing Odoo test**

`addons/sattva_compliance/tests/test_notify_activity.py`:

```python
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestNotifyActivity(TransactionCase):
    def test_qualified_lead_creates_sales_activity(self):
        lead = self.env["crm.lead"].create({"name": "SYNTHETIC-LEAD-NOTIFY"})
        activity = self.env["sattva.fabric.notify"].create_role_activity(
            lead.id,
            "Lead qualified for pitch",
            "sales.exec",
        )
        self.assertTrue(activity.id)
        self.assertEqual(activity.res_model, "crm.lead")
        self.assertEqual(activity.res_id, lead.id)
        self.assertTrue(activity.summary.startswith("SATTVA:"))
```

Append to `tests/__init__.py`:

```python
from . import test_notify_activity
```

- [ ] **Step 2: Implement `sattva.fabric.notify`**

`addons/sattva_compliance/models/notify.py`:

```python
from odoo import api, models
from odoo.exceptions import UserError


class FabricNotify(models.AbstractModel):
    _name = "sattva.fabric.notify"
    _description = "Create Odoo activities for fabric role notifications"

    @api.model
    def create_role_activity(self, lead_id, summary, role):
        allowed = {
            "sales.exec",
            "compliance.officer",
            "finance.manager",
            "logistics.exec",
            "it.admin",
        }
        if role not in allowed:
            raise UserError("unknown notify role")
        lead = self.env["crm.lead"].browse(int(lead_id))
        if not lead.exists():
            raise UserError("lead not found")
        todo = self.env.ref("mail.mail_activity_data_todo")
        user = self.env.user
        if role == "sales.exec":
            sales = self.env.ref("sales_team.group_sale_salesman").users[:1]
            if sales:
                user = sales[0]
        return self.env["mail.activity"].sudo().create(
            {
                "activity_type_id": todo.id,
                "res_model_id": self.env["ir.model"]._get("crm.lead").id,
                "res_id": lead.id,
                "summary": f"SATTVA: {summary}",
                "user_id": user.id,
            }
        )
```

Append to `models/__init__.py`:

```python
from . import notify
```

Abstract models do not need `ir.model.access.csv` rows. `sudo()` is only inside this method; tests run as admin. Production should still execute as user `n8n.fabric`.

- [ ] **Step 3: `wf.notify.role.json`**

Webhook body `{ "lead_id": number, "summary": string, "role": "sales.exec" }`.

```json
{
  "name": "wf.notify.role",
  "nodes": [
    {
      "id": "notify-webhook",
      "name": "Notify role webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [0, 0],
      "webhookId": "wf-notify-role",
      "parameters": {
        "httpMethod": "POST",
        "path": "notify-role",
        "responseMode": "lastNode",
        "options": {}
      }
    },
    {
      "id": "create-role-activity",
      "name": "Create Odoo role activity",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [240, 0],
      "parameters": {
        "method": "POST",
        "url": "={{$env.ODOO_JSON2_URL}}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":{\"service\":\"object\",\"method\":\"execute_kw\",\"args\":[\"sattva\",\"{{$env.ODOO_N8N_UID}}\",\"{{$credentials.odooN8nFabric.apiKey}}\",\"sattva.fabric.notify\",\"create_role_activity\",[{{$json.lead_id}},\"{{$json.summary}}\",\"{{$json.role}}\"]]}}"
      }
    }
  ],
  "connections": {
    "Notify role webhook": {
      "main": [[{ "node": "Create Odoo role activity", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "saveDataSuccessExecution": "none",
    "saveDataErrorExecution": "none",
    "executionTimeout": 30
  }
}
```

```bash
node n8n/workflows/validate-workflows.mjs n8n/workflows/wf.notify.role.json
```

Expected: `workflow validation passed`.

- [ ] **Step 4: Run Odoo tests**

Same docker `-u sattva_compliance --test-enable` command as Task 5.

Expected: `test_qualified_lead_creates_sales_activity` passes.

- [ ] **Step 5: Commit**

```bash
git add addons/sattva_compliance n8n/workflows/wf.notify.role.json
git commit -m "feat: notify roles through Odoo mail activities"
```

---

### Task 9: BFF activities, catalogue, and logistics persona

**Files:**
- Modify: `middleware/src/lib/persona.ts`
- Modify: `middleware/src/lib/adapters/types.ts`
- Modify: `middleware/src/lib/adapters/mock.ts`
- Create: `middleware/src/app/api/activities/route.ts`
- Create: `middleware/src/app/api/catalogue/route.ts`
- Modify: `middleware/scripts/contract-check.mjs`

**Interfaces:**
- `Persona` adds `"logistics"`.
- `ActivityRow = { id: string; at: string; summary: string; dest: string; role: "sales.exec" | "compliance.officer" | "finance.manager" | "logistics.exec" | "it.admin" }`
- `CatalogueCard = { sku: string; crop: string; format: string; mesh_label: string; supplier_display: string }` — GREEN only. No price, no vault path, no `nextcloud`.
- `FabricAdapter.activities(persona: Persona): Promise<ActivityRow[]>`
- `FabricAdapter.catalogue(persona: Persona): Promise<CatalogueCard[]>`
- Dashboard `activity` remains a short list; `GET /api/activities` is the SoR-shaped list. Mock activities are `SATTVA:` prefixed.

There is no `switch` on `Persona` today. Add `"logistics"` to `ALL` and to `isEmployee` with an extra `|| p === "logistics"` (do not introduce a switch).

- [ ] **Step 1: Extend contract-check with failing HTTP cases**

Add after the existing HTTP block (same `try`, after the `unknown persona 400` assert):

```javascript
const act = await httpJson("/api/activities", { headers: { "x-sattva-persona": "sales" } });
assert("activities 200", act.res.status === 200, String(act.res.status));
const actHits = [];
walk(act.body, "$", actHits);
assert("activities GREEN", actHits.length === 0, actHits.join(","));
assert("activities are SATTVA prefixed", act.body.activities?.[0]?.summary?.startsWith("SATTVA:"));
const buyerAct = await httpJson("/api/activities", { headers: { "x-sattva-persona": "buyer" } });
assert("buyer activities empty", Array.isArray(buyerAct.body.activities) && buyerAct.body.activities.length === 0);

const cat = await httpJson("/api/catalogue", { headers: { "x-sattva-persona": "buyer" } });
assert("catalogue 200", cat.res.status === 200);
const catHits = [];
walk(cat.body, "$", catHits);
assert("catalogue GREEN", catHits.length === 0, catHits.join(","));
assert("catalogue has onion flake", cat.body.cards?.some((c) => c.crop === "onion" && c.format === "flake"));
assert("catalogue has no price key", cat.body.cards?.every((c) => c.price === undefined && c.list_price === undefined));

const logi = await httpJson("/api/dashboard", { headers: { "x-sattva-persona": "logistics" } });
assert("logistics persona 200", logi.res.status === 200, String(logi.res.status));
```

- [ ] **Step 2: Run contract-check (expect FAIL on missing routes)**

```bash
cd middleware && npm run build && npm run start &
sleep 3
npm test
```

Expected: FAIL `activities 200` and/or fetch errors for `/api/activities`.

- [ ] **Step 3: Implement types, mock data, routes**

`persona.ts` — add `"logistics"` to the union, to `ALL`, and:

```typescript
export function isEmployee(p: Persona): boolean {
  return (
    p === "sales" ||
    p === "compliance" ||
    p === "finance" ||
    p === "it" ||
    p === "logistics"
  );
}
```

In `types.ts` add (after `DocumentReceipt`):

```typescript
export type NotifyRole =
  | "sales.exec"
  | "compliance.officer"
  | "finance.manager"
  | "logistics.exec"
  | "it.admin";

export type ActivityRow = {
  id: string;
  at: string;
  summary: string;
  dest: string;
  role: NotifyRole;
};

export type CatalogueCard = {
  sku: string;
  crop: string;
  format: string;
  mesh_label: string;
  supplier_display: string;
};
```

Add to `FabricAdapter`:

```typescript
  activities(persona: Persona): Promise<ActivityRow[]>;
  catalogue(persona: Persona): Promise<CatalogueCard[]>;
```

In `mock.ts`, add constants and methods:

```typescript
const ACTIVITIES: ActivityRow[] = [
  {
    id: "a1",
    at: "14:02",
    summary: "SATTVA: Lead qualified for pitch",
    dest: "e1",
    role: "sales.exec",
  },
  {
    id: "a2",
    at: "14:10",
    summary: "SATTVA: Draft delivery pack ready",
    dest: "e6",
    role: "logistics.exec",
  },
];

const CATALOGUE: CatalogueCard[] = [
  { sku: "ONION-FLAKE-A", crop: "onion", format: "flake", mesh_label: "3-5 mm", supplier_display: "Approved mill (demo)" },
  { sku: "GARLIC-POWDER-B", crop: "garlic", format: "powder", mesh_label: "80-100 mesh", supplier_display: "Approved mill (demo)" },
  { sku: "CHILLI-FLAKE-C", crop: "chilli", format: "flake", mesh_label: "3-5 mm", supplier_display: "Approved mill (demo)" },
];
```

```typescript
  async activities(persona: Persona): Promise<ActivityRow[]> {
    if (persona === "buyer" || persona === "supplier") return [];
    if (persona === "sales") return ACTIVITIES.filter((row) => row.role === "sales.exec");
    if (persona === "logistics") return ACTIVITIES.filter((row) => row.role === "logistics.exec");
    if (persona === "compliance") return ACTIVITIES.filter((row) => row.role === "compliance.officer");
    if (persona === "finance") return ACTIVITIES.filter((row) => row.role === "finance.manager");
    if (persona === "it") return ACTIVITIES.filter((row) => row.role === "it.admin");
    return [];
  },

  async catalogue(_persona: Persona): Promise<CatalogueCard[]> {
    return CATALOGUE;
  },
```

`middleware/src/app/api/activities/route.ts`:

```typescript
import { getAdapter } from "@/lib/adapters";
import { greenJson, readPersona } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  const activities = await getAdapter().activities(auth.persona);
  return greenJson({ activities });
}
```

`middleware/src/app/api/catalogue/route.ts`:

```typescript
import { getAdapter } from "@/lib/adapters";
import { greenJson, readPersona } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  const cards = await getAdapter().catalogue(auth.persona);
  return greenJson({ cards });
}
```

- [ ] **Step 4: Re-run `npm test` with server up**

Expected: `contract-check passed`.

- [ ] **Step 5: Commit**

```bash
git add middleware
git commit -m "feat: expose Odoo activities and GREEN catalogue on BFF"
```

---

### Task 10: Metadata upload mint and local origin byte sink

**Files:**
- Modify: `middleware/.env.example` — delete `NEXTCLOUD_WEBDAV_*` lines.
- Modify: `middleware/README.md` — live adapters are JSON-2 + n8n webhooks only; no BFF WebDAV.
- Modify: `middleware/src/lib/adapters/types.ts` — `DocumentReceipt` gains optional `upload_url?: string` (loopback origin when `UPLOAD_ORIGIN_PUBLIC_URL` is set; never a Vercel host).
- Modify: `middleware/src/lib/adapters/mock.ts`
- Modify: `middleware/src/app/api/documents/route.ts`
- Modify: `middleware/src/lib/adapters/index.ts` — stop treating Nextcloud as a BFF health dependency; delete `nextcloudStatusUrl`.
- Modify: `middleware/src/lib/fabric.ts` — **delete** `nextcloudConfigured()`.
- Modify: `middleware/src/app/api/health/route.ts` — `ok` does not require Nextcloud.
- Create: `deploy/local/upload-origin/server.mjs`
- Modify: `docker-compose.yml` — `upload-origin` service on `127.0.0.1:8091:8091`
- Modify: `deploy/local/compose-healthcheck.sh`
- Modify: `middleware/scripts/contract-check.mjs`
- Modify: `deploy/gcp/secret-names.md`

**Interfaces:**
- `POST /api/documents` JSON `{ filename, sha256 }` only. Response `{ sha256, filename }` and, **only when** `UPLOAD_ORIGIN_PUBLIC_URL` is set (local Compose), `upload_url` = `${UPLOAD_ORIGIN_PUBLIC_URL}/u/<token>`. Token is random; not a vault path. Production mock **omits** `upload_url` (metadata-only until production `upload.` exists).
- Personas: **buyer and supplier** may mint (onboarding pack + supplier pack). Employees still upload via vault + Access, not this BFF.
- Origin server is **local T0 test-only**. It is not Nextcloud and not production `upload.`. Live `DocumentReceipt.upload_url` must never point at `/tmp` or `vercel`. Production remains deferred origin Caddy → n8n → Nextcloud.
- Origin server: `POST` only, `Content-Length` ≤ 104857600, no `GET` listing. On POST, write bytes to `/tmp/sattva-upload-origin/` (ephemeral local sink) and return `204`. Reject `GET` with `405`.
- Inside Compose, listen on `0.0.0.0` **in the container** so published ports work; the **host** bind stays `127.0.0.1:8091`. On a raw host run, listen on `127.0.0.1`.
- BFF health `ok` = Odoo + n8n healthy in live mode; Nextcloud is **not** a BFF dependency (D10).

- [ ] **Step 1: Failing contract assertions**

After the existing `upload has no path` assert, add:

```javascript
assert("upload has no path", goodDoc.body.path === undefined);
const minted = goodDoc.body.upload_url;
assert(
  "upload_url omitted or origin",
  minted === undefined ||
    (/8091|upload\.trilokventures\.org/.test(minted) &&
      !minted.includes("vercel") &&
      !minted.includes("app.trilokventures.org")),
);
assert("health has no nextcloud key", health.body.fabric?.nextcloud === undefined);

const buyerDoc = await httpJson("/api/documents", {
  method: "POST",
  headers: { "x-sattva-persona": "buyer", "content-type": "application/json" },
  body: JSON.stringify({
    filename: "kyc.pdf",
    sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  }),
});
assert("buyer may mint metadata receipt", buyerDoc.res.status === 200);

if (process.env.UPLOAD_ORIGIN_PUBLIC_URL) {
  assert("local origin mint present", typeof goodDoc.body.upload_url === "string");
  assert("local origin mint host", goodDoc.body.upload_url.startsWith(process.env.UPLOAD_ORIGIN_PUBLIC_URL));
}
```

- [ ] **Step 2: Implement mint + origin server**

`deploy/local/upload-origin/server.mjs`:

```javascript
import http from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.UPLOAD_ORIGIN_PORT || 8091);
const HOST = process.env.UPLOAD_ORIGIN_HOST || "127.0.0.1";
const MAX = 100 * 1024 * 1024;

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end();
    return;
  }
  const len = Number(req.headers["content-length"] || 0);
  if (len > MAX) {
    res.writeHead(413);
    res.end();
    return;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX) {
      res.writeHead(413);
      res.end();
      return;
    }
    chunks.push(chunk);
  }
  await mkdir("/tmp/sattva-upload-origin", { recursive: true });
  await writeFile(`/tmp/sattva-upload-origin/${randomUUID()}`, Buffer.concat(chunks));
  res.writeHead(204);
  res.end();
});

server.listen(PORT, HOST, () => {
  console.log(`upload-origin listening ${HOST}:${PORT} (test-only T0 sink, not Nextcloud)`);
});
```

Append to `docker-compose.yml`:

```yaml
  upload-origin:
    # Local T0 test sink only. Not Nextcloud. Not production upload.trilokventures.org.
    image: node:22-alpine
    container_name: sattva-upload-origin
    working_dir: /app
    command: ["node", "server.mjs"]
    volumes:
      - ./deploy/local/upload-origin:/app:ro
    ports:
      - "127.0.0.1:8091:8091"
    environment:
      - UPLOAD_ORIGIN_PORT=8091
      - UPLOAD_ORIGIN_HOST=0.0.0.0
    restart: always
    networks:
      - sattva_cloud_net
```

In `compose-healthcheck.sh`, after the n8n-worker block, add:

```python
origin = services.get("upload-origin")
if origin is None:
    errors.append("missing service: upload-origin")
else:
    ports = origin.get("ports") or []
    if not ports:
        errors.append("upload-origin has no loopback port binding")
    for port in ports:
        if port.get("host_ip") != "127.0.0.1":
            errors.append("upload-origin must bind 127.0.0.1")
```

`DocumentReceipt`:

```typescript
export type DocumentReceipt = { sha256: string; filename: string; upload_url?: string };
```

Mock `storeDocument`:

```typescript
    const origin = process.env.UPLOAD_ORIGIN_PUBLIC_URL;
    return {
      sha256,
      filename,
      ...(origin ? { upload_url: `${origin.replace(/\/$/, "")}/u/mock-token` } : {}),
    };
```

Delete these three commented lines from `middleware/.env.example`:

```
# NEXTCLOUD_WEBDAV_URL=https://vault.trilokventures.org/remote.php/dav/files/middleware
# NEXTCLOUD_USERNAME=middleware
# NEXTCLOUD_APP_PASSWORD=
```

Replace the Status paragraph in `middleware/README.md`:

```markdown
Phase 2 BFF contract is implemented in **mock mode** (`FABRIC_MODE=mock`).
Live adapters are Odoo JSON-2 (`svc.portal.odoo`) and n8n webhooks
(`svc.portal.n8n`) only. The BFF never speaks WebDAV. File bytes go to
origin `upload.` (production) or `127.0.0.1:8091` (local T0 test sink).
Do not treat mock KPIs as production SoR.
```

Also add `logistics` to the mock persona list in that README.

`documents/route.ts` — allow buyer **or** supplier; change the vault-path error copy so it does not mention Nextcloud:

```typescript
  if (auth.persona !== "supplier" && auth.persona !== "buyer") {
    return forbid("Only buyer and supplier personas may mint an origin upload URL.");
  }
```

```typescript
  if (body.path) {
    return greenJson(
      { error: "storage_path_not_accepted", message: "Client must not send a storage path." },
      400,
    );
  }
```

`fabricHealth` in `adapters/index.ts` — drop Nextcloud:

```typescript
export async function fabricHealth(): Promise<{
  mode: "mock" | "live";
  odoo: Reach;
  n8n: Reach;
}> {
  const mode = fabricMode();
  if (mode === "mock") {
    return { mode, odoo: "mock", n8n: "mock" };
  }
  return {
    mode,
    odoo: await reach(odooConfigured(), odooHealthUrl()),
    n8n: await reach(n8nConfigured(), n8nHealthUrl()),
  };
}
```

Delete `nextcloudStatusUrl` and the `nextcloudConfigured` import from `adapters/index.ts`. **Delete** `nextcloudConfigured()` from `fabric.ts`. Change the JSON-2 comment in `getAdapter()` to: `// JSON-2 live adapter attaches after Phase 1 Compose + GCP secrets. No WebDAV from this BFF.`

`health/route.ts`:

```typescript
    ok: isHealthy(fabric.odoo) && isHealthy(fabric.n8n),
```

In `secret-names.md` **delete** the rows for `nextcloud-middleware-app-password` and the Vercel env names `NEXTCLOUD_WEBDAV_URL`, `NEXTCLOUD_USERNAME`, `NEXTCLOUD_APP_PASSWORD`. Add:

| `upload-origin-hmac` | origin Caddy / local upload-origin | Minted POST tokens; not for Vercel |

Keep `nextcloud-n8n-app-password` for `svc.n8n.vault`. Vercel env names become: `FABRIC_MODE`, `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`, `N8N_BASE_URL`. Still never `NEXT_PUBLIC_`.

- [ ] **Step 3: Prove origin rejects GET and BFF never sees bytes**

```bash
UPLOAD_ORIGIN_HOST=127.0.0.1 node deploy/local/upload-origin/server.mjs &
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8091/
# expect 405
printf 'fake-pdf' | curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8091/u/mock-token --data-binary @-
# expect 204
./deploy/local/compose-healthcheck.sh .env
```

BFF `POST /api/documents` body must remain JSON metadata. Do not add a multipart handler on Next.js routes.

- [ ] **Step 4: `npm test` + compose config quiet**

```bash
cd middleware && npm test
docker compose --env-file .env config --quiet
```

Expected: `contract-check passed`; compose config exit 0.

- [ ] **Step 5: Commit**

```bash
git add middleware deploy/local/upload-origin deploy/gcp/secret-names.md docker-compose.yml deploy/local/compose-healthcheck.sh
git commit -m "feat: mint origin upload URLs and drop BFF WebDAV"
```

---

### Task 11: Order handoff must not confirm POs

**Files:**
- Create: `addons/sattva_compliance/models/order_handoff.py`
- Modify: `addons/sattva_compliance/models/__init__.py`
- Create: `addons/sattva_compliance/tests/test_order_handoff.py`
- Modify: `addons/sattva_compliance/tests/__init__.py`
- Create: `n8n/workflows/wf.order.handoff.json`

**Interfaces:**
- `env["sattva.fabric.handoff"].create_po_intent(supplier_id: int, line_vals: list[dict]) -> purchase.order`
- `line_vals` items are `{ "product_id": int, "product_qty": float, "price_unit": float }`.
- Creates a **draft** `purchase.order` and **never** calls `button_confirm`. There is **no** `confirm_po_intent` helper. Tests that need the gate call `po.button_confirm()` directly.
- n8n must call only `create_po_intent`.

- [ ] **Step 1: Failing test**

`addons/sattva_compliance/tests/test_order_handoff.py`:

```python
from odoo.exceptions import UserError
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestOrderHandoff(TransactionCase):
    def test_handoff_creates_draft_and_does_not_confirm_pending_supplier(self):
        supplier = self.env["res.partner"].create(
            {"name": "Synthetic Handoff Mill", "supplier_rank": 1}
        )
        product = self.env["product.product"].create({"name": "SYNTHETIC-GARLIC"})
        po = self.env["sattva.fabric.handoff"].create_po_intent(
            supplier.id,
            [{"product_id": product.id, "product_qty": 1, "price_unit": 1.0}],
        )
        self.assertEqual(po.state, "draft")
        with self.assertRaises(UserError) as err:
            po.button_confirm()
        self.assertIn("Compliance Gate Blocked", str(err.exception))
```

Append to `tests/__init__.py`:

```python
from . import test_order_handoff
```

- [ ] **Step 2: Implement abstract model `sattva.fabric.handoff`**

`addons/sattva_compliance/models/order_handoff.py`:

```python
from odoo import api, models


class FabricHandoff(models.AbstractModel):
    _name = "sattva.fabric.handoff"
    _description = "Create draft purchase intents without confirming the PCP gate"

    @api.model
    def create_po_intent(self, supplier_id, line_vals):
        return self.env["purchase.order"].create(
            {
                "partner_id": int(supplier_id),
                "order_line": [
                    (
                        0,
                        0,
                        {
                            "product_id": line["product_id"],
                            "product_qty": line["product_qty"],
                            "price_unit": line["price_unit"],
                        },
                    )
                    for line in line_vals
                ],
            }
        )
```

Append `from . import order_handoff` in `models/__init__.py`.

Do not call `button_confirm` anywhere in this module. Tests call it.

- [ ] **Step 3: Workflow JSON**

```json
{
  "name": "wf.order.handoff",
  "nodes": [
    {
      "id": "handoff-webhook",
      "name": "Never call button_confirm",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [0, 0],
      "webhookId": "wf-order-handoff",
      "parameters": {
        "httpMethod": "POST",
        "path": "order-handoff",
        "responseMode": "lastNode",
        "options": {}
      }
    },
    {
      "id": "create-po-intent",
      "name": "Create draft PO intent",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [240, 0],
      "parameters": {
        "method": "POST",
        "url": "={{$env.ODOO_JSON2_URL}}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":{\"service\":\"object\",\"method\":\"execute_kw\",\"args\":[\"sattva\",\"{{$env.ODOO_N8N_UID}}\",\"{{$credentials.odooN8nFabric.apiKey}}\",\"sattva.fabric.handoff\",\"create_po_intent\",[{{$json.supplier_id}},{{JSON.stringify($json.line_vals)}}]]}}"
      }
    }
  ],
  "connections": {
    "Never call button_confirm": {
      "main": [[{ "node": "Create draft PO intent", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "saveDataSuccessExecution": "none",
    "saveDataErrorExecution": "none",
    "executionTimeout": 30
  }
}
```

Webhook body `{ "supplier_id": number, "line_vals": [{ "product_id": number, "product_qty": number, "price_unit": number }] }`.

```bash
node n8n/workflows/validate-workflows.mjs n8n/workflows/wf.order.handoff.json
rg "button_confirm" addons/sattva_compliance
```

Expected: workflow validation passed; `button_confirm` matches only `purchase_order.py` (the gate) and tests (`test_buyer_kyc.py`, `test_order_handoff.py`).

- [ ] **Step 4: Run Odoo tests**

Expected: handoff test passes; pending supplier still blocked.

- [ ] **Step 5: Commit**

```bash
git add addons/sattva_compliance n8n/workflows/wf.order.handoff.json
git commit -m "feat: create PO intents without confirming the PCP gate"
```

---

### Task 12: CI for workflows and T2 absence gate

**Files:**
- Create: `.github/workflows/n8n-workflows.yml`
- Create: `n8n/workflows/assert-no-mtls.mjs`

**Interfaces:**
- PR job runs `validate-register.mjs`, `leadscore.test.mjs`, `validate-workflows.mjs` on all `n8n/workflows/wf.*.json`, and `assert-no-mtls.mjs`.
- `assert-no-mtls.mjs` fails if **implementation** trees add files matching `cas`, `mtls`, `privateca`, `istio`, `linkerd`, or Caddy/YAML/TF containing `client_auth` / `PrivateCA` / Cloud Service Mesh. Docs under `docs/` and this plan/spec are out of scope for the walk (they may mention mTLS as deferred).
- Do not fold this job into `bff-contract.yml`. Keep both workflows. `paths` must include `deploy/**`.

- [ ] **Step 1: Write `assert-no-mtls.mjs`**

```javascript
#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN_NAME = /(^|[._-])(mtls|privateca|istio|linkerd)([._-]|$)|(^|[/._-])cas([._-]|$)/i;
const FORBIDDEN_TEXT = /client_auth|PrivateCA|cloud\.google\.com\/service-mesh/i;
const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SCAN_DIRS = ["deploy", "middleware", "n8n", "addons", ".github"];
const SCAN_FILES = ["docker-compose.yml", "Caddyfile"];

function walk(dir, hits) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, hits);
    else inspect(p, name, hits);
  }
}

function inspect(p, name, hits) {
  if (FORBIDDEN_NAME.test(name)) hits.push(`filename ${p}`);
  if (
    p.endsWith(".md") ||
    p.endsWith(".yml") ||
    p.endsWith(".yaml") ||
    p.endsWith(".tf") ||
    p.endsWith("Caddyfile") ||
    p.endsWith(".mjs")
  ) {
    const text = readFileSync(p, "utf8");
    if (FORBIDDEN_TEXT.test(text) && !p.endsWith("assert-no-mtls.mjs")) {
      hits.push(`content ${p}`);
    }
  }
}

const hits = [];
for (const dir of SCAN_DIRS) walk(join(ROOT, dir), hits);
for (const file of SCAN_FILES) {
  try {
    inspect(join(ROOT, file), file, hits);
  } catch {
    // Caddyfile is optional until a later plan
  }
}
if (hits.length) {
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log("no T2 mTLS implementation files in this change set policy path");
```

Exempting `docs/` means the design spec and this plan may mention mTLS. Fail on new Terraform/Caddy implementation files under `deploy/`.

- [ ] **Step 2: Workflow YAML**

```yaml
name: n8n-workflows
on:
  pull_request:
    paths:
      - n8n/**
      - docker-compose.yml
      - addons/sattva_compliance/**
      - middleware/**
      - deploy/**
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: node n8n/workflows/validate-register.mjs
      - run: node n8n/workflows/leadscore.test.mjs
      - name: Validate workflow JSON
        run: |
          shopt -s nullglob
          files=(n8n/workflows/wf.*.json)
          if [ ${#files[@]} -eq 0 ]; then
            echo "no wf.*.json files" >&2
            exit 1
          fi
          node n8n/workflows/validate-workflows.mjs "${files[@]}"
      - run: node n8n/workflows/assert-no-mtls.mjs
```

- [ ] **Step 3: Run locally**

```bash
node n8n/workflows/validate-register.mjs
node n8n/workflows/leadscore.test.mjs
node n8n/workflows/validate-workflows.mjs n8n/workflows/wf.*.json
node n8n/workflows/assert-no-mtls.mjs
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/n8n-workflows.yml')); print('workflow YAML valid')"
```

Expected: all print success / `workflow YAML valid`.

If `assert-no-mtls.mjs` fails on `n8n/workflows/assert-no-mtls.mjs` itself, the `endswith` skip above already excludes it. If it fails on another `n8n/**/*.mjs` that quotes the forbidden tokens in a string used for scanning, keep the skip list to that scanner file only.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/n8n-workflows.yml n8n/workflows/assert-no-mtls.mjs
git commit -m "ci: validate n8n workflows and block premature mTLS"
```

---

## Out of this plan

Do not implement: production `upload.trilokventures.org` Caddy vhost, Cloudflare Access policies, Keycloak realm import, AssetCo CAS, Caddy `client_auth`, GKE Autopilot, Cloud Armor, IAP, WORM GCS, Hugging Face live OCR (leadscore uses local `leadscore.mjs` until a later GREEN HF wiring plan), sale.order Incoterm master data, 3PL APIs, WhatsApp, HubSpot, buyer collector UI, `wf.delivery.draft`, `wf.feedback`.

Those wait for Phase 3a/3b gates in spec §14–§15 and later Phase 2 UX work.

## Self-Review

1. **Spec coverage:** §3 register → Task 1; §3.2 n8n worker → Task 2; §10 `wf.supplier.folder`/`wf.coa.verify` → Task 4; D5 buyer KYC → Task 5–6; §7 `svc.leadscore.green` → Task 7 (local `leadscore.mjs`, not live HF); D9 activities → Task 8–9; D8 catalogue → Task 9; D10 upload off Vercel → Task 10; `wf.order.handoff` no confirm → Task 11; T2 parked → Task 12. Buyer collector UI, Incoterm capability list, and `wf.delivery.draft`/`wf.feedback` stay later Phase 2 UX work.
2. **Placeholder scan:** workflow HTTP nodes use env/credential **names**; staging must create those credentials. No CAS implementation tasks. No `confirm_po_intent`. Task 6 is a full JSON, not a “copy Task 4” instruction. Task 1 register is full JSON. Upload-origin listen address is specified for both host and Compose.
3. **Type consistency:** `buyer_kyc_status`, `nextcloud_client_folder_path`, `sattva_green_score`, `sattva_lead_qualified`, `set_partner_path(partner_id, requested_path, kind)`, `create_role_activity(lead_id, summary, role)`, `create_po_intent(supplier_id, line_vals)`, `ActivityRow`, `CatalogueCard`, optional `upload_url` are defined before BFF/n8n consumers. `NotifyRole` matches the Odoo allowed set. Dual-role partners use two Odoo path fields into one Nextcloud vault.
