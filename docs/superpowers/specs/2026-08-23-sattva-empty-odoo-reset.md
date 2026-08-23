# Phase 3a T1 — empty Odoo reset (no demo dataset)

**Status:** Operating spec (does not edit the locked fabric)  
**Date:** 2026-08-23  
**Owner:** IPCo (scripts); Sattva Brokers OpCo (first live records)  
**Companion:** `2026-08-23-phase3a-t1-sor-init.md`

The production `sattva` database was created with Odoo demo data and later
gained extra Apps (Sales, Project, HR, Mass Mailing, `l10n_us`). Incremental
purge removed furniture partners, leads, POs, and posted moves, but left
furniture quotations, 44 demo products, US taxes, and those extra modules.

**Decision:** drop and recreate the Odoo database `sattva` with
`--without-demo=all`. Do **not** drop the `n8n` Postgres database or the
Nextcloud volume. Re-apply operator mailbox, `n8n.fabric`, company/CAD, and
fabric CRM stages. First counterparties stay human-created.

## What is destroyed / kept

| Store | Action |
| --- | --- |
| Postgres `sattva` | dump, drop, recreate empty |
| Odoo filestore `sattva` | delete leftover furniture attachments |
| Postgres `n8n` | **kept** (owner + imported `wf.*`) |
| Nextcloud volume | **kept**; delete only known Nextcloud *welcome* files (Manual.pdf, intro.mp4, …). Keep `/PCP/*`, `/Suppliers`, `/Clients` |
| AssetCo secrets | **kept** (`odoo-web-admin-password`, `odoo-n8n-api-key`) |

## Installed on the new DB

- `sattva_compliance` (pulls `base`, `purchase`, `contacts`, `crm`, `product`)
- `sale_management` (`--without-demo=all`) so quotes live in Odoo (fabric §3.1)
- Not installed: `website`, `website_sale`, `auth_oauth`, `stock`, `hr`,
  `mass_mailing`, `project`, `l10n_us`, `l10n_ca` (CA CoA stays operator-gated)

## After reset (required empty state)

- Company: Sattva Brokers / `base.ca` / `base.CAD`
- CRM stages: Discovery → … → Retention only
- uid 2 = `archneo@trilokventures.org` + `odoo-web-admin-password`
- `n8n.fabric` uid ≠ 2; `ODOO_N8N_UID` rewritten; n8n recreated
- Zero vendors/customers (beyond company), leads, POs, SOs, invoices, lots
- Zero furniture products
- PCP gate still blocks `pending`

## Command

```bash
sudo ./deploy/gcp/init-sor.sh --reset-odoo-empty          # counts only
sudo ./deploy/gcp/init-sor.sh --reset-odoo-empty --apply  # dump + drop + reinstall + A–E
```

`--reset-odoo-empty` and `--purge-odoo-demo` are mutually exclusive. Reset
replaces purge when the leftover surface is wider than xmlid-selected furniture
rows (extra Apps, quotations, product catalog, `l10n_us`).
