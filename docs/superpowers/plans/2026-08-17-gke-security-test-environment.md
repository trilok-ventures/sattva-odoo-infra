# GKE Security-Test Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a GitHub-promoted, synthetic-data-only GKE Autopilot security-test environment for Odoo CE, Nextcloud, Keycloak, and n8n.

**Architecture:** Complete the locked Phase 1 local fabric before provisioning the GKE test environment. GitHub Actions validates reviewed sources and deploys immutable artifact digests through OIDC/WIF after `security-test` Environment approval. GKE workloads consume distinct Cloud SQL databases, AssetCo Secret Manager versions through Workload Identity, and a short-lifecycle non-WORM GCS test bucket.

**Tech Stack:** Docker Compose; Odoo 18; PostgreSQL 15; Nextcloud; n8n; Redis; Keycloak; GKE Autopilot; Cloud SQL; GCS; Secret Manager; Artifact Registry; Terraform; GitHub Actions; Cloudflare; Google Cloud Armor; IAP.

## Global Constraints

- Use `sattva-prod-ca` for runtime and `tv-assetco-secrets` for secret values.
- Use synthetic, format-valid fixtures only; no live operational, RED, or AMBER records.
- Odoo remains the operational SoR, Nextcloud remains the evidence vault, and n8n remains a stateless integration bus.
- Never commit secret values, service-account keys, file bytes, vault paths, database dumps, or n8n execution payloads.
- Keep `app.trilokventures.org` Keycloak-authenticated; keep `sattva`, `vault`, and `n8n` behind Cloudflare Access and IAP.
- Do not enable WORM retention, custom mTLS/private CA, public self-registration, or direct production-console edits.

---

## File Structure

- Modify: `docker-compose.yml` — local Odoo, Postgres, Nextcloud, n8n, and Redis fabric.
- Modify: `addons/sattva_compliance/` — Odoo vendor-folder request and PCP-gate test coverage.
- Create: `n8n/workflows/coa-intake.json` — reviewed COA metadata workflow export.
- Create: `deploy/gke/terraform/` — Canadian GKE, Cloud SQL, GCS, Artifact Registry, WIF, Workload Identity, Cloud Armor, IAP, and secret-access definitions.
- Create: `deploy/gke/kustomize/` — namespace, workloads, services, ingress, network policy, and external-secret references.
- Create: `deploy/keycloak/realm-trilok.json` — secret-stripped `trilok` realm export.
- Create: `.github/workflows/` checks and approved security-test promotion workflows.
- Modify: `middleware/` — live Keycloak session validation and synthetic integration tests.

### Task 1: Make the local Phase 1 fabric testable

**Files:**
- Modify: `docker-compose.yml`
- Create: `deploy/local/.env.example`
- Create: `deploy/local/compose-healthcheck.sh`

**Interfaces:**
- Produces local hostnames `odoo`, `nextcloud`, `n8n`, and `redis` on `sattva_cloud_net`.
- Consumes only git-ignored local environment values.

- [ ] **Step 1: Add the four local services with no committed credentials**

Define `nextcloud`, `n8n`, and `redis` services in `docker-compose.yml`; move the existing Postgres password to `${ODOO_DB_PASSWORD:?set ODOO_DB_PASSWORD}` and set `N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY:?set N8N_ENCRYPTION_KEY}`. Bind service ports to `127.0.0.1`, not all interfaces.

- [ ] **Step 2: Add a complete local environment template**

Create `deploy/local/.env.example`:

```dotenv
ODOO_DB_PASSWORD=replace-with-local-only-value
N8N_ENCRYPTION_KEY=replace-with-32-byte-local-only-value
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASSWORD=replace-with-local-only-value
```

- [ ] **Step 3: Validate Compose without starting a public service**

Run:

```bash
cp deploy/local/.env.example .env
docker compose --env-file .env config --quiet
```

Expected: exit code `0`; no container port is bound to `0.0.0.0`.

- [ ] **Step 4: Commit the independently testable local fabric**

```bash
git add docker-compose.yml deploy/local/.env.example deploy/local/compose-healthcheck.sh
git commit -m "feat: add local Sattva fabric services"
```

