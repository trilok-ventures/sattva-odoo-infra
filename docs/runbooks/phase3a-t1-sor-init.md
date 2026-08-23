# Phase 3a T1 — initialize Odoo / Nextcloud / n8n (no Keycloak)

Applies `docs/superpowers/specs/2026-08-23-phase3a-t1-sor-init.md` on
`sattva-prod-vm`. Seeds **config + empty vault trees + service users only**.

Prerequisite: operator can log into Odoo
(`docs/runbooks/app-local-admin-and-roles.md`). Compose is up.

## On the VM

```bash
cd /opt/sattva
# Until merged: sudo git -C /opt/sattva fetch origin cursor/sor-init-required-state-81b6
# sudo git -C /opt/sattva checkout cursor/sor-init-required-state-81b6
sudo ./deploy/gcp/init-sor.sh
```

If the `sattva` DB still has Odoo demo or extra Apps (Sales demo quotations,
furniture products, HR, Mass Mailing, `l10n_us`), **reset empty** rather than
chasing xmlids. Dry-run first; `--apply` dumps `sattva` only (not n8n, not
Nextcloud), drops that database, and reinstalls `sattva_compliance` +
`sale_management` with `--without-demo=all`:

```bash
sudo ./deploy/gcp/init-sor.sh --reset-odoo-empty          # counts only
sudo ./deploy/gcp/init-sor.sh --reset-odoo-empty --apply  # dump + drop + A–E
```

Narrower furniture-row purge (when the module set is already clean):

```bash
sudo ./deploy/gcp/init-sor.sh --purge-odoo-demo          # counts only
sudo ./deploy/gcp/init-sor.sh --purge-odoo-demo --apply  # dump + purge + A–E
```

Optional later flags (not default):

```bash
sudo ./deploy/gcp/init-sor.sh --with-sales      # sale_management
sudo ./deploy/gcp/init-sor.sh --with-ca-coa     # l10n_ca after you accept a CA CoA
```

Keycloak flags are refused.

## What you should see

| Check | Expect |
| --- | --- |
| Settings → Companies | Sattva Brokers, Canada, CAD |
| CRM stages | Discovery, Proposal, Compliance Review, Contract, Execution, Retention |
| Users | uid 2 operator; `n8n.fabric` without Settings |
| `deploy/prod/.env` | `ODOO_N8N_UID` is the fabric uid, not `2` |
| vault → Files | empty `/PCP/*`, `/Suppliers`, `/Clients` for `admin` and `n8n.vault` |
| n8n Workflows | six `wf.*` imported from git, save-data none |
| Contacts / Purchase / Accounting | no synthetic counterparties, POs, or invoices |

## Do not

- Create Riverbank / Example Foods / demo buyers on `sattva.`
- Copy `nextcloud-admin-password` onto Odoo
- Set `FABRIC_MODE=live`
- Deploy Keycloak / `auth.`
- Confirm a PO to “test” the gate against a fake approved supplier

First real supplier: create a vendor in Odoo (`pending`). n8n MKCOLs
`/Suppliers/{name}/Certificates/`. Compliance approves after vault evidence.
