# Security checklist — exposing Sattva Odoo 18 publicly at `sattva.trilokventures.org`

> Companion to `README.md` (the DNS change plan). This file covers **hardening the Odoo app and the
> Cloudflare edge** before/while the `sattva` hostname goes public, plus a short PM/cost view.
>
> **Context from this repo (verify against current files before shipping):**
> `config/odoo.conf` currently ships a weak, committed `admin_passwd` and **omits** `list_db`,
> `dbfilter`, and `proxy_mode`. `docker-compose.yml` publishes Odoo on `8069` and hardcodes a DB
> password. All of the below assumes you fix these before public exposure.

---

## 0. Threat model in one line

Once `sattva` is reachable from the internet, **the Odoo database manager, the login form, and any
weak admin secret become internet-facing attack surface.** The goals: (1) make the DB manager
unreachable, (2) pin the app to exactly one database, (3) protect the login form, and (4) ensure you
can recover from compromise/loss via backups.

---

## 1. Odoo application hardening (`config/odoo.conf`)

Set these in `[options]`. Values shown are the target state for this deployment (`db` name assumed
to be `sattva` — `[verify the actual database name]`).

| Setting | Target | Why it matters |
| --- | --- | --- |
| `admin_passwd` | A **strong, unique, real** secret (24+ random chars), **not** committed to git | This is the **master password** that gates DB create/drop/backup/restore. The repo's current `ArchAdmin925` is weak and public in git history — **rotate immediately**. Inject via env/secret, not the tracked file. |
| `list_db` | `False` | Hides the database list on the login/manager screens. Stops attackers from enumerating DB names. |
| `dbfilter` | `^sattva$` | Forces Odoo to serve **only** the `sattva` DB and refuse any other. Prevents DB-guessing and cross-DB confusion. `[verify the DB name matches]`. Anchors (`^`/`$`) are required so it's an exact match. |
| `proxy_mode` | `True` | Tells Odoo to trust `X-Forwarded-*` headers from the reverse proxy/Cloudflare so it builds correct `https://` URLs and logs the real client IP. **Only enable when Odoo is actually behind a trusted proxy** (it will be, behind Cloudflare + your reverse proxy). |
| `dbfilter` + `list_db` together | as above | The DB manager UI (`/web/database/manager`) becomes effectively unusable to outsiders. |

**Also strongly recommended:**

- **Disable the database manager entirely in production.** With `list_db = False` and a strong
  `admin_passwd`, the manager routes are locked down; for defense-in-depth, block
  `/web/database/*` at the reverse proxy / Cloudflare (return 404/403) so create/drop/restore is
  never reachable from the internet.
- **`workers = N` + a real reverse proxy.** Run Odoo in multi-worker/`gevent` mode behind
  Nginx/Caddy (or the Cloudflare Tunnel ingress) rather than exposing the built-in dev server
  directly. Set `limit_time_real`, `limit_request`, etc. to sane values.
- **Don't publish `8069` to `0.0.0.0`.** In `docker-compose.yml` bind the port to `127.0.0.1`
  (e.g. `127.0.0.1:8069:8069`) so only the local reverse proxy / `cloudflared` can reach it. With
  **Path A (Tunnel)** you can drop the public port mapping entirely.
- **Rotate the DB password** that is currently hardcoded in `docker-compose.yml`
  (`sattva_db_secure_pass`) and move it to a secret/`.env` that is **git-ignored**.
- Set a proper `admin`-user experience: see §2.

> ⚠️ **These are documentation recommendations.** Per task scope this worker is not editing
> `odoo.conf`/`docker-compose.yml`; apply them in the deploy that serves `sattva`.

---

## 2. Application account hardening

- **Change the default admin user password** to a strong, unique value (the `admin_passwd` above is
  the *master* password; the `admin` **login** is separate and equally important).
- **Enable two-factor authentication (2FA/TOTP)** for every admin and privileged user
  (Settings → Users → *Two-factor authentication*). Install/enable the `auth_totp` capability.
- **Least privilege:** don't do day-to-day work as the super-admin; create scoped users/groups.
- **Disable signup** if not needed (Settings → *Sign up (external users)* = off; `auth_signup`
  restricted) so the public login page can't be used to self-register.
- **Audit installed users** and remove/disable demo or leftover accounts.

---

## 3. Cloudflare edge hardening (pairs with the proxied `sattva` record)

Because `sattva` is **proxied (orange cloud)** — see `README.md` §b/§c — you get edge controls for
free. Turn these on:

- **WAF managed rules:** enable the Cloudflare Managed Ruleset for the zone (or scoped to
  `host eq "sattva.trilokventures.org"`).
- **Rate-limit `/web/login`** (and `/web/session/authenticate`): e.g. **N failed POSTs per IP per
  minute → block/challenge for a period**. This is the single highest-value rule for Odoo — it
  blunts credential-stuffing/brute force. `[verify plan tier: advanced rate-limiting may require a
  paid plan; a WAF custom rule with a threshold is the fallback]`.
- **Bot Fight Mode / Super Bot Fight Mode:** enable to challenge obvious bots. ⚠️ Caveat: aggressive
  bot rules or JS challenges can interfere with **API/webhook/XML-RPC** access to Odoo — scope
  challenges to browser paths (`/web/login`, `/web`) and **exclude** any programmatic endpoints you
  rely on.
