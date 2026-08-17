# DNS change plan — add employee hostnames without breaking Google Workspace email

> **Phase 3a default (Path B):** add proxied A records for `sattva`, `vault`, and
> `n8n` pointing at the reserved `sattva-prod-ipv4` address. Repeat the same
> MX/SPF safety rules for each name. Do not touch apex mail records. Do not
> point `app.` at the VM (Vercel BFF). See `deploy/gcp/README.md` §4.
>
> **Scope of the original checklist below:** add `sattva` to the Cloudflare-managed
> zone `trilokventures.org` so it serves Odoo over HTTPS — **without
> touching any record that Google Workspace relies on for email/workspace features.**
>
> **Zone:** `trilokventures.org` (DNS managed in Cloudflare; domain purchased via Google, used for
> Google Workspace).
>
> **Golden rule:** Adding a **subdomain** record (`sattva`) never affects the **apex** (`@`) mail
> flow. MX, SPF, DKIM, DMARC and site-verification records live on the apex or on other hostnames
> (`_dmarc`, `google._domainkey`, …). As long as you only **add** the single `sattva` record and
> **do not edit/delete** anything else, email cannot break.

---

## ⚠️ This plan was written without live zone access

This worker has **no Cloudflare or Google credentials** and **cannot read the live zone**. Every
value that depends on the actual current records is marked **`[verify in Cloudflare dashboard]`**.
Before executing, the operator must read the live zone (Cloudflare dashboard → **DNS → Records**, or
the API) and confirm each flagged item.

Quick read of the live zone via API (read-only token with `Zone.DNS:Read` is enough):

```bash
# Requires: a scoped, read-only token (Zone.DNS:Read) and the zone id.
# DO NOT paste a real token into source control. Use an env var.
export CF_API_TOKEN='***'          # scoped token, never commit
ZONE_NAME='trilokventures.org'

ZONE_ID=$(curl -s -H "Authorization: Bearer ${CF_API_TOKEN}" \
  "https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"][0]["id"])')

# Dump every record so you can see exactly what MUST be preserved:
curl -s -H "Authorization: Bearer ${CF_API_TOKEN}" \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?per_page=200" \
  | python3 -m json.tool
```

You can also read specific records from a shell that has `dig`:

```bash
dig +short MX   trilokventures.org
dig +short TXT  trilokventures.org           # SPF lives here (v=spf1 ...)
dig +short TXT  google._domainkey.trilokventures.org   # DKIM
dig +short TXT  _dmarc.trilokventures.org    # DMARC
dig +short      sattva.trilokventures.org    # should be EMPTY before the change
```

---

## a. Records that MUST be preserved for Google Workspace

These records make email and Workspace features work. **They are unrelated to `sattva`** and must be
left exactly as-is. The exact values differ per tenant, so **read them from the dashboard and record
them here before making any change** (a snapshot is your rollback safety net).

| Purpose | Type | Name / Host | Expected value (verify live) | Notes |
| --- | --- | --- | --- | --- |
| **Inbound mail (MX)** | `MX` | `@` (apex) | **Modern:** `smtp.google.com` (priority `1`).<br>**Legacy (pre-2023 tenants):** `ASPMX.L.GOOGLE.COM` (1), `ALT1.ASPMX.L.GOOGLE.COM` (5), `ALT2.ASPMX.L.GOOGLE.COM` (5), `ALT3.ASPMX.L.GOOGLE.COM` (10), `ALT4.ASPMX.L.GOOGLE.COM` (10). | `[verify in Cloudflare dashboard]` which set is present. **Never mix both sets.** MX records **cannot** be proxied (they point to mail servers, not HTTP). |
| **SPF (sender policy)** | `TXT` | `@` (apex) | `v=spf1 include:_spf.google.com ~all` | `[verify in Cloudflare dashboard]` — there must be **exactly one** SPF (`v=spf1`) TXT at the apex. If other senders exist (CRM, billing, newsletters) they appear as extra `include:` mechanisms in this same record. |
| **DKIM (signing key)** | `TXT` | `google._domainkey` | `v=DKIM1; k=rsa; p=<long base64 public key>` | `[verify in Cloudflare dashboard]`. Selector is `google` by default. This is a long value; do not reflow/truncate it. |
| **DMARC (policy + reports)** | `TXT` | `_dmarc` | e.g. `v=DMARC1; p=none; rua=mailto:...` (policy may be `quarantine`/`reject`) | `[verify in Cloudflare dashboard]`. |
| **Google site verification** | `TXT` | `@` (apex) | `google-site-verification=<token>` | `[verify in Cloudflare dashboard]`. Removing this can drop domain ownership/verification. There may be more than one. |
| **Workspace CNAMEs (optional/legacy)** | `CNAME` | e.g. `mail`, `calendar`, `drive`, `sites` | `ghs.googlehosted.com` (typical for legacy custom URLs) | `[verify in Cloudflare dashboard]` — may or may not exist. Preserve whatever is present. |

