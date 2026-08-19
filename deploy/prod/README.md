# Sattva production Compose — Phase 3a T1 (GCP VM)

Runs Odoo, Postgres, Nextcloud, n8n (queue + worker), Redis, and Caddy on the
`sattva-prod-ca` VM. Only Caddy publishes 80/443. GCP firewall restricts those
ports to Cloudflare. SSH is IAP-only.

These files do **not** edit committed `config/odoo.conf` or the local
`docker-compose.yml`.

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Prod fabric. n8n-worker has no host ports. |
| `odoo.conf` | Hardened template; secrets rendered at start-up. |
| `Caddyfile` | `sattva.` / `vault.` / `n8n.` Origin TLS. Blocks `/web/database`. No origin client certificates. |
| `.env.example` | Placeholders; real file from `deploy/gcp/fetch-secrets.sh`. |
| `validate-prod-stack.mjs` | Policy checks (ports, hostnames, T2 absence). |

Out of this slice: Keycloak (`auth.`), `upload.trilokventures.org`, GKE, T2 mTLS.

## Host

Provision with `deploy/gcp/provision-runtime.sh`, then follow
`deploy/gcp/README.md` to clone, fetch secrets, install the Origin Certificate
(`certs/origin.pem` + `certs/origin.key`, git-ignored), and compose up.

Origin cert hostnames: `sattva.trilokventures.org`,
`vault.trilokventures.org`, `n8n.trilokventures.org` (or `*.trilokventures.org`).
Cloudflare SSL mode **Full (strict)**. Never Flexible.

## Initialise the database (once)

The web entrypoint always renders `/tmp/odoo.conf` then execs `odoo`. Extra
compose args are passed through:

```bash
cd deploy/prod
docker compose -f docker-compose.prod.yml run --rm web \
  --without-demo=all --stop-after-init -i sattva_compliance -d sattva
docker compose -f docker-compose.prod.yml up -d web
./harden-nextcloud.sh
```

## Smoke test

From the VM: `curl -kI https://127.0.0.1/web/login` with `Host: sattva.trilokventures.org`.
Through Cloudflare: `https://sattva.trilokventures.org/web/login`.

PCP gate: create a pending supplier, confirm a PO → blocked; approve supplier →
confirm succeeds. n8n must never call `button_confirm`.

## Backups

`deploy/gcp/backup-to-gcs.sh` dumps the Odoo `sattva` database only. Nextcloud
RED files stay on the VM disk until the GCS WORM slice — do not tar the vault
into the OpCo versioned (non-WORM) bucket.

## Policy check

```bash
node deploy/prod/validate-prod-stack.mjs
node deploy/gcp/cloudflare-ingress.test.mjs
```
