# GKE Security-Test Environment — Sattva Backend

**Status:** Proposed design  
**Date:** 2026-08-17  
**Owners:** IPCo (code and deployment definitions), AssetCo (secrets), Sattva Brokers OpCo (test operations)  
**Companion specs:** `2026-08-13-sattva-brokers-system-fabric-design.md` (locked), `2026-08-14-integrated-system-architecture.md` (proposed)

## 1. Purpose and scope

Create a controlled, limited-external security-test environment for Odoo CE, Nextcloud, Keycloak, and n8n in GCP. The environment proves the backend, persona controls, GitHub promotion path, and compliance boundaries with synthetic, format-valid fixtures only.

This design adopts the locked-fabric deployment direction:

```text
Cloudflare → Google HTTPS Load Balancer → Cloud Armor → IAP → GKE Autopilot
```

The external middleware portal remains at `app.trilokventures.org`; its invited tester users authenticate through Keycloak. Employee administrative services remain gated by Cloudflare Access and IAP.

### Preconditions

This design does not skip the locked phase gates. Before any GKE security-test deployment:

1. Phase 1 local-fabric acceptance passes: the PCP gate, Nextcloud folder provisioning, n8n COA pass/fail fixtures, and RED-free n8n execution logs.
2. Phase 2 middleware acceptance passes: a buyer-facing BFF returns only GREEN data and never sends vault bytes, paths, or fabric credentials to a browser.

### In scope

- A GKE Autopilot security-test cluster in `sattva-prod-ca`.
- Odoo CE, Nextcloud, Keycloak, and n8n workloads.
- Regional Cloud SQL for PostgreSQL with separate databases and users for Odoo, Keycloak, and n8n.
- A non-WORM GCS bucket for synthetic Nextcloud fixtures, with a short lifecycle policy.
- GitHub Actions deployment promotion through GitHub OIDC and GCP Workload Identity Federation (WIF).
- Admin-created invitations for IT, staff, buyer, and supplier testers.
- Synthetic test journeys, deployment evidence, rollback, and access revocation.

### Out of scope

- Real customers, suppliers, prices, certificates, COAs, POs, or other operational data.
- Seven-year GCS WORM retention and production compliance-retention evidence.
- Custom service-to-service mTLS or a private certificate authority.
- Public self-registration.
- Git-managed runtime records, vault files, n8n execution data, or secret values.
- GKE features not required to operate or test this design.

## 2. Governing boundaries

| Domain | System of record or control | Security-test rule |
| --- | --- | --- |
| Operations, partners, PCP status, POs, lots | Odoo CE | Synthetic records only; the PCP gate is never bypassed. |
| Evidence files | Nextcloud | Synthetic, format-valid fixtures only; no public shares. |
| Workflow orchestration | n8n | Pass-through only; RED-touching node execution data is disabled. |
| Identity | Keycloak | One `trilok` realm; admin-created tester accounts only. |
| Deployment definitions | GitHub | Reviewed source of truth for code, Kubernetes definitions, realm export, and workflow JSON. |
| Runtime secrets | AssetCo Secret Manager (`tv-assetco-secrets`) | Values are unavailable to GitHub Actions and never committed. |
| External edge | Cloudflare | DNS/TLS edge and Access gate for employee services. |

The environment has no compliance-retention claim. A separate approved design is required before enabling WORM retention or introducing live operational data.

## 3. Architecture

### 3.1 Infrastructure

| Component | Design |
| --- | --- |
| GCP project | `sattva-prod-ca` |
| Compute | One regional GKE Autopilot cluster in a Canadian region. |
| Ingress | Cloudflare-proxied DNS to a Google HTTPS Load Balancer; Cloud Armor and IAP apply before traffic reaches GKE. |
| Databases | One regional Cloud SQL PostgreSQL instance with separate `odoo`, `keycloak`, and `n8n` databases, users, and credentials. |
| Test storage | A dedicated GCS bucket for synthetic fixtures with an explicit short lifecycle policy and no retention lock. |
| Secrets | AssetCo Secret Manager; workload identities access only their named secret versions. |
| Images | Artifact Registry image digests, never floating image tags. |

### 3.2 Workloads

| Workload | Role | State boundary |
| --- | --- | --- |
| Odoo CE | Operational test system of record; supplier PCP gate | Cloud SQL `odoo`; no production records. |
| Nextcloud | Synthetic evidence-vault test surface | GCS-backed synthetic fixture storage; public sharing disabled. |
| n8n | Integration bus | Cloud SQL `n8n`; no business state; no persisted RED execution payloads. |
| Keycloak | Identity provider and tester account lifecycle | Cloud SQL `keycloak`; realm export is secret-stripped and Git-controlled. |
| Middleware BFF | Persona-filtered external portal | Server-side calls only; no business state beyond the separately approved notification inbox. |

## 4. Identity, access, and service communication

### 4.1 Human access

- Keycloak realm: `trilok`.
- Test personas: `it.admin`, `sales.exec`, `compliance.officer`, `finance.manager`, `logistics.exec`, `buyer`, and `supplier`.
- An administrator creates every tester account and sends an invitation. There is no self-registration.
- `app.trilokventures.org` is reachable over public HTTPS but requires Keycloak authentication and persona-scoped BFF authorization.
- `sattva.trilokventures.org`, `vault.trilokventures.org`, and `n8n.trilokventures.org` require Cloudflare Access and IAP. Their browser access is limited to appropriate employee or IT roles.
- Nextcloud, n8n, Odoo administration, and database management are not direct external-tester surfaces.

### 4.2 Workload access