**Key point:** none of the above live on `sattva`. Adding `sattva` does not read, change, or shadow
any of them.

---

## b. The exact record to ADD

Add **one** record for `sattva`, choosing the row that matches the delivery path selected by the
infra workers. Do **not** add both.

### Path A — Cloudflare Tunnel (proxied CNAME)

| Field | Value |
| --- | --- |
| Type | `CNAME` |
| Name | `sattva` (Cloudflare shows FQDN `sattva.trilokventures.org`) |
| Target | `<tunnelUUID>.cfargotunnel.com` — `[verify: get the tunnel UUID from cloudflared / the Zero Trust dashboard]` |
| Proxy status | **Proxied (orange cloud)** — required. A `cfargotunnel.com` target **only** resolves through Cloudflare's proxy; DNS-only will not work. |
| TTL | `Auto` (TTL is not user-editable while proxied) |

> Tip: `cloudflared tunnel route dns <TUNNEL_NAME> sattva.trilokventures.org` creates this exact
> proxied CNAME for you.

### Path B — Persistent host (proxied A, optional AAAA)

| Field | Value |
| --- | --- |
| Type | `A` |
| Name | `sattva` |
| IPv4 address | `<origin IPv4>` — `[verify: the host's public IP]` |
| Proxy status | **Proxied (orange cloud)** — recommended (hides origin IP, gives WAF/rate-limiting/edge TLS). |
| TTL | `Auto` while proxied. If you must run **DNS-only** temporarily (e.g., to issue an origin cert via HTTP-01), use a **short TTL like `120`** (2 min) so you can flip back quickly. |

Optional IPv6:

| Field | Value |
| --- | --- |
| Type | `AAAA` |
| Name | `sattva` |
| IPv6 address | `<origin IPv6>` — `[verify: only add if the host has a real, reachable IPv6]` |
| Proxy status | **Proxied (orange cloud)** |
| TTL | `Auto` |

**Why proxying `sattva` is safe and does not touch mail flow**

- Proxying is a **per-record, HTTP(S)-only** feature. It changes how the edge answers requests for
  `sattva` (returns Cloudflare anycast IPs, terminates TLS, applies WAF). It has **zero** effect on
  `MX`/`TXT` records or on the apex.
- **MX / SPF / DKIM / DMARC cannot even be proxied** — they are not HTTP records, so Cloudflare
  leaves them DNS-only. Editing `sattva` never rewrites them.
- Mail routing is decided by the recipient's resolver reading the **apex MX**. A subdomain A/CNAME
  is invisible to that lookup.

---

## c. Cloudflare SSL/TLS configuration for the subdomain

Cloudflare's SSL/TLS **encryption mode** is set per **zone**, so confirm the current zone mode
before changing it — `[verify in Cloudflare dashboard → SSL/TLS → Overview]`. The apex/other
records already work under the current mode, so prefer a mode that keeps them working.

Recommended settings:

| Setting | Recommendation | Why |
| --- | --- | --- |
| **Encryption mode** | **Full (strict)** | Encrypts edge↔origin **and** validates the origin certificate. Prevents downgrade/interception. Requires a valid cert on the origin (see per-path note). If the zone is currently on plain **Full** or **Flexible**, `[verify]` that moving to **Full (strict)** won't break other origins in the zone before switching zone-wide. |
| **Always Use HTTPS** | **On** | Redirects any `http://sattva…` to `https://`. Zone-wide and safe (only affects HTTP requests). |
| **Automatic HTTPS Rewrites** | On | Avoids mixed-content by upgrading in-page `http://` asset links. |
| **Minimum TLS version** | 1.2 (or 1.3) | Drops legacy TLS. |
| **HSTS** | **Enable with caution — later** | HSTS forces browsers to use HTTPS for the host (and, if `includeSubDomains` is set, for **all** of `trilokventures.org`). ⚠️ Do **not** enable `includeSubDomains`/`preload` casually: it can make **every** subdomain HTTPS-only and is hard to undo (browsers cache it for `max-age`). Turn HSTS on only after HTTPS is confirmed stable on `sattva`, and keep `includeSubDomains` **off** unless every hostname in the zone is HTTPS-ready. |

**How SSL/TLS pairs with each delivery path**

- **Path A (Tunnel):** `cloudflared` makes an **outbound, mutually-authenticated TLS** connection to
  Cloudflare, so origin TLS is handled by the tunnel itself — you do **not** expose an inbound port
  or manage a public origin cert. **Full (strict)** works cleanly; point the tunnel ingress at your
  local Odoo (`http://localhost:8069` or the container) and Cloudflare serves a valid edge cert for
  `sattva.trilokventures.org`.