### Task 2: Implement and verify supplier-folder provisioning

**Files:**
- Modify: `addons/sattva_compliance/models/res_partner.py`
- Create: `addons/sattva_compliance/models/fabric_event.py`
- Create: `addons/sattva_compliance/tests/test_supplier_folder_request.py`

**Interfaces:**
- Produces a queued Odoo event with `partner_id` and `requested_path`.
- n8n consumes the event and writes the resulting `nextcloud_folder_path` to the partner.

- [ ] **Step 1: Write the failing Odoo test**

Create a test that creates a supplier named `Synthetic Spice Supplier`, asserts a folder request event for `/Suppliers/Synthetic_Spice_Supplier/Certificates/`, and asserts the partner remains `pending`.

- [ ] **Step 2: Run the failing test in the Odoo image**

```bash
sudo docker exec sattva-odoo-web odoo -d sattva -u sattva_compliance --test-enable --stop-after-init -c /dev/null
```

Expected: fail until `fabric_event` and partner-create behavior exist.

- [ ] **Step 3: Implement the smallest event model and partner hook**

Implement model `sattva.fabric.event` with fields `event_type`, `partner_id`, `requested_path`, and `state`. Override `res.partner.create()` to create a `supplier_folder_requested` event only when the created partner is a supplier.

- [ ] **Step 4: Verify both gate and event behavior**

Run the module update command above and the scripted PCP smoke test from `AGENTS.md`.

Expected: `pending`, `review`, and `blocked` confirmations raise the gate error; `approved` confirms; a supplier event is present.

- [ ] **Step 5: Commit**

```bash
git add addons/sattva_compliance
git commit -m "feat: request supplier vault folders through fabric events"
```

### Task 3: Add the reviewed n8n COA workflow and synthetic fixtures

**Files:**
- Create: `n8n/workflows/coa-intake.json`
- Create: `n8n/workflows/coa-intake.fixture.json`
- Create: `n8n/workflows/validate-workflows.mjs`

**Interfaces:**
- Consumes a Nextcloud upload event and Odoo synthetic specification metadata.
- Produces only pass/fail, GREEN metrics, hash, and Odoo update requests.

- [ ] **Step 1: Encode the workflow policy**

Export a workflow that reads a synthetic COA-format fixture, calculates a SHA-256 hash, compares moisture/mesh fixtures, and creates either a release update or CAPA activity. Set every RED-touching node to `saveDataSuccessExecution: "none"` and `saveDataErrorExecution: "none"`.

- [ ] **Step 2: Add static validation**

`validate-workflows.mjs` must reject a workflow unless each node has an `id`, `type`, and `name`, and reject any JSON string containing `saveDataSuccessExecution":"all"` or `saveDataErrorExecution":"all"`.

- [ ] **Step 3: Run workflow validation**

```bash
node n8n/workflows/validate-workflows.mjs n8n/workflows/coa-intake.json
```

Expected: `workflow validation passed`.

- [ ] **Step 4: Commit**

```bash
git add n8n/workflows
git commit -m "feat: add reviewed synthetic COA workflow"
```

### Task 4: Create GCP infrastructure definitions

**Files:**
- Create: `deploy/gke/terraform/main.tf`
- Create: `deploy/gke/terraform/variables.tf`
- Create: `deploy/gke/terraform/outputs.tf`
- Create: `deploy/gke/terraform/security-test.tfvars.example`

**Interfaces:**
- Produces GKE Autopilot, Artifact Registry, Cloud SQL, non-WORM test bucket, private service identities, and outputs for cluster endpoint, registry, and bucket names.

- [ ] **Step 1: Define safe Terraform inputs**

Use variables `project_id`, `region`, `cluster_name`, `assetco_project_id`, `test_bucket_name`, and `github_repository`. Default `project_id` to `sattva-prod-ca`, `assetco_project_id` to `tv-assetco-secrets`, and `region` to `northamerica-northeast1`. Do not define a secret-value variable.

- [ ] **Step 2: Implement foundational resources**

