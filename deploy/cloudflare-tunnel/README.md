# Cloudflare Tunnel fallback (not the default production path)

Production ingress is a **proxied A-record → reserved VM IP → Caddy**
(`deploy/prod/`, `deploy/gcp/README.md`). Keep this tunnel runbook as the
fallback when the VM must not listen on 80/443.

**This file targets local Odoo on `localhost:8069`.** Do not point it at the
`sattva-prod-ca` VM until ingress is rewritten to Caddy `:443` for `sattva.`,
`vault.`, and `n8n.` (Odoo production uses `workers = 2`, so websockets are on
8072 and `/web/database` is blocked only at Caddy). Using this config against
the prod VM bypasses those controls.

# Expose local Odoo at `https://sattva.trilokventures.org` via Cloudflare Tunnel

This runbook publishes the already-running local Odoo instance (host port `8069`)
at **`https://sattva.trilokventures.org`** using a **Cloudflare Tunnel**
(`cloudflared`).

A Cloudflare Tunnel creates an **outbound**, persistent connection from this
machine to Cloudflare's edge. No inbound ports are opened and **no stable public
IP is required**, which is exactly why it is the right mechanism for this
ephemeral cloud VM: the VM dials out to Cloudflare, and Cloudflare proxies
`https://sattva.trilokventures.org` traffic back down the tunnel to
`http://localhost:8069`.

```
Browser ──HTTPS──▶ Cloudflare edge ──(outbound tunnel)──▶ cloudflared ──▶ http://localhost:8069 (Odoo)
        sattva.trilokventures.org                          on this VM
```

There are two supported ways to run the tunnel. Pick **one**:

