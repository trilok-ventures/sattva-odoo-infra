# Sattva Odoo 18 — Production Deployment Runbook

Durable blueprint to run the Sattva/Trilok Ventures Odoo stack on a **persistent
host** (small cloud VM / VPS) behind **Cloudflare**, serving
**https://sattva.trilokventures.org**.

> These files live under `deploy/prod/` and are **new** — they do not touch the
> broken committed `config/odoo.conf`, `docker-compose.yml`, or any override.

## Contents

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Prod stack: `web` (odoo:18.0) + `db` (postgres:15) + `caddy` reverse proxy. Only Caddy publishes 80/443. |
| `odoo.conf` | Hardened Odoo config **template** (secrets rendered from env at start-up). |
| `Caddyfile` | Reverse proxy for `sattva.trilokventures.org` → `web:8069` (+ `web:8072` for websocket). |
| `.env.example` | Placeholders for secrets; copy to `.env`. |
| `.gitignore` | Keeps `.env` and `certs/` out of git. |

## Architecture

```
Browser ──TLS──> Cloudflare edge ──TLS (Full strict)──> Caddy :443
                                                          │
                              ┌───────────────────────────┤ frontend net
                              ▼                            ▼
                        web:8069 (HTTP)            web:8072 (websocket/longpoll)
                              │
                              └── backend net ──> db:5432 (private, never exposed)
```

- `web` and `db` publish **no** host ports. Only Caddy binds `80`/`443`.
- `db` sits on a private `backend` network Caddy cannot reach.
- Named volumes persist Postgres data (`db-data`) and the Odoo filestore
  (`odoo-data`); Caddy state is in `caddy-data`/`caddy-config`.

---

## 1. Provision the host  *(MANUAL — needs a real VM; no host creds in this repo)*

1. Create a small VM/VPS (e.g. 2 vCPU / 4 GB RAM, Ubuntu 22.04/24.04 LTS).
   - 1 vCPU / 2 GB works for light use; adjust `workers` in `odoo.conf`
     (formula `workers = 2*cores + 1`).
2. Give it a **static public IP** (IPv4, and IPv6 if available).
3. Open inbound firewall for **80/tcp** and **443/tcp** only (plus your SSH
   port). Do **not** open 8069 — Odoo is never public.
4. Point a DNS record at the IP (see step 5) — Cloudflare will proxy it.

## 2. Install Docker  *(MANUAL — on the host)*

```bash
# Docker Engine + Compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # then log out/in
docker --version && docker compose version
```

## 3. Get the code + set the env file  *(on the host)*

```bash
git clone https://github.com/archneo/trilok-ventures.git
cd trilok-ventures/deploy/prod

cp .env.example .env
chmod 600 .env
# Edit .env and set strong secrets:
#   POSTGRES_PASSWORD  (openssl rand -base64 30)
#   ODOO_ADMIN_PASSWD  (openssl rand -base64 30)
```

## 4. Provide the origin TLS certificate  *(MANUAL — Cloudflare dashboard)*

**Default / recommended: Cloudflare Origin Certificate** (works cleanly behind a
proxied/orange-cloud record, no ACME challenge to be intercepted).

1. Cloudflare dashboard → **SSL/TLS → Origin Server → Create Certificate**.
2. Hostname: `sattva.trilokventures.org` (RSA or ECDSA, 15-year validity).
3. Save the two PEM blocks on the host:
   ```bash
   mkdir -p certs
   # paste the certificate:
   nano certs/origin.pem
   # paste the private key:
   nano certs/origin.key
   chmod 600 certs/origin.key
   ```
4. Cloudflare → **SSL/TLS → Overview → set Encryption mode = _Full (strict)_**.

