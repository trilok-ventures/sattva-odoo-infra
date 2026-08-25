# Sattva Brokers — employee procedures (features shipped so far)

**Audience:** sales, procurement, compliance, finance, logistics, IT  
**Apps:** Odoo `https://sattva.trilokventures.org`, vault `https://vault.trilokventures.org`  
**Login / groups:** `docs/runbooks/app-local-admin-and-roles.md`  
**Training fixtures only:** `docs/runbooks/training-counterparties.md`

This is the day-to-day SOP for fabric features that are on `main` (P0 lots + CoA, P1 sale gates, P2 credit / inbound lead / dossier, P3 #16 CoA GREEN hop). n8n never confirms a PO or SO and never releases a lot. RED PDFs stay in Nextcloud.

Cloudflare Access (`@trilokventures.org`) runs before every origin login.

---

## 0. Who does what

| Role | Odoo group | Does | Must not |
| --- | --- | --- | --- |
| Sales | Sales / `sales.exec` | Buyers, RFQs/SOs, FCL on draft SOs, CRM | Approve PCP, write GREEN product specs, set Net 60, release lots, write F/R credit |
| Procurement | Purchase users | Suppliers, RFQs/POs, lots | Confirm PO unless supplier PCP is `approved`; attach CoA PDFs to the lot |
| Compliance officer | `compliance.officer` | PCP / SFC / 3PL approve, GREEN specs, lot Release / Reject | Let n8n release a lot; treat `coa_pass` as available-for-sale |
| Finance manager | Accounting / `finance.manager` | Industry, F, R, Snapshot credit score, Net 60+, FCL on confirmed SOs | Ask n8n to post terms |
| Logistics | Inventory user | 3PL partner fields (with compliance) | Mark a 3PL as `supplier_rank` vendor |
| IT | Settings | HMAC webhooks, n8n import, vault folders | Put HMAC secrets in git, Vercel, or chat |

Service users `n8n.fabric` and `middleware.bff` are not human logins.

---

## 1. Open the apps

1. Pass Cloudflare Access with your `@trilokventures.org` mailbox.
2. Odoo: `https://sattva.trilokventures.org/web/login` — Email is `res.users.login` (operator mailbox after bind). Password is Secret Manager `odoo-web-admin-password` (IT retrieves; do not paste into chat).
3. Vault: `https://vault.trilokventures.org` — Nextcloud `admin` (or the bound mailbox) and `nextcloud-admin-password`. This password is **not** the Odoo password.
4. n8n editor (`https://n8n.trilokventures.org`) is IT-only. Sales and compliance do not need it.

Local Cloud VM is `http://localhost:8069` with `admin` / `admin`. Do not use that password on production.

---

## 2. Onboard a mill (supplier PCP)

**Sales / procurement**

1. Contacts → create a **company** (not a delivery contact as the vendor).
2. Set it as a vendor (`supplier_rank`). Leave **Buyer KYC** alone.
3. Contacts → open the partner → **Sattva Compliance**:
   - `Supplier PCP status` starts at `pending`.
   - Fill exporter pointers if known (Spices Board RCM, FSSAI, optional US FDA, steam sterilization, last audit date). PDFs do **not** go on the contact.
4. Save. Odoo queues a supplier-folder event. After n8n (or `process-queued-folder-events.sh`) runs, `Nextcloud Vault Path` is `/Suppliers/{Name}/Certificates/`.

**Compliance**

5. Vault: upload HACCP / BRC / sanitation PDFs under that Certificates folder. No public share links.
6. Review evidence. On the contact, set HACCP/BRC flags and `Supplier PCP status` to `review` then **`approved`** (or `blocked`).
7. Only `approved` unlocks Purchase **Confirm Order**. KYC on a buyer never unlocks a PO.

**Procurement — confirm a PO**

8. Purchase → New RFQ → vendor = mill → Confirm Order.
9. If status is not `approved`, Odoo shows **Compliance Gate Blocked** and names the PCP status. Fix the contact; do not ask IT to bypass.

Do not mark a 3PL as a vendor. That queues a mill folder and fires the PCP PO gate.

---

## 3. Onboard a buyer (KYC + SFC)

**Sales**

1. Contacts → create a **separate** company from the mill (do not dual-rank mill + buyer).
2. Set as customer. **Sattva Compliance → Buyer KYC** may stay `pending`. Completing KYC does **not** unlock PO or SO.
3. After the folder job, `Nextcloud client folder path` is `/Clients/{Name}/Onboarding/`.
4. Ask compliance to set **Buyer SFC**:
   - `buyer_sfc_status` must be **`active`** before any SO confirm.
   - Store the licence number. Licence PDFs stay in the client Onboarding folder.

Sale confirm reads the **commercial** partner (parent company), not a delivery contact.

---

## 4. Register an approved 3PL / forwarder

**Logistics + compliance**

1. Contacts → new company.
2. **Sattva Compliance → Logistics / 3PL**:
   - Check `is_logistics_partner`.
   - Leave `supplier_rank` at 0 (Odoo rejects a forwarder that is also a vendor).
   - Set CBSA bond / insurance **pointers** (text). Bond PDFs are not mill Certificates and have no `/Logistics/` folder yet.
   - Tick the Incoterms this forwarder actually supports: FOB, CIF, DAP. DDP is not offered.
3. Compliance sets `forwarder_status` to **`approved`** only after bond/insurance evidence is in the vault.

---

## 5. Set GREEN product specs

**Sales** may create the product (Sales → Products) and set crop / format / mesh label on **Sattva Catalog**.

**Compliance only** writes GREEN thresholds:

- Spec moisture max %
- Spec mesh required
- Salmonella must be absent
- Spec TPC max
- Spec pyruvic min (pyruvic is required automatically when crop is onion)

Copy those same numbers into the CoA webhook or sidecar. Unset moisture `0` means “no live spec yet” — do not confirm lots against empty specs.

---

## 6. Create a brokerage lot (not inventory)

Lots are `sattva.brokerage.lot` under **Contacts → Sattva Compliance → Brokerage Lots**. Sattva does not hold stock. Do not use `stock.lot`.

**Procurement / compliance**

1. New lot → lot number + mill (supplier). Optional link to the PO.
2. Save. State is always **Quarantine**. You cannot type GREEN CoA fields or change state on the form.
3. Do not attach a CoA PDF to chatter. Odoo rejects lot attachments. Upload the PDF to the mill Certificates folder in the vault.

`coa_pass` on the list is the GREEN compare only. It is **not** available-for-sale.

---

## 7. Record CoA numbers (GREEN compare)

Two operator paths write the same Odoo helper `apply_coa_green`. Both need IT HMAC `N8N_WEBHOOK_HMAC` (`x-sattva-webhook-hmac`). n8n logs are set to save no execution data.

### 7a. Vault the PDF first

1. Compute the PDF hash on a workstation (PDF never goes to n8n or Hugging Face):

```bash
sha256sum L-001-coa.pdf
```

2. Upload `L-001-coa.pdf` to `/Suppliers/{Mill}/Certificates/` in Nextcloud.

### 7b. Path A — paste GREEN JSON (`wf.coa.verify` or `wf.coa.ocr`)

IT / compliance POST to `https://n8n.trilokventures.org/webhook/coa-verify` or `/webhook/coa-ocr` with only these keys:

`lot_id`, `filename` (basename, e.g. `L-001-coa.pdf`), `sha256` (64 hex), `moisture_pct`, `mesh_pass`, `spec_moisture_max`, `spec_mesh_required`, `salmonella_absent`, `spec_salmonella_required`, `tpc_cfu`, `spec_tpc_max`, `pyruvic_umol`, `spec_pyruvic_required`, `spec_pyruvic_min`.

Unknown keys, `bytes`, `pdf`, `path`, `file_bytes`, `vault_href`, or `nextcloud_folder_path` fail closed.

Use the product’s spec fields for the `spec_*` values. `lot_id` is the Odoo brokerage lot database id (open the lot; the URL has `id=`).

After a pass: lot stays **quarantine**, `coa_pass` is true, filename + hash show on the form.  
After a fail: lot stays quarantine, `coa_pass` is false, a CAPA activity is created for a human officer.

### 7c. Path B — GREEN sidecar (when `wf.coa.ocr.sidecar` is imported)

1. Next to the PDF, upload `{filename}.green.json` (example `L-001-coa.pdf.green.json`) in the **same** Certificates folder.
2. The JSON body is the same allowlist as 7b. `filename` must be the PDF basename. `lot_id` must match the lot you will trigger. `sha256` is the PDF hash from 7a (not re-hashed by n8n).
3. IT POST `{ "lot_id": 12, "sidecar_basename": "L-001-coa.pdf.green.json" }` to `/webhook/coa-ocr-sidecar`. Do not send a vault path. Odoo resolves `/Suppliers/…/Certificates/`.
4. n8n GETs only that `.green.json` (small JSON). It must not GET the PDF.

Hugging Face is **off** unless IT sets a token later. Employees never send PDFs to HF.

---

## 8. Release or reject a lot

**Compliance officer only** (button hidden for other groups).

1. Open the lot. Confirm `coa_pass` is true and `coa_sha256` is 64 hex.
2. **Release for sale** → state **Available for sale**. Buyers and sales may treat this as the release flag — not `coa_pass` alone.
3. **Reject lot** if the mill/CoA is not acceptable. State **Rejected**.

n8n cannot click these buttons. Quarantine is the default. A compare pass without Release is still not for sale.

---

## 9. Confirm a sale order

Need the Sales app menus (Phase 3a T1 `sale_management` ops install if quotes are missing).

**Sales — every confirm**

1. Customer = buyer whose commercial partner has **SFC Active**.
2. Set **Sattva Incoterm** to FOB, CIF, or DAP (no DDP).
3. Set **Approved forwarder** to a logistics partner (`approved`, not a mill).
4. Forwarder Incoterm ticks must include the order term.
5. Set **FCL count** on the draft if you know containers (feeds credit volume later).
6. Confirm. If anything is missing, **Compliance Gate Blocked** names the field.

**First SO for that buyer**

7. Set **Linked PO intent** to a **draft** PO whose vendor is a PCP-**approved** mill (not a 3PL). Do not confirm that PO from n8n. Human procurement confirms the PO only after PCP is approved.

**Credit tier 4**

8. If **Sattva Compliance → Credit** shows tier **4**, Incoterm must be **FOB** or confirm is blocked.

Creating the SO queues `/Clients/{Buyer}/Orders/{SO}/` in the vault. Path appears on the SO **Sattva Compliance** tab after n8n MKCOL.

---

## 10. Credit score and payment terms

**Finance manager** (Accounting Manager), on the **commercial** buyer:

1. Set `industry_sector` (food service / retail / manufacturing / other).
2. Optionally set manual **F** (financial) and **R** (Paydex stand-in). Defaults are 50. No live D&B.
3. Click **Snapshot credit score**. P comes from posted customer invoices; V from confirmed SO FCL; M from industry.
4. Total **S** and **credit_risk_tier** update. Tier 4 (< 50) is FOB-only on confirm.

**Sales**

- May use Immediate / Net 30.
- Cannot invent Net 60+ terms. Finance assigns Net 60 on the partner; sales may copy that term onto the SO.
- Cannot change FCL on an already confirmed SO (finance can correct).

Score history: Contacts → Sattva Compliance → payment score list (append-only snapshots).

---

## 11. Inbound technical-content lead

Public page: mocks site `inbound-lead.html` (marketing/mocks Vercel project — not the operations BFF).

**Marketing / sales (preview)**

1. Open the form. Fill contact + GREEN family (`ONION` / `GARLIC` / `CHILLI` / `OTHER`), FCL band, topic (`sfcr` / `coa_spec` / `steam_sterilization`).
2. Default is local validate + preview. The static page does not store leads on Vercel.

**IT — live ingest (operator only)**

3. POST the same six keys to `https://n8n.trilokventures.org/webhook/lead-inbound` with dedicated header HMAC `N8N_LEAD_INBOUND_HMAC` (not the shared CoA webhook secret).
4. Odoo creates a **CRM lead** (not a Keycloak user). GREEN score is written from a hash of the email, not the raw address.
5. Sales work the lead in CRM → Pipeline. Do not rebuild leads in Notion or a spreadsheet.

---

## 12. Index the order dossier (hashes only)

After BL / packing / CoA files are in the **order** vault folder (`/Clients/{Buyer}/Orders/{SO}/`):

**IT / compliance**

1. POST `{ "sale_order_id": <id>, "lot_id": <optional> }` to `/webhook/dossier-index` with `N8N_WEBHOOK_HMAC`.
2. n8n lists names, hashes file bytes **in memory**, and writes filename + sha256 + vault path onto the SO (and lot if linked).
3. Open the SO **Sattva Compliance** tab or the lot form to read the index. There is no download button. If a CoA filename’s hash disagrees with the lot’s `coa_sha256`, a compliance activity opens. Lot state does not change.

This is not a digitally signed pack.

---

## 13. What employees must never do

- Confirm a PO for a non-`approved` mill, or ask n8n to confirm / release.
- Treat `coa_pass` or a hashed CoA as available-for-sale.
- Attach CoA PDFs to Odoo chatter, email them to Hugging Face, or put vault URLs in Vercel / `NEXT_PUBLIC_` env.
- Create public Nextcloud share links for PCP or CoA files.
- Dual-rank a mill as a buyer, or a 3PL as a vendor.
- Offer DDP until OpCo writes an Importer-of-Record policy.
- Store HMAC secrets in the mocks HTML, git, or Slack.

---

## 14. Not on production `main` yet

Do not train the floor on these until they merge and IT imports/activates them:

| Feature | What it will be | Branch / note |
| --- | --- | --- |
| GREEN sidecar hop | §7c | `wf.coa.ocr.sidecar` — import after that slice lands |
| Buyer GREEN lot board | Read-only lots + officer release in `middleware/` | Live BFF stays off until Keycloak unlock; mock/`?persona=` is not production auth |
| Replenishment nudge | CRM activity from last SO + ocean transit | Not Odoo inventory |

Thought-leadership / SFCR explainers stay on the mocks site + Notion KB. No Ghost, Chatwoot, or second CRM.

---

## 15. Quick “happy path” checklist

1. Mill contact → vault Certificates → officer **PCP approved**.
2. Buyer contact → SFC **active**; 3PL **approved** with matching Incoterms.
3. Product → officer GREEN specs.
4. Brokerage lot → vault CoA PDF → GREEN webhook or sidecar → `coa_pass`.
5. Officer **Release for sale**.
6. First SO: Incoterm + forwarder + linked PCP-approved PO intent → Confirm.
7. Finance snapshots credit when invoices exist; tier 4 stays FOB.
8. After files land in the SO folder, IT runs dossier index.

If any confirm dialog says **Compliance Gate Blocked**, fix the named partner/lot field. Do not disable the addon.