- **Path B (Host):** the origin must present a **valid certificate** for **Full (strict)** to pass.
  Two good options:
  1. **Cloudflare Origin CA certificate** (recommended) — free 15-year cert issued by Cloudflare,
     trusted **only** by the Cloudflare edge. Install it on the Odoo reverse proxy (e.g. Nginx/Caddy
     in front of `8069`). Pairs perfectly with **Full (strict)** and the proxied A record.
  2. A publicly-trusted cert (e.g. Let's Encrypt). If you issue via HTTP-01 you may need the record
     **DNS-only** briefly (use the short TTL from §b), then re-enable the orange cloud. DNS-01 avoids
     that.

> Regardless of path, `edge` TLS for visitors is always served by Cloudflare for the proxied
> hostname, so browsers see a valid `sattva.trilokventures.org` certificate automatically.

---

## d. DO NOT TOUCH list + rollback

### 🚫 DO NOT TOUCH (leave byte-for-byte unchanged)

- **Apex `MX`** (`smtp.google.com` **or** the `ASPMX`/`ALT*` set) — `[verify which]`.
- **Apex SPF `TXT`** (`v=spf1 include:_spf.google.com ~all`).
- **DKIM `TXT`** at `google._domainkey`.
- **DMARC `TXT`** at `_dmarc`.
- **Google site-verification `TXT`** at apex (`google-site-verification=…`).
- Any existing **Workspace CNAMEs** (`mail`, `calendar`, `drive`, `sites` → `ghs.googlehosted.com`).
- The zone's existing **SSL/TLS encryption mode** and any existing page rules — only change these
  intentionally per §c after verifying impact on other hostnames.

You are only ever **adding** the single `sattva` record. If a UI step ever asks you to edit or delete
anything in the list above, **stop**.

### ↩️ Rollback plan (single-record, non-destructive)

Because the change is additive, rollback is trivial and cannot affect email:

1. Cloudflare dashboard → **DNS → Records** → find the `sattva` record you added.
2. **Delete only that one `sattva` record** (the CNAME for Path A, or the A/optional AAAA for Path
   B). Do **not** touch anything else.
3. If you enabled **Always Use HTTPS**, **HSTS**, or changed the **encryption mode** *for this
   change*, revert those toggles to their pre-change values (recorded in your snapshot). Leave them
   if they were already set that way.
4. Verify: `dig +short sattva.trilokventures.org` returns empty; `dig +short MX trilokventures.org`
   is unchanged from your snapshot.

API rollback (delete the single record by id):

```bash
# Find the sattva record id:
REC_ID=$(curl -s -H "Authorization: Bearer ${CF_API_TOKEN}" \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=sattva.trilokventures.org" \
  | python3 -c 'import sys,json;r=json.load(sys.stdin)["result"];print(r[0]["id"] if r else "")')

curl -s -X DELETE -H "Authorization: Bearer ${CF_API_TOKEN}" \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${REC_ID}"
```

---

## e. Operator checklist

### Pre-flight

1. Decide the delivery path with the infra team: **A (Tunnel)** or **B (Host)**.
2. Read the live zone (dashboard or API from the top of this doc) and **snapshot every record**
   (screenshot or save the JSON dump). This is your rollback baseline.
3. Confirm and fill in each `[verify in Cloudflare dashboard]` value above — especially the **MX
   set**, **SPF**, **DKIM**, **DMARC**, and (Path A) the **tunnel UUID** or (Path B) the **origin
   IP** and **origin cert** plan.
4. Confirm `sattva.trilokventures.org` currently resolves to **nothing** (no accidental existing
   record).

### Make the change (dashboard)

5. Cloudflare → **DNS → Records → Add record**.
6. Enter exactly the row from §b for the chosen path. Set **Proxy status = Proxied (orange cloud)**.
   Leave TTL on **Auto**.
7. Save. **Do not modify any other record.**
8. Cloudflare → **SSL/TLS**: confirm/set **Full (strict)**, turn on **Always Use HTTPS**
   (§c). Defer HSTS.
9. **Path B only:** ensure the origin presents a valid cert (Cloudflare Origin CA cert installed on
   the reverse proxy) so **Full (strict)** passes.

### Verify

10. `dig +short sattva.trilokventures.org` → returns Cloudflare proxy IPs (proxied) ✅.
11. `curl -I https://sattva.trilokventures.org/web/login` → `200`/`303` with a valid TLS cert ✅.
12. **Email regression check** (must be identical to snapshot):
    - `dig +short MX trilokventures.org`
    - `dig +short TXT trilokventures.org` (SPF unchanged)
    - `dig +short TXT google._domainkey.trilokventures.org` (DKIM unchanged)
    - `dig +short TXT _dmarc.trilokventures.org` (DMARC unchanged)
    - Send a test email to/from a Workspace mailbox and confirm delivery.
13. If anything is wrong, execute the **rollback** in §d.

### Equivalent API call (template only — never commit a real token)

Use a **scoped** token with **`Zone.DNS:Edit`** limited to the `trilokventures.org` zone.

**Path A — proxied CNAME to the tunnel:**

```bash
curl -s -X POST \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  --data '{
    "type": "CNAME",
    "name": "sattva",
    "content": "<tunnelUUID>.cfargotunnel.com",
    "proxied": true,
    "ttl": 1,
    "comment": "Sattva Odoo 18 via Cloudflare Tunnel"
  }'
```

**Path B — proxied A record to the origin:**

```bash
curl -s -X POST \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  --data '{
    "type": "A",
    "name": "sattva",
    "content": "<origin IPv4>",
    "proxied": true,
    "ttl": 1,
    "comment": "Sattva Odoo 18 origin host"
  }'
```

> `ttl: 1` means **Auto** in the Cloudflare API (required while `proxied: true`). Optional AAAA for
> Path B is the same body with `"type":"AAAA"` and an IPv6 `content`. Never hardcode a token — read
> it from `CF_API_TOKEN` and keep it out of git.

---

## Path A vs Path B — quick decision aid

| | **Path A — Tunnel** | **Path B — Host** |
| --- | --- | --- |
| DNS record | Proxied **CNAME** → `<uuid>.cfargotunnel.com` | Proxied **A** (+opt AAAA) → origin IP |
| Inbound ports open on origin | **None** (outbound-only) | 443 (behind Cloudflare) |
| Origin cert management | Handled by tunnel | Need Origin CA / LE cert |
| Origin IP exposure | Fully hidden | Hidden while proxied |
| Best for | Quick/secure preview, no static IP | Long-lived box with a stable IP |

See `security-checklist.md` for the full hardening + PM/cost view.
