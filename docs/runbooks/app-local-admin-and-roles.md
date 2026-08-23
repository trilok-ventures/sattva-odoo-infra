# App-local admin mailbox and roles (no Keycloak)

Odoo 18 labels the login field **Email**. That value is `res.users.login`, not
a separate mailbox column. The default install uses login `admin`, so
`archneo@trilokventures.org` is rejected until the **existing** admin user is
updated.

This runbook binds that mailbox to the existing Odoo and Nextcloud admins.
It does **not** deploy Keycloak.

## Bind the operator mailbox (VM)

On `sattva-prod-vm`:

```bash
cd /opt/sattva
sudo ./deploy/gcp/set-operator-admin-email.sh --check
sudo ./deploy/gcp/set-operator-admin-email.sh
```

Default mailbox: `archneo@trilokventures.org`. Override with
`OPERATOR_EMAIL=you@trilokventures.org`.

The script:

- Mutates Odoo uid **2** only (`login` + `email` + partner email).
- Refuses if uid 2 is not `admin` / that mailbox, or if another **internal**
  user already owns the login. A leftover **portal/share** user on the same
  mailbox (common after a first failed email login) is archived and renamed
  with `--release-share-login`. It never promotes that portal user.
- Keeps Settings / Administration (`base.group_system`).
- Sets Nextcloud **email** on userid `admin`. It does **not** rename that
  userid (`NEXTCLOUD_ADMIN_USER=admin` in `deploy/prod/.env`).
- Does **not** create a second admin.
- Does **not** write `res.users.password`.

## What to type on each login form

| App | URL | Username | Password |
| --- | --- | --- | --- |
| Odoo | `https://sattva.trilokventures.org` | `archneo@trilokventures.org` | Secret Manager `odoo-web-admin-password` |
| Nextcloud | `https://vault.trilokventures.org` | `admin` or the mailbox once the email setting is unique | Secret Manager `nextcloud-admin-password` |
| n8n | `https://n8n.trilokventures.org` | `archneo@trilokventures.org` | Password already set in the editor. Do not overwrite it. `n8n-owner-password` is only for a future reset you run on purpose. |

These three secrets are **different on purpose**. Do not copy the Nextcloud
password onto Odoo. `odoo-admin-passwd` is only the database-manager master
(Caddy 404s `/web/database`).

Set the Odoo web password on the VM (value never logged). **Stop the
workers first** — a live `sattva-prod-web` can cache `res.users` and ignore
a sidecar write. Recreate after the write:

```bash
sudo ./deploy/gcp/recreate-odoo-web.sh
```

That script stops `web`, writes `odoo-web-admin-password` onto uid 2, force-
recreates `web`, and checks `/jsonrpc` authenticate. Do not use
`set-odoo-web-admin-password.sh` against a running worker set.

Hard-refresh the browser (or a private window) on
`https://sattva.trilokventures.org/web/login`. Do not use `localhost:8069`
(that is the Cloud local stack; login there is still `admin`).

Retrieve a secret on your laptop (do not paste it into chat or git):

```bash
gcloud secrets versions access latest \
  --secret=odoo-web-admin-password --project=tv-assetco-secrets
```

Cloudflare Access still runs first (`@trilokventures.org` on `sattva` /
`vault`; IT mailbox on `n8n`). See `deploy/gcp/README.md` §4.

## Roles you can use now (no IdP)

Two layers, both already specified:

1. **Network gate — Cloudflare Access** (architecture §4.7 / §5.1).
   Employees reach `sattva.` and `vault.`; n8n editor is IT-only; webhooks
   are Access Bypass + HMAC.
2. **App roles — Odoo-local groups** (architecture §4.5: Phase 1 keeps
   Odoo-local groups). Fabric names map in
   `addons/sattva_compliance/models/notify.py` `ROLE_GROUPS`:

| Fabric role | Odoo group xmlid |
| --- | --- |
| `sales.exec` | `sales_team.group_sale_salesman` |
| `finance.manager` | `account.group_account_manager`, `account.group_account_user` |
| `logistics.exec` | `stock.group_stock_user` |
| `it.admin` | `base.group_system` |
| `compliance.officer` | `sattva_compliance.group_compliance_officer` |

The operator mailbox on uid 2 is `it.admin`. Add further humans as **new
non-admin users** and attach the groups above. Do not clone Settings onto
every mailbox. `n8n.fabric` stays a service user (not a human admin).

Check Access apps in Zero Trust (WARP client auth off). Check Odoo groups
under Settings → Users. Check Nextcloud under Accounts → `admin` → Groups
(`admin`).

## Keycloak is closed for this slice

Do not add `auth.trilokventures.org`, a Caddy `auth.` vhost, Access for
`auth.`, or `auth_oauth` / Nextcloud OIDC clients.

`deploy/prod/validate-prod-stack.mjs` fails if `auth.trilokventures.org`
appears in the Caddyfile. `deploy/keycloak/realm-trilok.json` is not in
git. A Keycloak admin secret in AssetCo is not a deploy grant.

Unlocks (one later PR, after a dated spec):

1. Recorded Phase 3a T1 acceptance (origin TLS, Access, PCP gate, partner
   form views).
2. Dated spec that supersedes architecture §5.1 “Odoo-local until Keycloak”
   for production cutover.
3. Secret-stripped `deploy/keycloak/realm-trilok.json` in git.
4. Caddy + validator + Access allow `auth.` together.
5. First boot must **not** switch Odoo/Nextcloud to OIDC on day one.
   Access stays the employee network gate.

Until then, multiple roles are Access policies + Odoo-local groups.