- **Block the DB manager at the edge:** a WAF custom rule — `if http.request.uri.path starts_with
  "/web/database" then Block` — as belt-and-suspenders with `list_db=False`.
- **Geo / ASN rules (optional):** if the user base is regional, challenge/deny traffic from
  unexpected geographies or hosting ASNs.
- **Always Use HTTPS + Full (strict) + min TLS 1.2** per `README.md` §c. Defer HSTS until stable.
- **Path B only:** keep the record **proxied** so the origin IP stays hidden, and lock the origin
  firewall to **only accept 443 from Cloudflare IP ranges** (Authenticated Origin Pulls is even
  better). **Path A (Tunnel)** avoids this entirely (no inbound ports).

---

## 4. Backups & recovery (DB + filestore)

Odoo state = **PostgreSQL DB** *and* the **filestore** (`/var/lib/odoo/filestore`, the
`odoo-web-data` volume here). A DB dump **without** the filestore loses attachments/images.

- **Automated daily logical DB backup:**
  `pg_dump -Fc -U odoo <dbname> > sattva_YYYYMMDD.dump` (run against the `db` container/volume).
- **Filestore backup:** snapshot/tar the `odoo-web-data` volume
  (`/var/lib/odoo/filestore/<dbname>`) at the same time as the DB dump so they're consistent.
- Alternatively use Odoo's built-in backup (`/web/database/backup`) to get a single zip containing
  **both** DB and filestore — but since you're **disabling** the DB manager on the public host, run
  this via a **trusted/internal** path or CLI, not from the internet.
- **Off-host + encrypted:** ship backups to object storage (e.g. R2/S3) encrypted at rest; keep
  ≥ 7 daily / 4 weekly copies (`[verify retention policy]`).
- **Test restores** on a scratch environment regularly — an untested backup is not a backup.
- **Secrets are not in backups:** store `admin_passwd`, DB password, API tokens in a secret manager,
  not in the repo.

---

## 5. Pre-exposure go/no-go checklist

- [ ] `admin_passwd` rotated to a strong secret, **removed from git-tracked config**.
- [ ] `list_db = False`, `dbfilter = ^sattva$`, `proxy_mode = True` set and verified.
- [ ] DB manager unreachable from the internet (config + edge rule).
- [ ] Odoo port not published publicly (bound to localhost / behind tunnel).
- [ ] Admin user password strong; **2FA enabled** for all privileged users; public signup off.
- [ ] Cloudflare WAF on; **rate-limit on `/web/login`**; bot rules scoped to browser paths.
- [ ] SSL/TLS **Full (strict)** + **Always Use HTTPS**; origin cert valid (Path B).
- [ ] Automated **DB + filestore** backups running, off-host, **restore tested**.
- [ ] Email regression check passed (MX/SPF/DKIM/DMARC unchanged — see `README.md` §e).

---

## 6. PM / cost view

**The one key decision: Path A (Cloudflare Tunnel preview) vs Path B (persistent host).**

| | **Path A — Tunnel (preview/quick)** | **Path B — Persistent host** |
| --- | --- | --- |
| What it is | `cloudflared` runs next to Odoo and dials **out** to Cloudflare; DNS is a proxied CNAME. | A long-lived server with a public IP; DNS is a proxied A record. |
| Setup effort | Low — no firewall/cert/IP work; `cloudflared tunnel route dns …` creates the record. | Medium — provision host, reverse proxy, origin cert, firewall lock-down. |
| Security posture | **Best default** — no inbound ports, origin IP fully hidden. | Good if origin firewall is locked to Cloudflare IPs + Origin CA cert. |
| Rough cost | **~$0 extra** — Cloudflare Tunnel is free; you still pay for wherever Odoo runs. | Cost of the always-on VM/host (e.g. a small cloud VM, ~low-tens of USD/mo `[verify with provider]`) + ops time. |
| Best when | Validating Sattva quickly, demos, staging, no need for a static IP. | Stable production with predictable IP, other services on the box, or tunnel not desired. |
| Trade-off | Depends on `cloudflared` process staying up (run it as a managed service/replicas for HA). | More moving parts to secure and patch (OS, proxy, cert renewal). |

**Recommended sequencing (lowest risk first):**

1. **Prep app hardening** (§1–§2) on the box that will serve `sattva` — do this **before** any DNS
   change so the app is safe the moment it's reachable.
2. **Snapshot the live zone** and confirm all Workspace records (`README.md` §a/§e). No email record
   is touched.
3. **Ship Path A (Tunnel)** first for the initial preview: add the single proxied CNAME, verify
   HTTPS + email regression, enable WAF/rate-limiting. Cheapest and safest to validate end-to-end.
4. **Only if a persistent, static-IP host is required**, migrate to **Path B**: stand up the host +
   Origin CA cert + firewall-lock to Cloudflare, then **swap the single `sattva` record** (CNAME →
   A). Rollback stays trivial (delete the one record) per `README.md` §d.
5. **Turn on backups** and run a **test restore** before declaring GA.
6. **Enable HSTS** only after HTTPS is proven stable, and keep `includeSubDomains` off unless every
   zone hostname is HTTPS-ready.

> Cost figures are indicative — `[verify current pricing with your cloud/Cloudflare plan]`.
> Cloudflare Tunnel and Origin CA certificates are free on all plans; advanced rate-limiting tiers
> may vary by plan.