Create `google_container_cluster` with `enable_autopilot = true`, one regional `google_sql_database_instance`, one `google_artifact_registry_repository`, and one `google_storage_bucket` with a lifecycle delete rule and no retention policy block.

- [ ] **Step 3: Validate IaC**

```bash
terraform -chdir=deploy/gke/terraform init -backend=false
terraform -chdir=deploy/gke/terraform validate
terraform -chdir=deploy/gke/terraform plan -refresh=false -var-file=security-test.tfvars
```

Expected: validate exits `0`; plan contains no Secret Manager secret value.

- [ ] **Step 4: Commit**

```bash
git add deploy/gke/terraform
git commit -m "feat: define GKE security-test foundation"
```

### Task 5: Define GKE workloads and network boundaries

**Files:**
- Create: `deploy/gke/kustomize/base/`
- Create: `deploy/gke/kustomize/security-test/`
- Create: `deploy/keycloak/realm-trilok.json`

**Interfaces:**
- Produces one `sattva-security-test` namespace, one service account per workload, and no public service of type `LoadBalancer`.

- [ ] **Step 1: Create namespace, service accounts, and deny-by-default policy**

Define namespace `sattva-security-test`; create service accounts `odoo`, `nextcloud`, `n8n`, `keycloak`, and `middleware`; add a default-deny `NetworkPolicy` plus explicit internal service rules.

- [ ] **Step 2: Add workload manifests**

Add deployments/stateful workloads for the four services. Each must use a pinned image digest, a non-root security context, a distinct service account, Cloud SQL connection configuration, and secret references only by name.

- [ ] **Step 3: Add the secret-stripped realm**

Define realm `trilok`, roles `it.admin`, `sales.exec`, `compliance.officer`, `finance.manager`, `logistics.exec`, `buyer`, and `supplier`; define clients `middleware-portal`, `odoo`, `nextcloud`, and `n8n`; omit every client secret.

- [ ] **Step 4: Render and validate manifests**

```bash
kustomize build deploy/gke/kustomize/security-test | kubectl apply --dry-run=client -f -
```

Expected: exit code `0`; no `LoadBalancer` service or literal secret value appears.

- [ ] **Step 5: Commit**

```bash
git add deploy/gke/kustomize deploy/keycloak/realm-trilok.json
git commit -m "feat: add GKE security-test workloads"
```

### Task 6: Add GitHub verification and promotion workflows

**Files:**
- Create: `.github/workflows/secret-scan.yml`
- Create: `.github/workflows/odoo-addon.yml`
- Create: `.github/workflows/gke-validate.yml`
- Create: `.github/workflows/deploy-security-test.yml`

**Interfaces:**
- `deploy-security-test.yml` consumes an approved immutable image digest and deploys only through GitHub OIDC/WIF.

- [ ] **Step 1: Add required PR jobs**

Run gitleaks, Odoo module update, `node n8n/workflows/validate-workflows.mjs`, Keycloak JSON parsing, middleware contract tests, `terraform validate`, and `kustomize build` on pull requests.

- [ ] **Step 2: Add the protected deployment workflow**

Require:

```yaml
permissions:
  contents: read
  id-token: write
environment: security-test
```

Authenticate with `google-github-actions/auth` using `workload_identity_provider` and `service_account` stored as environment configuration values, then apply only a requested image digest from `main`.

- [ ] **Step 3: Verify workflow syntax and path coverage**

Run:

```bash
python3 -c "import yaml; [yaml.safe_load(open(p)) for p in __import__('glob').glob('.github/workflows/*.yml')]; print('workflow YAML valid')"
```

