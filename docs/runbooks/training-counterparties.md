# Training counterparties — field and endpoint walkthrough

Login: operator mailbox + `odoo-web-admin-password` on `https://sattva.trilokventures.org`.  
Vault: `https://vault.trilokventures.org` as Nextcloud `admin`. Folder MKCOLs land on **`n8n.vault`** until Group Folders land (T1 two-root drift).  
Do not approve the TRAINING supplier. Do not upload COA PDFs.

## Sample rows

| Kind | Name | Where |
| --- | --- | --- |
| Supplier | `TRAINING Onion Packhouse` | Contacts → Vendors → Sattva Compliance |
| Client | `TRAINING Canadian Buyer` | Contacts → Customers → Sattva Compliance |
| Product | `TRAINING Onion Flake` | Sales → Products → Sattva Catalog |
| Lead | `TRAINING Buyer Discovery` | CRM → Pipeline (Discovery) |

## Data points on the supplier

| Field | Training value | Notes |
| --- | --- | --- |
| `name` | TRAINING Onion Packhouse | Label, not a live packhouse |
| `supplier_rank` | 1 | Queues `supplier_folder_requested` |
| `supplier_pcp_status` | `pending` | Only `approved` unlocks `button_confirm` |
| `risk_band` | `medium` | Default |
| `haccp_certified` | false | Officer sets after vault evidence |
| `brc_certified` | false | Same |
| `nextcloud_folder_path` | `/Suppliers/TRAINING_Onion_Packhouse/Certificates/` | Written by n8n `set_partner_path` |
| `buyer_kyc_status` | `pending` | Unused for PO |

## Data points on the client

| Field | Training value | Notes |
| --- | --- | --- |
| `name` | TRAINING Canadian Buyer | Separate partner (do not dual-rank) |
| `customer_rank` | 1 | Queues `buyer_folder_requested` |
| `buyer_kyc_status` | `pending` | Completing KYC must **not** unlock PO |
| `nextcloud_client_folder_path` | `/Clients/TRAINING_Canadian_Buyer/Onboarding/` | n8n `kind=client` |
| `supplier_pcp_status` | `pending` | Present on all partners; ignore on buyers |

## Data points on the catalog row

| Field | Training value |
| --- | --- |
| `sattva_crop` | onion → `product_family_code=ONION` |
| `sattva_format` | flake |
| `sattva_mesh_label` | empty |
| `spec_moisture_max` | 0 (unset) |
| `spec_mesh_required` | false |

Sales can create the row. Only a compliance officer may set spec thresholds.

## Endpoints — how to demo each

1. **Folder bus (live after `--apply`)**  
   Odoo queues two `sattva.fabric.event` rows (`queued`). n8n `wf.supplier.folder` and `wf.buyer.onboard.folder` MKCOL then `set_partner_path`. If the 5-minute poll no-ops, run `sudo ./deploy/gcp/process-queued-folder-events.sh` (same RPC + MKCOL, no PCP write). Event `state` becomes `processed`. Folders land on the **`n8n.vault`** home until Group Folders.

2. **PCP gate (do not keep the PO)**  
   Purchase → New RFQ → vendor `TRAINING Onion Packhouse` → Confirm Order. Expect **Compliance Gate Blocked**. Cancel/discard the RFQ. Do not set the vendor `approved` to “make the demo work”.

3. **KYC is not approve**  
   On the buyer, KYC may stay `pending`. Even `complete` does not change `button_confirm`.

4. **GREEN lead score**  
   `POST /webhook/lead-score` with HMAC and allowlisted keys only (`hashed_partner_id`, `stage_rank`, `days_in_stage`, `product_family_code`, `order_count`, optional `lead_id`). No names, emails, or PDFs. Writes `sattva_green_score` / `sattva_lead_qualified`.

5. **Do not demo with live RED or money**  
   `wf.coa.verify` needs a real vault object later. `wf.order.handoff` may create a **draft** PO via `create_po_intent` — skip on this fixture. `wf.notify.role` creates a `mail.activity` — optional, not seeded.

## Archive before first live PO

Contacts → open each TRAINING partner → Action → Archive. Archive the TRAINING product and lead the same way.
