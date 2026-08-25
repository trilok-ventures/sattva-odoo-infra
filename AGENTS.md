# AGENTS.md

## Canonical specs (read before changing anything structural)

- `docs/superpowers/specs/2026-08-13-sattva-brokers-system-fabric-design.md` — **locked**
  system fabric: one SoR per domain, RED/AMBER/GREEN data classes, phase gating, stop list.
- `docs/superpowers/specs/2026-08-14-integrated-system-architecture.md` — operational
  architecture: GCP VM + Cloudflare proxy, Keycloak IdP, repo-as-source-of-truth layout.
- `docs/superpowers/specs/2026-08-13-sattva-versioned-kb.md` — knowledge-plane rules.
- `.cursor/agents/fabric-architect.md` — project subagent that enforces the above; use it
  to review any change touching Odoo, n8n, Nextcloud, Keycloak, GCP, Cloudflare, or Vercel.
- `docs/superpowers/specs/2026-08-18-dual-plane-ceo-desk-design.md` — Dual-plane CEO desk
  (Grok Bot GREEN ops + Cursor Cloud spawn). Operating pack: `ops/dual-plane/`.
  Binder plugin: `plugins/sattva-fabric-bind/`. Spawn briefs must pass
  `python3 ops/dual-plane/validate_spawn_brief.py <brief.json>`.

## Cursor Cloud specific instructions

### What this repo is
An **Odoo 18.0** deployment (via Docker Compose) plus one custom addon,
`addons/sattva_compliance` ("Sattva Brokers: Compliance & Supplier Gates").
The addon adds PCP compliance fields to `res.partner` and hard-blocks
`purchase.order` confirmation unless the supplier is `approved`.

### Services (from `docker-compose.yml`)
- `web` — Odoo 18.0, published on host port **8069** (container `sattva-odoo-web`).
- `db` — Postgres 15, internal only (container `sattva-odoo-db`, DB user `odoo`,
  password `sattva_db_secure_pass`).

### Starting everything (Docker daemon is NOT auto-started)
Docker (v29, `fuse-overlayfs` storage driver, `containerd-snapshotter=false`,
iptables-legacy) is pre-installed in the VM snapshot but the daemon does not run
on boot. Start it, then bring the stack up:

```bash
sudo dockerd > /tmp/dockerd.log 2>&1 &   # wait ~5s; skip if `docker info` already works
cd /workspace && sudo docker compose up -d
sudo docker logs -f sattva-odoo-web       # "HTTP service (werkzeug) running on ...:8069"
```

App URL: http://localhost:8069 — **login `admin` / `admin`**. DB-manager master
password is the dev default **`admin`** (see gotcha below).

### CRITICAL gotcha: the committed `config/odoo.conf` is broken for this stack
Do not rely on `config/odoo.conf` as-is. It sets `addons_path=/opt/odoo/odoo/addons`
(does not exist in the official `odoo:18.0` image, and omits the mounted
`/mnt/extra-addons`) and `db_host/db_port/db_password = False` (breaks Postgres:
`invalid integer value "False" for connection option "port"`).

`docker-compose.override.yml` (added during env setup, auto-merged by
`docker compose`) works around this by launching Odoo directly with the correct
`--addons-path` and DB flags and `-c /dev/null`. Because it uses `-c /dev/null`,
the `admin_passwd` from `config/odoo.conf` is bypassed, so the DB-manager master
password is the Odoo default `admin`. Do not edit the committed files to "fix"
this unless intentionally changing the app; the override keeps them pristine.

### Initialize / update the database and addon
The `sattva` database must be created and the addon installed before use
(the running `web` server only serves existing DBs):

```bash
# Create DB 'sattva' and install the addon (+ base/purchase/contacts deps)
sudo docker exec sattva-odoo-web odoo -d sattva -i sattva_compliance \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  -c /dev/null --stop-after-init

# After editing addon code, reload it with -u (Python is hot-reloaded on restart,
# but schema/field/view changes need a module update):
sudo docker exec sattva-odoo-web odoo -d sattva -u sattva_compliance \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  -c /dev/null --stop-after-init
```

### CRITICAL gotcha: the addon has fields but NO views
`sattva_compliance` declares `'data': []` in its manifest, so its
`res.partner` fields (`supplier_pcp_status`, `risk_band`, `haccp_certified`,
`brc_certified`, `nextcloud_folder_path`) exist in the DB/model but are **not on
any form view** — you cannot see or edit them in the UI out of the box. The
default `supplier_pcp_status` is `pending`, which blocks **every** PO
confirmation. To change a supplier's status without adding a view, use the shell:

```bash
sudo docker exec -i sattva-odoo-web odoo shell -d sattva \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass \
  --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons \
  -c /dev/null --no-http <<'PY'
p = env['res.partner'].search([('name','=','Riverbank Organic Farm')], limit=1)
p.supplier_pcp_status = 'approved'
env.cr.commit()
PY
```

### CRITICAL gotcha: two Vercel projects — do not retarget the mocks deploy
The GitHub-connected project `sattva-odoo-infra` publishes **only**
`docs/superpowers/mocks/` (root `vercel.json`). The operations BFF lives in
`middleware/` and needs a **separate** Vercel project with Root Directory
`middleware/` (`app.trilokventures.org`). Never change root `vercel.json` to
Next.js, never set `NEXT_PUBLIC_` fabric URLs, never `vercel --prod` this BFF
onto the mocks project. GCP folders/projects: `deploy/gcp/`. Spec:
`docs/superpowers/specs/2026-08-13-holdco-gcp-vercel-bff-rewire.md`.

### Lint / test / build
- Odoo addon: no linter or automated-test suite. "Lint" = Python syntax check;
  "test" = loading/updating the module cleanly (`-u sattva_compliance --stop-after-init`
  must finish with "Modules loaded." and no ERROR). There is no separate Odoo
  build step (Odoo runs from source inside the image; the addon is bind-mounted).
- Middleware BFF (`middleware/`): `npm ci && npm run build && npm test`
  (contract check). Start `npm run start` (port 3010) for HTTP assertions;
  unit strip checks still pass if the server is down.
- Quick Odoo syntax check (writes no bytecode, avoids the read-only mount):
  ```bash
  sudo docker exec sattva-odoo-web python3 -c "import ast,sys
  for f in sys.argv[1:]: ast.parse(open(f).read(), f); print('OK', f)" \
    /mnt/extra-addons/sattva_compliance/models/res_partner.py \
    /mnt/extra-addons/sattva_compliance/models/purchase_order.py
  ```

### Manual smoke test of the compliance gate (core feature)
Create a supplier (defaults to `pending`) + a purchase order, confirm it (blocked
with a "Compliance Gate Blocked" UserError), set the supplier to `approved`, then
confirm again (succeeds, state → `purchase`). This can be scripted via `odoo shell`
or done in the UI (Purchase app → new RFQ → Confirm Order shows the block dialog).