- **Token mode** (recommended for this VM) — the tunnel and its public-hostname
  ingress are managed in the Cloudflare Zero Trust dashboard; the VM only needs a
  connector token. See [Option A](#option-a--token-mode-dashboard-managed).
- **Config-file mode** — everything is managed from the CLI with a local
  credentials file and a `config.yml`. See
  [Option B](#option-b--config-file-mode-cli-managed).

> **DNS safety note.** `trilokventures.org` is registered via Google and its
> apex is used for **Google Workspace email**. Both options below only **ADD**
> the `sattva` hostname as a **proxied CNAME**. Do **NOT** create, edit or delete
> any apex `MX`, `SPF` (`TXT`), `DKIM` or `DMARC` records. Cloudflare Tunnel
> never touches those; it only adds the single `sattva` CNAME.

---

## 0. Prerequisites

- Odoo is already running and reachable locally on `http://localhost:8069`
  (see [Appendix: running Odoo for this stack](#appendix-running-odoo-for-this-stack)).
- `cloudflared` is installed on this machine (below).
- You have access to the Cloudflare account that manages the `trilokventures.org`
  zone (Zero Trust dashboard and/or `cloudflared tunnel login`).

### Install `cloudflared`

**Debian/Ubuntu (this VM, `amd64`):**

```bash
# Official Cloudflare .deb (latest):
arch="$(dpkg --print-architecture)"   # amd64 on this VM
curl -fsSL -o /tmp/cloudflared.deb \
  "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}.deb"
sudo dpkg -i /tmp/cloudflared.deb
cloudflared --version
```

Alternative (Cloudflare apt repo):

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared
```

Verified on this VM:

```
$ cloudflared --version
cloudflared version 2026.8.1 (built 2026-08-13-13:51 UTC)
```

---

## Option A — Token mode (dashboard-managed)

In token mode you create a Named Tunnel in the dashboard, then run the connector
on this VM with a token. **Ingress (which hostname maps to which local service)
is configured in the dashboard**, not in `config.yml`.

### A1. Create the Named Tunnel

1. Go to the Cloudflare **Zero Trust** dashboard:
   <https://one.dash.cloudflare.com/> → **Networks** → **Tunnels**.
2. Click **Create a tunnel** → choose **Cloudflared** → **Next**.
3. Name it `sattva-tunnel` → **Save tunnel**.

### A2. Get the connector token

On the **Install connector** step, the dashboard shows an install command that
contains the token, e.g.:

```
cloudflared service install eyJhIjoiXXXX...    <-- the long string is the token
```

Copy **only the token** (the `eyJ...` string). Treat it as a secret; it grants
the ability to run this tunnel.

Store it as an environment variable / secret named `CLOUDFLARE_TUNNEL_TOKEN`
(in Cursor Cloud, add it under **Secrets**):

```bash
export CLOUDFLARE_TUNNEL_TOKEN='eyJhIjoiXXXX...'
```

### A3. Configure the public hostname (dashboard-managed ingress)

Still in the tunnel setup wizard, go to the **Public Hostnames** tab and
**Add a public hostname**:

| Field       | Value                          |
|-------------|--------------------------------|
| Subdomain   | `sattva`                       |
| Domain      | `trilokventures.org`           |
| Path        | *(leave empty)*                |
| Type        | `HTTP`                         |
| URL         | `localhost:8069`               |

Under **Additional application settings → HTTP Settings**, optionally set
**HTTP Host Header** to `sattva.trilokventures.org` so the origin always sees the
public host (recommended; complements Odoo `proxy_mode`).

> **What this does to DNS.** Saving this public hostname makes Cloudflare
> **auto-create a proxied CNAME**: `sattva → <TUNNEL_UUID>.cfargotunnel.com`
> (orange cloud, proxied). You do not create this record by hand and it does not
> affect any apex MX/SPF/DKIM/DMARC records. Odoo 18 websockets ride the same
> origin (`/websocket` on port 8069), so this single hostname rule covers both
> normal requests and websockets — no extra rule needed.

### A4. Run the connector on this VM

Use the provided script (fails clearly if the token is missing):

```bash
export CLOUDFLARE_TUNNEL_TOKEN='eyJ...'
./deploy/cloudflare-tunnel/run-tunnel.sh
```

Equivalent raw command:

```bash
cloudflared tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN"
```

You should see `Registered tunnel connection` log lines (typically 4 edge
connections). The tunnel is now up.

### A5. Verify

```bash
# From anywhere:
curl -I https://sattva.trilokventures.org/web/login
# Expect HTTP/2 200 (or a 303 redirect to /web/login), served by Odoo.
```

Open <https://sattva.trilokventures.org> in a browser and log into Odoo.

---

## Option B — Config-file mode (CLI-managed)

Use this if you prefer to manage everything from the CLI with a local
credentials file. This requires an interactive, browser-based
`cloudflared tunnel login` once (it writes a `cert.pem` used to create tunnels
and DNS routes).

### B1. Authenticate (one-time)

```bash
cloudflared tunnel login
```

This opens a browser to authorize a zone. Select `trilokventures.org`. It writes
`~/.cloudflared/cert.pem`.

### B2. Create the tunnel

```bash
cloudflared tunnel create sattva-tunnel
```

This prints the **tunnel UUID** and writes a credentials file at
`~/.cloudflared/<TUNNEL_UUID>.json`. List tunnels any time with:

```bash
cloudflared tunnel list
```

### B3. Route DNS (adds ONLY the `sattva` CNAME)

```bash
cloudflared tunnel route dns sattva-tunnel sattva.trilokventures.org
```

This **adds** a proxied CNAME `sattva → <TUNNEL_UUID>.cfargotunnel.com`. It does
not touch apex mail records. If a `sattva` record somehow already exists, add
`--overwrite-dns` only if you are certain it is safe.

### B4. Fill in `config.yml`

Edit [`config.yml`](./config.yml) and replace the placeholders:

- `tunnel:` → the `<TUNNEL_UUID>` from step B2.
- `credentials-file:` → the path to `~/.cloudflared/<TUNNEL_UUID>.json`.

The ingress maps `sattva.trilokventures.org → http://localhost:8069` and ends
with the required `http_status:404` catch-all. Odoo 18 websockets (`/websocket`)
use the same 8069 origin, so a single service rule is sufficient.

Validate the ingress rules before running:

```bash
cloudflared tunnel --config deploy/cloudflare-tunnel/config.yml ingress validate
```

### B5. Run the tunnel

```bash
cloudflared tunnel --config deploy/cloudflare-tunnel/config.yml run sattva-tunnel
```

### B6. Verify

```bash
cloudflared tunnel info sattva-tunnel
curl -I https://sattva.trilokventures.org/web/login   # expect 200/303 from Odoo
```

Run it as a background service (optional):

```bash
sudo cloudflared --config deploy/cloudflare-tunnel/config.yml service install
sudo systemctl enable --now cloudflared
```

---

## Odoo-behind-a-proxy settings (REQUIRED)

Cloudflare terminates TLS at the edge and forwards HTTP to Odoo on
`localhost:8069`. Without proxy awareness, Odoo would think it is being accessed
over plain HTTP on `localhost`, which breaks:

- **Scheme/host detection** — Odoo would build `http://localhost:8069/...` URLs
  instead of `https://sattva.trilokventures.org/...`.
- **Redirects** — login and OAuth redirects would point at the wrong scheme/host.
- **Cookies** — the session cookie's `Secure`/host attributes would be wrong,
  causing login loops.

Fix it with two things: enable `proxy_mode`, and freeze the base URL.

### 1. Enable `proxy_mode`

`proxy_mode = True` tells Odoo to trust the `X-Forwarded-Proto` / `X-Forwarded-Host`
headers that Cloudflare sets, so it reconstructs the correct external
scheme+host. Add `--proxy-mode` to the Odoo launch. For this stack's dev launch
pattern (the committed `config/odoo.conf` is broken — see the appendix), that is:

```bash
docker compose run --rm --service-ports web \
  odoo \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass \
  -c /dev/null \
  --proxy-mode
```

> Only Cloudflare should be able to reach `8069`, otherwise a client could spoof
> `X-Forwarded-*`. On this VM `8069` is not publicly reachable (no inbound), and
> the tunnel is the only path in, so this is safe here.

### 2. Freeze the base URL via system parameters

Set the canonical external URL and freeze it so Odoo stops auto-updating
`web.base.url` to whatever host last logged in:

- `web.base.url = https://sattva.trilokventures.org`
- `web.base.url.freeze = True`

Set them through `odoo shell` using the same dev launch pattern. Replace
`<DBNAME>` with your database (list them at
`http://localhost:8069/web/database/manager` or via `psql`):

```bash
docker compose run --rm web \
  odoo shell \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass \
  -c /dev/null \
  -d <DBNAME> <<'PY'
env['ir.config_parameter'].sudo().set_param('web.base.url', 'https://sattva.trilokventures.org')
env['ir.config_parameter'].sudo().set_param('web.base.url.freeze', 'True')
env.cr.commit()
print('web.base.url =', env['ir.config_parameter'].sudo().get_param('web.base.url'))
print('web.base.url.freeze =', env['ir.config_parameter'].sudo().get_param('web.base.url.freeze'))
PY
```

`odoo shell` reads commands from stdin, so the heredoc above runs the three
statements and prints the resulting values for confirmation.

> **Tip:** if you want the domain baked in for every run rather than passing
> `--proxy-mode` each time, you would normally add `proxy_mode = True` to an Odoo
> config file — but this stack's committed `config/odoo.conf` is broken and must
> not be modified, so pass `--proxy-mode` on the command line as shown.

---

## End-to-end verification checklist

1. `cloudflared --version` → prints a version.
2. Odoo answers locally: `curl -I http://localhost:8069/web/login` → `200`/`303`.
3. Tunnel is up: `run-tunnel.sh` (token mode) or `cloudflared tunnel info` shows
   active connections.
4. DNS: `dig +short sattva.trilokventures.org` → a `*.cfargotunnel.com` CNAME
   (proxied through Cloudflare).
5. Public reachability: `curl -I https://sattva.trilokventures.org/web/login` →
   `200`/`303` served by Odoo.
6. Browser: log into Odoo at `https://sattva.trilokventures.org`; confirm no
   redirect loops and that generated links use the `https://sattva...` host
   (proof that `proxy_mode` + frozen `web.base.url` are effective).

---

## Appendix: running Odoo for this stack

The committed `config/odoo.conf` is intentionally left untouched but is **broken**
for the `odoo:18.0` image:

- `addons_path=/opt/odoo/odoo/addons` does not exist in the image and omits
  `/mnt/extra-addons` (where `addons/sattva_compliance` is mounted).
- `db_host` / `db_port` / `db_password = False` break the Postgres connection.

Start the DB and run Odoo with the dev workaround (do **not** edit the committed
`config/odoo.conf` or `docker-compose.yml`):

```bash
# Start Postgres (and the web container's network):
docker compose up -d db

# Run Odoo with a working config, bypassing the broken committed one (-c /dev/null):
docker compose run --rm --service-ports web \
  odoo \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass \
  -c /dev/null \
  --proxy-mode
```

Odoo is then reachable at `http://localhost:8069`, ready for the tunnel.
