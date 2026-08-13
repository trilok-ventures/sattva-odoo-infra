# GCP bootstrap — Trilok Ventures / Sattva Brokers

HoldCo org folders, OpCo runtime project, AssetCo secrets. Matches
`docs/superpowers/specs/2026-08-13-holdco-gcp-vercel-bff-rewire.md`.

Do not paste secret values into this file, tickets, or Notion GREEN pages.

## Prerequisites

- `gcloud` CLI (`gcloud auth login` and `gcloud auth application-default login`)
- Organization Admin or Folder Admin on the Trilok Ventures org
- A billing account ID
- Region: `northamerica-northeast1` (Toronto) or `northamerica-northeast2` (Montreal)

```bash
export TRILOK_GCP_ORG_ID="123456789012"
export TRILOK_GCP_BILLING_ACCOUNT="XXXXXX-XXXXXX-XXXXXX"
export TRILOK_GCP_REGION="northamerica-northeast1"
```

Then:

```bash
./deploy/gcp/bootstrap-projects.sh
```

If `gcloud` is missing, install the Google Cloud SDK and re-run. The script is
idempotent: it looks up folders/projects by display name before creating.

## After folders exist

1. Create secrets listed in `secret-names.md` **in the AssetCo project**
   (`tv-assetco-secrets` if the script created it).
2. Grant the OpCo VM service account `roles/secretmanager.secretAccessor` on
   those secrets only.
3. Reserve a static external IP in `sattva-prod-ca`.
4. Create an `e2-standard-2` Ubuntu 24.04 VM; no public SSH (IAP tunnel only).
5. Firewall: allow 80/443 from [Cloudflare IP ranges](https://www.cloudflare.com/ips/); deny everything else inbound.
6. Install Docker + Compose on the VM; deploy `deploy/prod/` (Phase 3 plan — not this change).
7. Point Cloudflare A records at the static IP (proxied, Full strict) per the
   integrated architecture hostname table.
8. Create a **separate** Vercel project with Root Directory `middleware/`.
   Pull secret *references* into Vercel env (`ODOO_URL`, `ODOO_API_KEY`, …)
   — never the Odoo admin password, never Nextcloud user passwords.

## Phase gating

Local Compose (Phase 1) should accept n8n + Nextcloud before this VM is treated
as production. The BFF can run `FABRIC_MODE=mock` until then.
