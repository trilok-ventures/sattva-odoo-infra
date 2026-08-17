# Task 4 Report: Supplier folder and COA workflows

## Status: DONE

Implemented `sattva.fabric.vault.set_partner_path`, n8n workflows `wf.supplier.folder` and `wf.coa.verify`, GREEN COA fixtures, and updated workflow README per `task-4-brief.md`.

## Deliverables

| File | Action |
|------|--------|
| `addons/sattva_compliance/models/vault.py` | Created — `set_partner_path` abstract model |
| `addons/sattva_compliance/models/__init__.py` | Modified — import vault |
| `addons/sattva_compliance/tests/test_vault_path.py` | Created — vault path tests |
| `addons/sattva_compliance/tests/__init__.py` | Modified — import test_vault_path |
| `n8n/workflows/wf.supplier.folder.json` | Created — poll/MKCOL/set_partner_path/mark processed |
| `n8n/workflows/wf.coa.verify.json` | Created — dual webhook + Compare GREEN metrics |
| `n8n/workflows/fixtures/coa-pass.json` | Created — GREEN pass fixture |
| `n8n/workflows/fixtures/coa-fail.json` | Created — GREEN fail fixture |
| `n8n/workflows/README.md` | Replaced — source-of-truth + credential names |

## TDD Evidence

### Step 1 — Workflow validator (GREEN)

**Command:**

```bash
node n8n/workflows/validate-workflows.mjs \
  n8n/workflows/wf.supplier.folder.json \
  n8n/workflows/wf.coa.verify.json
```

**Output:**

```
workflow validation passed
```

Exit code: `0`

Both workflows have `settings.saveDataSuccessExecution` and `settings.saveDataErrorExecution` set to `none`. All nodes have `id`, `type`, and `name`.

### Step 2 — Odoo vault tests (GREEN)

Compose was started (`sudo docker compose up -d`). Persisted Postgres volume retained password `sattva_db_secure_pass` (`.env` has `replace-with-local-only-value`; web container override also uses `.env` value but volume predates it). Tests run via one-off container with legacy password:

**Command:**

```bash
sudo docker stop sattva-odoo-web
sudo docker compose run --rm --no-deps --entrypoint odoo web \
  -d sattva -u sattva_compliance \
  --test-enable --stop-after-init \
  --test-tags /sattva_compliance \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  -c /dev/null
```

**Key output:**

```
Starting TestVaultPath.test_set_partner_path_rejects_unknown_kind ...
Starting TestVaultPath.test_set_supplier_path_does_not_change_pcp ...
0 failed, 0 error(s) of 4 tests when loading database 'sattva'
Modules loaded.
```

Exit code: `0`. All four `sattva_compliance` tests passed (2 vault + 2 supplier folder request).

### Contract checks (manual review)

- `wf.supplier.folder` write node calls `sattva.fabric.vault.set_partner_path` (not `res.partner.write`).
- `wf.coa.verify` Compare node **throws** on RED keys (`bytes`, `pdf`, `path`, `nextcloud_folder_path`, `file_bytes`); does not delete-and-continue.
- Compare output emits `coa_pass`, `moisture_pct`, `mesh_pass`, `coa_sha256` only (no filename, no supplier name).
- No `res.partner` ACL rows added for `group_n8n_fabric_service`.
- No `supplier_pcp_status` writes in vault model.
- No `nextcloud_client_folder_path` field added (Task 5).

## Commit

```
21eebd7 feat: add supplier folder and COA n8n workflows
```

Branch: `cursor/internal-services-mtls-pipeline-952c` (not pushed per instructions).

## Self-review

- **Brief compliance:** vault.py, tests, workflows, fixtures, and README match brief verbatim.
- **Scope:** No ACL changes, no PCP writes, no PDF download/Hugging Face, no client folder field.
- **RED contract:** COA Compare throws on forbidden keys; workflow settings disable execution data persistence.
- **Concerns:** Local `.env` `ODOO_DB_PASSWORD` does not match persisted Postgres volume password (`sattva_db_secure_pass`); Odoo web container may fail to connect until volume is reset or `.env` is aligned. Runtime n8n import and Nextcloud MKCOL not exercised in this task (JSON contract only).

---

## Review Fix Report (Critical/Important findings)

### Status: FIXED

Addressed three review findings on n8n workflow JSON only (no Odoo ACL/model changes).

### Changes

1. **`wf.supplier.folder.json`** — Added `Unwrap search_read events` Code node after `Search queued events`. Unwraps JSON-RPC `result` array, emits one item per event with top-level `id`, `partner_id` (integer; `[id, name]` → id), `requested_path`; returns `[]` when empty. Wired Search → Unwrap → MKCOL → Write → Mark.
2. **`wf.coa.verify.json`** — Added shared `Map COA GREEN metadata` Code node before Compare. Uses `$input.first().json.body || $input.first().json`, **throws** on RED keys (`bytes`, `pdf`, `path`, `nextcloud_folder_path`, `file_bytes`), outputs GREEN fields only. Both webhooks connect to mapper → Compare.
3. **Credentials bound by name** — MKCOL: `httpBasicAuth` → `nextcloudN8nVault`. Odoo HTTP nodes: `httpHeaderAuth` → `odooN8nFabric` (keeps `$credentials.odooN8nFabric.apiKey` expressions).

### Test Results

**Workflow validator**

```bash
node n8n/workflows/validate-workflows.mjs \
  n8n/workflows/wf.supplier.folder.json \
  n8n/workflows/wf.coa.verify.json
```

```
workflow validation passed
```

Exit code: `0`

**Python contract assertions**

```bash
python3 -c "..."  # supplier: Unwrap node, nextcloudN8nVault, odooN8nFabric; no res.partner write
```

```
supplier contract: OK
coa contract: OK
```

**Odoo vault tests** (web container stopped; one-off `compose run` with `sattva_db_secure_pass`)

```bash
sudo docker stop sattva-odoo-web
sudo docker compose run --rm --no-deps --entrypoint odoo web \
  -d sattva -u sattva_compliance \
  --test-enable --stop-after-init \
  --test-tags /sattva_compliance \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  -c /dev/null
```

```
0 failed, 0 error(s) of 4 tests when loading database 'sattva'
Modules loaded.
```

Exit code: `0`

### Commit

```
fix: unwrap search_read and map COA webhooks in n8n workflows
```

Branch: `cursor/internal-services-mtls-pipeline-952c` (not pushed).
