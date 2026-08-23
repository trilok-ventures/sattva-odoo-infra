# Path B Access — browser apps only (no WARP client auth)

Phase 3a T1 ingress for `sattva` / `vault` / `n8n` on `trilokventures.org`.
Pairs with `deploy/gcp/README.md` §4 and `deploy/dns/README.md`.

Do not create a wildcard Access app or a wildcard DNS record. The Origin CA
SAN may be `*.trilokventures.org`; Access and DNS stay per-hostname.

## The error you hit

```
access.api.error.invalid_request: allow_authenticate_via_warp cannot be set
until a Cloudflare One Client Authentication session duration is set for the
account. Configure one under Access > Settings.
```

The Cloudflare One **application installer** (and some Self-hosted forms) send
`allow_authenticate_via_warp: true` by default. That flag is for
**Authenticate with Cloudflare One Client** (WARP / device client). It is
illegal until the account has a Client Authentication session duration under
**Zero Trust → Access controls → Access settings → Cloudflare One Client
authentication → Session duration**.

These three hosts are **browser HTTPS** apps. Login is Access IdP or one-time
PIN, then the app session. Do **not** turn on Cloudflare One Client auth for
this slice, and do **not** set the account Client Authentication duration just
to unblock the installer. That would add a WARP prerequisite that is not in
Phase 3a T1.

## Fix (dashboard)

1. Leave **Access settings → Cloudflare One Client authentication** unset.
2. Do **not** use **Applications → Install** / the catalog installer.
3. Use **Zero Trust → Access controls → Applications → Add → Self-hosted**.
4. On **Authentication**, leave **Authenticate with Cloudflare One Client**
   **off** (unchecked). That is `allow_authenticate_via_warp: false`.
5. Session duration: `24 hours` (application session). Identity: Google or
   One-time PIN. Instant auth is optional if only one IdP is enabled.

Create **four** self-hosted apps (not `*.trilokventures.org`):

| Application | Public hostname / path | Policy |
| --- | --- | --- |
| Sattva Odoo | `sattva.trilokventures.org` | Allow · Include · Emails ending in `@trilokventures.org` |
| Vault | `vault.trilokventures.org` | Allow · Include · Emails ending in `@trilokventures.org` |
| n8n editor | `n8n.trilokventures.org` | Allow · Include · IT emails only (start with `it.admin` / operators) |
| n8n webhooks | `n8n.trilokventures.org/webhook/*` | **Bypass** · Include · Everyone. HMAC (`n8n-webhook-hmac`) is the authenticator |

Do not put buyer/supplier personas on these hosts. `app.` stays the Vercel BFF.
Do not add Access or DNS for `auth.` or `upload.`.

## Fix (API)

A scoped token with `Access: Apps and Policies Edit` on the account:

```bash
export CF_API_TOKEN='***'          # never commit
export CF_ACCOUNT_ID='***'
export CF_ACCESS_IT_EMAILS='archneo@trilokventures.org'
node deploy/gcp/create-access-apps.mjs          # dry-run
node deploy/gcp/create-access-apps.mjs --apply  # POST
```

The script always sends `"allow_authenticate_via_warp": false`.

## Edge vs Access

A `403` with `cf-mitigated: challenge` and a **Just a moment…** body is Bot
Fight / WAF, not Access. Access redirects to `<team>.cloudflareaccess.com`.

After the four apps exist, an unauthenticated browser GET to
`https://sattva.trilokventures.org/web/login` must show the Access login
page (or an immediate IdP redirect), not raw Odoo.

`/web/database` and `/web/database/manager` must still 404 from Caddy **after**
Access succeeds. That is origin policy, not an Access deny.

## SSL

Zone encryption mode **Full (strict)** once the Origin CA is on Caddy
(`deploy/prod/certs/origin.pem`). Never Flexible. Confirm other proxied
origins in the zone before flipping zone-wide.

Path B employee hosts after Access (2026-08-23 cutover):

- `sattva.trilokventures.org/web/login` — Access, then Odoo
- `sattva.trilokventures.org/web/database/manager` — Caddy 404
- `vault.trilokventures.org` — Access, then Nextcloud
- `n8n.trilokventures.org` — Access (IT), then n8n editor
- `n8n.trilokventures.org/webhook/*` — Access Bypass (HMAC)

n8n owner account is still created in the editor UI (no owner secret in
AssetCo). Do not use the Cloudflare application installer.

## Stop list

- No wildcard A/AAAA `*` → VM
- No `app.` / apex / `www.` at the VM
- No Authenticated Origin Pulls, T2 mTLS, Keycloak, or `upload.` in this slice
- No Global API Key in git, Notion, or chat