- Each Kubernetes workload uses a distinct GKE Workload Identity principal.
- The workload identity has access only to its required AssetCo secret IDs.
- `n8n.fabric` uses a least-privilege Odoo API user and a distinct scoped Nextcloud WebDAV app-password account.
- `middleware.bff` uses different least-privilege Odoo and Nextcloud accounts.
- Internal service traffic uses private cluster networking and HTTPS where supported. Custom mTLS/private CA remains deferred.
- Browsers never receive Odoo, n8n, Nextcloud, Cloud SQL, or Secret Manager credentials, vault paths, or file bytes.

## 5. GitHub promotion design

### 5.1 Source-controlled artifacts

Git stores:

- Kubernetes/Helm or Kustomize definitions for the cluster workloads and ingress.
- Odoo addon source and deployment configuration.
- Secret-stripped Keycloak realm export.
- Exported n8n workflow JSON.
- Synthetic fixture definitions and test harnesses.
- Deployment, backup, restore, and health-check scripts that reference secret names only.

Git does not store:

- Secret values, service-account keys, certificates, database dumps, vault files, Odoo records, or n8n execution payloads.

### 5.2 Promotion path

```text
Feature branch
  → pull request and required checks
  → protected main
  → immutable artifact digest and manifest SHA
  → manual deployment dispatch
  → GitHub security-test Environment approval
  → GitHub OIDC token and GCP WIF
  → GKE deployment
  → post-deploy smoke evidence
```

- GitHub Actions authenticates with OIDC via a WIF provider bound to `trilok-ventures/sattva-odoo-infra`, protected `main`, and the `security-test` Environment.
- The GitHub deploy identity can deploy reviewed artifacts but cannot read AssetCo Secret Manager values or runtime data.
- The GitHub `security-test` Environment requires named human approval before each deployment.
- Rollback deploys a previously approved immutable image digest and manifest SHA, never an unreviewed branch.

### 5.3 Required pull-request gates

1. Secret scanning across the repository.
2. Odoo syntax, module-update, and PCP-gate tests.
3. Middleware build and GREEN-response contract tests.
4. n8n workflow JSON validation and RED-log policy checks.
5. Keycloak realm validation, including absence of embedded client secrets.
6. Kubernetes manifest, image-digest, and policy validation.

## 6. Synthetic test journeys

All fixture values are conspicuously synthetic and use safe placeholder identities.

1. An administrator invites one user for each tester persona.
2. A supplier fixture starts in `pending`.
3. A synthetic certificate or COA-format fixture is stored in Nextcloud.
4. n8n provisions or updates the fixture folder pointer in Odoo and evaluates extracted test metadata.
5. A PO for the `pending` supplier is blocked. After compliance changes the synthetic supplier to `approved`, confirmation succeeds.
6. A buyer tester signs into the BFF and sees only their assigned GREEN-safe lot status.
7. Supplier, staff, compliance, finance, logistics, and IT testers receive only their permitted routes and fields.

## 7. Failure behavior and observability

| Condition | Required behavior |
| --- | --- |
| Missing or inaccessible secret | The affected workload fails closed; no fallback credential is used. |
| Unauthenticated or unauthorized user | Keycloak, Cloudflare Access, IAP, or BFF returns 401/403. |
| Upstream timeout | Retry only idempotent operations; no duplicate state or implicit approval. |
| COA parse failure or specification mismatch | Keep the synthetic lot quarantined and create a compliance activity. |
| RED payload aimed at the BFF | Block or strip it; the contract test fails. |
| Smoke-test failure after promotion | Mark the deployment failed and make a prior immutable release available for rollback. |

Evidence contains only artifact digests, manifest SHAs, sanitized fixture IDs, policy results, health state, authorization outcomes, and redaction assertions. Logs must not capture secrets, file bytes, vault paths, or execution payloads.

## 8. Acceptance gates

### Gate 1 — Platform and trust

- GKE Autopilot, Cloud SQL, Artifact Registry, GCS test bucket, HTTPS Load Balancer, Cloud Armor, IAP, WIF, and workload identities are provisioned from reviewed definitions.
- GitHub production-equivalent promotion is protected by the `security-test` Environment.
- AssetCo secrets exist by name, with least-privilege workload bindings; secret values are never printed in deployment output.

### Gate 2 — Backend deployment

- All four workloads are healthy and use their assigned state stores.
- Cloudflare, Cloud Armor, and IAP enforce the hostname and employee-access matrix.
- Keycloak imports the reviewed `trilok` realm and supports administrator-created invitations.
- n8n and Keycloak changes originate in staging, are exported to Git, reviewed in a PR, and imported to the GKE environment; direct GKE runtime-console edits are not canonical.

### Gate 3 — Internal verification

- Odoo blocks `pending`, `review`, and `blocked` supplier POs and permits only `approved`.
- Nextcloud public sharing is disabled.
- n8n execution logs contain no file bytes or vault paths.
- BFF responses contain no RED keys, file bytes, credentials, or vault paths.
- Restore and rollback drills succeed using synthetic data.

### Gate 4 — Limited external test

- Admin-created all-persona tester cohort completes the defined synthetic journeys.
- Buyer and supplier accounts cannot access employee administration surfaces.
- Tester access is revoked when the test closes.
- Synthetic files are deleted according to the test-bucket lifecycle after the evidence review completes.

## 9. Deferred controls and promotion to live operations

The following require a subsequent approved implementation design and acceptance criteria:

- Seven-year GCS WORM retention.
- Real operational or compliance data.
- Custom mTLS/private CA.
- Public self-registration.
- Any broader external rollout.

This security-test environment is a deployment and control-validation surface, not a production compliance system.
