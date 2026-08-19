# GCP bootstrap — Trilok Ventures / Sattva Brokers

HoldCo org folders, OpCo runtime project (`sattva-prod-ca`), AssetCo secrets.
Matches `docs/superpowers/specs/2026-08-13-holdco-gcp-vercel-bff-rewire.md` and
the Phase 3a T1 Compose-on-VM topology in the integrated architecture.

Do not paste secret values into this file, tickets, or Notion GREEN pages.

This slice does **not** create GKE, Cloud Armor, Certificate Authority Service, Caddy origin client certificates,
Keycloak, GCS WORM, or `upload.trilokventures.org`.

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

## 1. Folders and projects

```bash
./deploy/gcp/bootstrap-projects.sh
```

Idempotent. Looks up folders/projects by display name before creating.
OpCo project default: `sattva-prod-ca`. AssetCo project default: `tv-assetco-secrets`.

## 2. Secret names (AssetCo)

Create the ids in `secret-names.md` **in the AssetCo project**. Values never
enter git. `provision-runtime.sh` grants the VM service account accessor on
those ids when they exist.

Verify names, enabled versions, and Compute Engine SA access (prints byte
lengths only):

```bash
./deploy/gcp/verify-secrets.sh
```

Healthy means every required id exists, has an enabled version, and is
readable by `sattva-prod-vm@sattva-prod-ca.iam.gserviceaccount.com` (or, before
the VM SA exists, the project's default Compute Engine SA). Then run
`provision-runtime.sh`.

## 3. Runtime in `sattva-prod-ca`

```bash
./deploy/gcp/provision-runtime.sh
```

Creates (idempotent):

- Reserved regional IP `sattva-prod-ipv4`
- VM service account `sattva-prod-vm`
- Versioned GCS bucket `${PROJECT}-backups` (not WORM)
- Firewall `allow-iap-ssh` (tcp/22 from `35.235.240.0/20`)
- Firewall `allow-cloudflare-http` (tcp/80,443 from live Cloudflare IPv4 list)
- Firewall `deny-public-ssh` (tcp/22 from `0.0.0.0/0` at priority 2000)
- `e2-standard-2` Ubuntu 24.04 VM, OS Login, tag `iap-ssh,cf-origin`, startup
  installs Docker, git, and `gcloud`. No public SSH.

Optional: grant your user IAP + OS Login in the same run:

```bash
export TRILOK_GCP_OPERATOR="user:you@trilokventures.org"
./deploy/gcp/provision-runtime.sh
```

Then SSH with IAP (no public 22):

```bash
gcloud compute ssh sattva-prod-vm --zone="${TRILOK_GCP_ZONE:-northamerica-northeast1-b}" --tunnel-through-iap --project=sattva-prod-ca
```

On the VM (OS Login user is not necessarily `ubuntu`):

```bash
sudo usermod -aG docker "$(whoami)"
# re-SSH so the docker group applies
sudo git clone https://github.com/trilok-ventures/sattva-odoo-infra.git /opt/sattva
cd /opt/sattva
# Until this branch is merged, check out the deploy branch instead of main:
# sudo git -C /opt/sattva fetch origin cursor/sattva-prod-ca-compose-vm-952c
# sudo git -C /opt/sattva checkout cursor/sattva-prod-ca-compose-vm-952c
sudo ./deploy/gcp/fetch-secrets.sh /opt/sattva/deploy/prod/.env
cd deploy/prod
sudo docker compose -f docker-compose.prod.yml run --rm web \
  --without-demo=all --stop-after-init -i sattva_compliance -d sattva

# write the printed uid into /opt/sattva/deploy/prod/.env as ODOO_N8N_UID, then:
sudo docker compose -f docker-compose.prod.yml run --rm -T web \
  shell -d sattva --no-http <<'PY'
User = env['res.users']
group = env.ref('sattva_compliance.group_n8n_fabric_service', raise_if_not_found=False)
login = 'n8n.fabric'
user = User.search([('login', '=', login)], limit=1)
if not user:
    vals = {'name': 'n8n.fabric', 'login': login}
    if group:
        vals['groups_id'] = [(6, 0, [group.id])]
    user = User.create(vals)
print(user.id)
env.cr.commit()
PY

sudo docker compose -f docker-compose.prod.yml up -d
sudo ./harden-nextcloud.sh
```

Nextcloud WebDAV user `n8n.vault` (password from `nextcloud-n8n-app-password`; do not echo it):

```bash
# OC_PASS is read from Secret Manager in this shell only
OC_PASS="$(gcloud secrets versions access latest --secret=nextcloud-n8n-app-password --project=tv-assetco-secrets)"
export OC_PASS
sudo -E docker compose -f docker-compose.prod.yml exec -T -e OC_PASS nextcloud \
  php occ user:add --password-from-env --display-name=n8n.vault n8n.vault || true
unset OC_PASS
```

Import committed n8n workflows (do not edit them in the prod UI):

```bash
sudo docker compose -f docker-compose.prod.yml exec -T n8n \
  sh -c 'for f in /workflows/wf.*.json; do n8n import:workflow --input="$f"; done'
```

Schedule Odoo dumps (not Nextcloud RED):

```bash
sudo tee /etc/systemd/system/sattva-odoo-backup.service >/dev/null <<'UNIT'
[Service]
Type=oneshot
ExecStart=/opt/sattva/deploy/gcp/backup-to-gcs.sh
UNIT
sudo tee /etc/systemd/system/sattva-odoo-backup.timer >/dev/null <<'UNIT'
[Timer]
OnCalendar=daily
Persistent=true
[Install]
WantedBy=timers.target
UNIT
sudo systemctl enable --now sattva-odoo-backup.timer
```

`backup-to-gcs.sh` is Odoo `pg_dump` only. Do not copy Nextcloud RED into
`gs://${PROJECT}-backups` (that bucket is versioned, not WORM).

See `deploy/prod/README.md` for DB init and the PCP-gate smoke test.

## 4. Cloudflare Access (before DNS goes live)

Create Access applications **before** pointing proxied A records at the VM.
Following DNS-only first publishes login pages on the public internet.

- `sattva.trilokventures.org` — employees (sales/compliance/finance/logistics/IT)
- `vault.trilokventures.org` — employees
- `n8n.trilokventures.org` — IT group only
- `n8n.trilokventures.org/webhook/*` — bypass Access; n8n webhook HMAC is the
  authenticator (or a Cloudflare Access service token for CI health checks)

Do not put buyer/supplier personas on these hostnames. Public product stays on
`app.` (Vercel BFF).

## 5. DNS (human, Cloudflare dashboard)

Proxied A records to the reserved IP, SSL Full (strict):

- `sattva` → Odoo
- `vault` → Nextcloud
- `n8n` → n8n

Do not steal MX/SPF. Do not point `app.` here (Vercel BFF). Do not enable
`upload.` until the later origin-upload slice.

## 6. Vercel BFF (separate project)

Create a **separate** Vercel project with Root Directory `middleware/`.
Pull secret *references* (`ODOO_URL`, `ODOO_API_KEY`, `N8N_BASE_URL`) —
never the Odoo admin password, never Nextcloud passwords, never
`NEXT_PUBLIC_` fabric URLs. Root `vercel.json` stays mocks-only.

## Phase gating

Treat the VM as production only after origin certs, Access policies, the PCP
gate smoke test, and remaining Phase 1 partner-form views exist. The BFF can
stay `FABRIC_MODE=mock` until those exist.