> **Alternative (publicly-trusted cert via Let's Encrypt / DNS-01):** only if you
> specifically need it. HTTP-01/TLS-ALPN-01 **do not work** through proxied
> Cloudflare. Build a Caddy image with the `caddy-dns/cloudflare` plugin, put a
> scoped `CLOUDFLARE_API_TOKEN` (Zone.DNS:Edit) in `.env`, and switch the `tls`
> block in the `Caddyfile` (block **B**). Still use **Full (strict)**.
>
> **Never use Cloudflare "Flexible"** — CF→origin over plain HTTP + origin
> HTTPS-redirect = infinite redirect loop.

## 5. Point Cloudflare DNS at the host  *(MANUAL — Cloudflare dashboard)*

- Add **A** record `sattva` → `<host IPv4>`, **Proxy status: Proxied** (orange).
- (Optional) **AAAA** record `sattva` → `<host IPv6>`, **Proxied**.
- **Do NOT touch existing MX / SPF / DKIM / DMARC records** — the domain runs
  Google Workspace email. Only add/adjust the `sattva` host record.

## 6. Start the stack  *(on the host)*

```bash
cd deploy/prod
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy web
```

## 7. Initialise the database + install the addon  *(on the host, ONE TIME)*

Create the `sattva` database and install the custom addon (and its deps
`purchase`, `contacts`) in one shot:

```bash
docker compose -f docker-compose.prod.yml run --rm web \
  odoo -c /tmp/odoo.conf \
       -d sattva \
       -i sattva_compliance \
       --without-demo=all \
       --stop-after-init
```

> The `web` container renders `/tmp/odoo.conf` from `odoo.conf` on start, so the
> `run --rm` above must call the entrypoint that renders it. If you invoke
> `odoo` directly (bypassing the entrypoint) use the explicit render first, e.g.
> `docker compose ... run --rm --entrypoint bash web -lc 'python3 -c "..."; odoo ...'`.
> The simplest path is the default entrypoint plus the flags above.

Then restart so the long-running server picks a clean state:

```bash
docker compose -f docker-compose.prod.yml up -d web
```

## 8. Verify health

```bash
# Origin is up (from the host itself, bypassing Cloudflare):
curl -kI https://localhost/web/login            # via Caddy on the box
docker compose -f docker-compose.prod.yml exec web \
  curl -sf http://localhost:8069/web/health && echo OK

# Public, through Cloudflare:
curl -I https://sattva.trilokventures.org/web/login
```

Expected: HTTP `200`/`303` on `/web/login`, valid TLS, and the Odoo login page
in a browser. Log in with the master/admin credentials created during init.

**Hello-world smoke test (core functionality):** log in → **Contacts** → create a
supplier → set *PCP Compliance Status = Pending* → open **Purchase → new PO** for
that supplier → **Confirm**. The `sattva_compliance` gate should **block**
confirmation until the supplier is *PCP Approved*. That proves the addon,
DB, workers, and proxy all work end to end.

---

## 9. Backups

Back up the two stateful volumes (DB + filestore). Run on the host:

```bash
STAMP=$(date +%F_%H%M)

# --- Postgres logical dump (preferred; consistent, portable) ---
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U odoo -d sattva -Fc > "sattva_${STAMP}.dump"

# --- Filestore volume (attachments) ---
docker run --rm \
  -v prod_odoo-data:/data -v "$PWD":/backup alpine \
  tar czf "/backup/odoo-filestore_${STAMP}.tgz" -C /data .
```

> Volume names are prefixed by the compose project (the `deploy/prod` dir → e.g.
> `prod_odoo-data`, `prod_db-data`). Confirm with `docker volume ls`.

Restore (into a fresh stack):

```bash
# DB
cat sattva_<stamp>.dump | docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U odoo -d sattva --clean --if-exists
# Filestore
docker run --rm -v prod_odoo-data:/data -v "$PWD":/backup alpine \
  sh -c 'cd /data && tar xzf /backup/odoo-filestore_<stamp>.tgz'
```

Schedule daily via cron and copy dumps off-box (e.g. object storage).

## 10. Update / redeploy

```bash
git pull
docker compose -f docker-compose.prod.yml pull        # refresh images
docker compose -f docker-compose.prod.yml up -d
# Apply addon code/schema changes:
docker compose -f docker-compose.prod.yml run --rm web \
  odoo -c /tmp/odoo.conf -d sattva -u sattva_compliance --stop-after-init
docker compose -f docker-compose.prod.yml up -d web
```

## 11. Rollback / uninstall

```bash
# Stop everything (KEEP data volumes):
docker compose -f docker-compose.prod.yml down

# Roll back to the previous image/code, then bring back up:
git checkout <previous-tag-or-sha>
docker compose -f docker-compose.prod.yml up -d

# Uninstall just the custom addon (data volumes preserved):
docker compose -f docker-compose.prod.yml run --rm web \
  odoo -c /tmp/odoo.conf -d sattva --uninstall sattva_compliance --stop-after-init

# FULL teardown INCLUDING data (DESTRUCTIVE — back up first!):
docker compose -f docker-compose.prod.yml down -v
```

---

## Decisions / inputs YOU must provide

These require real infra/credentials this blueprint cannot supply:

1. **Host provider + public IP(s)** (VM/VPS, static IPv4, optional IPv6).
2. **TLS choice:** Cloudflare **Origin Certificate** (default, easiest behind
   proxied CF) **or** Let's Encrypt DNS-01 auto-TLS (needs custom Caddy build +
   `CLOUDFLARE_API_TOKEN`). Set Cloudflare mode to **Full (strict)** either way.
3. **Secret values** in `.env`: `POSTGRES_PASSWORD`, `ODOO_ADMIN_PASSWD`
   (+ `ACME_EMAIL` / `CLOUDFLARE_API_TOKEN` only for auto-TLS).
4. **Cloudflare DNS**: add the proxied `sattva` A/AAAA record **without**
   disturbing the Google Workspace mail records (MX/SPF/DKIM/DMARC).