Expected: `workflow YAML valid`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows
git commit -m "ci: validate and promote GKE security test"
```

### Task 7: Implement live middleware identity and all-persona fixtures

**Files:**
- Modify: `middleware/src/lib/adapters/index.ts`
- Create: `middleware/src/lib/auth/keycloak.ts`
- Create: `middleware/scripts/security-test-fixtures.mjs`
- Modify: `middleware/scripts/contract-check.mjs`

**Interfaces:**
- `requirePersona(request: Request): Promise<Persona>` validates a Keycloak bearer token in live mode.
- `security-test-fixtures.mjs` creates only conspicuously synthetic fixture identifiers.

- [ ] **Step 1: Write failing authorization tests**

Add test cases asserting an absent or invalid Keycloak token gets `401`, buyer tokens cannot reach employee routes, and valid buyer tokens receive only assigned GREEN fields.

- [ ] **Step 2: Implement live-mode Keycloak verification**

Implement `requirePersona()` to fetch the realm JWKS, validate issuer/audience/expiry/signature, map the `groups` claim to the existing `Persona` union, and reject unknown groups.

- [ ] **Step 3: Create synthetic fixtures**

Generate names prefixed `SYNTHETIC-`, a pending supplier, synthetic COA-format content, assigned buyer lot status, and expected pass/fail outputs. Do not include real-looking account, certificate, or address values.

- [ ] **Step 4: Configure the separate BFF deployment**

Create or update the separate Vercel project `sattva-middleware` with Root Directory `middleware/` and domain `app.trilokventures.org`. Set only server-side `FABRIC_MODE`, `ODOO_URL`, `ODOO_API_KEY`, `N8N_BASE_URL`, `NEXTCLOUD_WEBDAV_URL`, `NEXTCLOUD_APP_PASSWORD`, Keycloak issuer, client ID, and session-secret references. Confirm the repository-root `sattva-odoo-infra` Vercel project remains mocks-only and that no fabric setting uses a `NEXT_PUBLIC_` name.

- [ ] **Step 5: Run contract and authorization tests**

```bash
cd middleware && npm ci && npm run build && npm test
```

Expected: build succeeds and every RED-key, authentication, and persona-scope assertion passes.

- [ ] **Step 6: Commit**

```bash
git add middleware
git commit -m "feat: add live security-test identity boundary"
```

### Task 8: Deploy, smoke test, and close the external test

**Files:**
- Create: `deploy/gke/scripts/smoke-security-test.sh`
- Create: `deploy/gke/scripts/revoke-test-access.sh`
- Create: `docs/superpowers/evidence/security-test-template.md`

**Interfaces:**
- `smoke-security-test.sh` exits nonzero on failed ingress, identity, PCP, redaction, or service-health checks.
- `revoke-test-access.sh` disables all test users by `SYNTHETIC-` username prefix.

- [ ] **Step 1: Write smoke assertions**

Test Cloudflare/TLS reachability, employee Access/IAP rejection, Keycloak discovery, Odoo PCP gate behavior, Nextcloud public-share disablement, n8n RED-log configuration, BFF GREEN-only output, and health of all four workloads.

- [ ] **Step 2: Deploy through the approved GitHub Environment**

Use `workflow_dispatch` on `deploy-security-test.yml`, select the immutable digest, and wait for `security-test` Environment approval. Do not run manual `kubectl apply` against the cluster.

- [ ] **Step 3: Run smoke checks**

```bash
./deploy/gke/scripts/smoke-security-test.sh
```

Expected: `security-test smoke passed`; evidence contains only digests, synthetic fixture IDs, policy outcomes, and health state.

- [ ] **Step 4: Run the all-persona test and revoke access**

Invite one synthetic user for each approved persona, execute the synthetic journeys in the design spec, then run:

```bash
./deploy/gke/scripts/revoke-test-access.sh
```

Expected: every test user is disabled and the test bucket lifecycle owns fixture deletion.

- [ ] **Step 5: Commit evidence template and scripts**

```bash
git add deploy/gke/scripts docs/superpowers/evidence/security-test-template.md
git commit -m "test: add security-test smoke and closure controls"
```

## Self-Review

- Spec coverage: Tasks 1–3 satisfy the required Phase 1 gate; Tasks 4–6 create the locked GKE deployment and GitHub promotion controls; Tasks 7–8 satisfy persona, synthetic-data, observability, rollback, and closure requirements.
- Placeholder scan: no unresolved implementation markers are permitted in this plan.
- Interface consistency: workload names, role names, project IDs, secret boundaries, namespace, and deployment Environment names are consistent with the approved design.
