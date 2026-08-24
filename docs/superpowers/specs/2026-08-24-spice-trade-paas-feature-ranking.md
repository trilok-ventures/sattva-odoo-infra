# Spice Trade PaaS feature ranking (feasibility × implement priority)

**Status:** Proposed backlog ranking (does not edit the locked fabric)  
**Date:** 2026-08-24  
**Owner:** IPCo (software sequence); Sattva Brokers OpCo (ops gates)  
**Repo:** `trilok-ventures/sattva-odoo-infra`  
**Input:** uploaded *Enterprise Traceability and B2B Brokerage Architecture for Dehydrated Indian Spices in North America* (`Spice_Trade_PaaS_Architecture___3PL_Integration_4653.PDF`)  
**Companions:** locked fabric `2026-08-13-sattva-brokers-system-fabric-design.md`, architecture `2026-08-14-integrated-system-architecture.md`. Lot/quarantine is fabric §5.1 “specified, not built”; do not require other dated T1 specs to read this ranking.

This document extracts candidate features from the PaaS/3PL paper and ranks them for **this repo**. Locked fabric wins every conflict. A high score in the paper is not a grant to add a tool, a second database, or an n8n confirm path.

---

## 1. How ranking works

Each item is scored on two axes, then ordered by **implement now → later → never-as-written**.

| Axis | Meaning in this fabric |
| --- | --- |
| **Feasibility** | Can it ship as Odoo fields/gates + n8n pass-through + Nextcloud files, without a new SoR, without Keycloak, and without n8n calling `button_confirm`? |
| **Priority** | Stop list (fabric §3.6): closes a deal, reduces CFIA/SFCR risk, or shortens the cash cycle. Phase gates still apply (lot model before buyer lot UI; Keycloak after Phase 3a T1 acceptance). |

**Feasibility labels**

- **High** — extend existing addon/workflows; no new runtime.
- **Medium** — needs a dated implementation plan and one new Odoo model or `sale_management`, still inside the fabric.
- **Low** — blocked by phase, missing SoR objects, or external paid APIs.
- **Reject** — second SoR, new marketing CRM, n8n as order SoR, RED to Vercel/HF, or Keycloak before unlock.

Paper constructs that name parallel Postgres tables (`clients`, `suppliers`, `freight_forwarders`, `orders`, `payment_scores`) **map onto Odoo**, never a sidecar schema (fabric §3.1, §12).

---

## 2. Current baseline (do not rebuild)

Already in `addons/sattva_compliance` / `n8n/workflows/`:

- Supplier PCP gate on `purchase.order.button_confirm` (`pending`/`review`/`blocked` hard-block).
- Buyer `buyer_kyc_status` (never unlocks PO).
- Vault path pointers + n8n MKCOL for `/Suppliers/{name}/Certificates/` and `/Clients/{name}/Onboarding/`.
- GREEN product specs (`sattva_crop`, moisture/mesh thresholds) and `wf.coa.verify` GREEN compare (no lot write-back yet).
- CRM GREEN lead score (`wf.lead.score`); draft PO intent (`create_po_intent` only).

Specified and **not built** (fabric §5.1): brokerage **lot/quarantine** model. Do not fake this on `stock.lot`. Sattva does not hold inventory (fabric §1).

Keycloak / `auth.trilokventures.org` remains closed for Phase 3a T1.

---

## 3. Ranked backlog

Priority `P0`–`P4` are **implement-now bands**, not fabric Phase 0–3. `P0` is the next slice. `P1` follows once P0 exists or can proceed in parallel on partner/SO fields. `P2` needs live orders. `P3` is the GREEN-edge band (fabric Phase 2 calendar, after Phase 1 acceptance). `P4` is stop-listed or phase-blocked.

### P0 — Next to build (unblocks the proving path)

| # | Paper feature | Fabric mapping | Feasibility | Why this rank |
| --- | --- | --- | --- | --- |
| 1 | Lot-level CoA + quarantine until pass | New Odoo brokerage lot (not `stock.lot` inventory). Nextcloud keeps RED PDF. Odoo stores hash + GREEN metrics. `wf.coa.verify` writes `coa_pass` + hash only; fail opens CAPA. n8n never sets `available_for_sale` (fabric §7: officer action). Buyer UI must not treat `coa_pass` as release. | **Medium** | Fabric §5.1 / §6.2 proving path. Every later CoA, dossier, and buyer UI depends on it. |
| 2 | CoA threshold check (moisture ≤ 6%, mesh) | Extend existing product spec + `wf.coa.verify` to **persist** results on the lot. Keep HMAC GREEN payload; no PDF bytes in n8n logs. | **High** once #1 exists | Workflow JSON already compares moisture/mesh; it does not yet have a SoR row to update. |

### P1 — High compliance value, high feasibility (Odoo fields + gates)

Do these as addon fields and **Odoo** confirm hooks. Do **not** implement the paper’s “n8n intercepts webhook and transitions draft → sale”.

| # | Paper feature | Fabric mapping | Feasibility | Why this rank |
| --- | --- | --- | --- | --- |
| 3 | Buyer SFC licence (ACTIVE / SUSPENDED / EXPIRED) | `res.partner` AMBER fields on customers. Gate **sale** confirm (not PO). Missing/expired licence → `UserError`, same pattern as PCP. | **High** | SFCR/CFIA border rejection is the paper’s core risk. KYC complete must still not unlock PO. |
| 4 | Indian exporter IDs + audit metadata | Partner AMBER: Spices Board RCM, FSSAI, optional US FDA, `steam_sterilization_cap`, `last_audit_date`. PDFs stay in `/Suppliers/{name}/Certificates/`. | **High** | Completes Section 89(4) **pointers**. Officer still sets `supplier_pcp_status=approved`. |
| 5 | Approved freight forwarder / 3PL | `res.partner` with a **logistics category**, not `supplier_rank > 0` (that would fire supplier-folder events and the PCP PO gate). CBSA bond, `cfia_swi_capable`, insurance coverage, supported Incoterms, `forwarder_status`. Bond/insurance PDFs stay in Nextcloud (AMBER pointers in Odoo). SO requires an approved forwarder whose Incoterm set includes the order term. | **High** | Same partner-firewall pattern as PCP. Reduces IID/SWI misses. |
| 6 | Incoterms FOB / CIF / DAP | `sale.order` Incoterm (Odoo `sale` + account). Restrict DDP until OpCo writes an Importer-of-Record policy. | **High** after `sale_management` slice | AMBER; already named in fabric §3.3. Phase 3a T1 already lists quotes/SO as a separate slice. |
| 7 | First-order extra checks | Odoo `sale.order` confirm: first SO for a buyer also requires SFC ACTIVE + approved 3PL + at least one PCP-approved supplier on the linked PO intent. **Odoo raises UserError.** n8n does not confirm. | **Medium** | Paper workflow is right *commercially*, wrong *technically* (n8n as SoR). |
| 8 | Batch GREEN metrics (Salmonella, TPC, pyruvic) | Lot + product spec GREEN fields. Compare in `wf.coa.verify` after #1–2. Pyruvic only when crop is onion. | **High** | Extends existing GREEN compare; still no RED in logs. |
| 9 | Per-order vault tree | n8n MKCOL `/Clients/{name}/Orders/{SO}/` on SO create (event + `set_partner_path` style helper or path on the order). No public shares. | **High** | Fabric §5.3 already names this path. Folder poll pattern exists. |

`sale_management` install on production remains a **separate** ops slice (Phase 3a T1). Field work can land in the addon before that install; gates must not run against a missing `sale.order` model.

### P2 — After live POs/SOs exist

| # | Paper feature | Fabric mapping | Feasibility | Why this rank |
| --- | --- | --- | --- | --- |
| 10 | Credit score \(S_{client}\) and payment terms | Odoo computed score on the partner (or `sattva.payment.score` log). v1 uses only internal data: \(P\) from invoice DBT (default 50), \(V\) from FCL count on SOs, \(M\) from `industry_sector`. \(F\) and Paydex \(R\) stay **manual** until a dated finance spec. Finance manager assigns terms; sales cannot self-serve Net 60. | **Medium** | Shortens cash cycle, but needs invoicing + SoD (fabric §3.4). Do not auto-post terms from n8n. |
| 11 | Incoterm × risk-tier matrix (paper table) | Encode as Odoo constraints once #6 and #10 exist (Tier 4 → FOB only, etc.). | **Medium** | Depends on score + Incoterm fields. |
| 12 | Inbound technical-content lead | Phase 2 Vercel GREEN form → n8n HMAC webhook → `crm.lead` (existing score workflow). **Not** Mautic. **Not** Keycloak user provision. | **High** at Phase 2 | Closes deals without a second CRM. |
| 13 | Traceability dossier index | n8n lists vault names, hashes in memory, writes hashes + filenames onto the lot/SO. PDF bytes stay in Nextcloud. RED-touching nodes keep `saveData*Execution=none`. No file GET into logs. No “digitally signed” pack until PKI (Phase 3 Digital Trust). | **Medium** | Reduces audit friction after #1 and #9. |
| 14 | Replenishment nudge (paper: 45-day stockout) | **Not** Odoo inventory. `mail.activity` on the buyer from last SO date + assumed ocean transit. Uses existing notify helper. | **Medium** | Sattva does not hold stock. Forecast is CRM, not `stock.quant`. |

### P3 — GREEN edge (Phase 2 in the fabric calendar; after Phase 1 / T1 A–E acceptance **and** P0 lot model. Live BFF remains Keycloak-blocked.)

| # | Paper feature | Fabric mapping | Feasibility | Why this rank |
| --- | --- | --- | --- | --- |
| 15 | Buyer portal: lot status, CoA presence | Vercel BFF in `middleware/` (`app.trilokventures.org`), not the mocks project. Reads GREEN lot fields and the **officer** release flag only. No WebDAV, no `NEXT_PUBLIC_` vault URLs, no file bytes. Auth: mock or employee Access until Keycloak unlock. `FABRIC_MODE=live` stays off. Do not treat `coa_pass` as available-for-sale. | **Medium** | Fabric §5.6 / §8 Phase 2. Blocked on #1 and T1 BFF/Keycloak unlock. |
| 16 | OCR of CoA numbers | Hugging Face on **GREEN extracts** after DLP/hash. Source PDF never leaves Nextcloud. | **Low–medium** | Fabric §5.9. Manual GREEN metadata webhook can run until then. |
| 17 | Thought-leadership / SFCR explainers | Existing Vercel mocks/site + Notion KB. Do **not** add Ghost as a runtime. | **High** as content, not as a new app | Marketing function already assigned (fabric §2, §5.6). |

### P4 — Do not implement as written

| # | Paper feature | Why it is P4 / reject | Compliant substitute |
| --- | --- | --- | --- |
| 18 | Mixpost / Postiz | New tool; stop list; does not reduce CFIA risk this quarter | Human LinkedIn from Notion/Vercel copy |
| 19 | Mautic | Second CRM / lead SoR; Keycloak identity mapping | `crm.lead` + `wf.lead.score` (#12) |
| 20 | Chatwoot (+ WhatsApp, Nextcloud embed) | New tool; Nextcloud public portal contradicts no public RED shares | Odoo chatter + `mail.activity` + email notify |
| 21 | Ghost (headless) | New publishing runtime; WebDAV attachments of RED whitepapers into a CMS | Vercel PUBLIC/GREEN pages (#17) |
| 22 | NocoDB / Baserow | Second lead database with native Postgres R/W — explicit SoR violation | Odoo CRM pipeline |
| 23 | Parallel PostgreSQL data dictionary as SoR | Fabric §3.1 / §12 | Odoo models in §4 below |
| 24 | n8n confirms SO/PO when checks pass | n8n is pass-through only; PCP/sale gates stay in Odoo Python | #7 |
| 25 | Keycloak SSO for buyers, Chatwoot, Nextcloud | Closed for Phase 3a T1; needs dated unlock after origin TLS, Access, PCP, partner views | Cloudflare Access (employees) + app-local Odoo groups |
| 26 | Nextcloud “public portal” for QA staff | RED vault is employees-only Access on `vault.` | Share inside Access; later Keycloak |
| 27 | DDP / brokerage as Importer of Record | Legal/ops policy, not a dropdown | Leave Incoterm as DAP/CIF/FOB until OpCo spec |
| 28 | Live D&B Paydex, Altman Z from statements | Paid bureau + RED financials | Manual \(F\)/\(R\) on the score log (#10) |
| 29 | Digitally signed dossier + PKI | Phase 3 Digital Trust extras | Hash index (#13) |
| 30 | HubSpot / dual pipeline | Fabric §5.10 deferred overlay only | — |

---

## 4. Paper schema → Odoo (no sidecar DB)

| Paper table | Odoo / vault SoR |
| --- | --- |
| `clients` | `res.partner` (`customer_rank > 0`) + SFC fields (#3) + `buyer_kyc_status` |
| `suppliers` | `res.partner` (`supplier_rank > 0`) + PCP + exporter IDs (#4) |
| `freight_forwarders` | `res.partner` with logistics category + 3PL fields (#5) |
| `employees` | `res.users` + existing `ROLE_GROUPS` (no Keycloak id until unlock) |
| `pcp_documents` | Nextcloud URIs on partner; files in `/PCP/*` and `/Suppliers/.../Certificates/` |
| `batch_documents` | Brokerage lot model (#1) + GREEN CoA fields; PDF in vault |
| `logistics_documents` | SO AMBER fields (BL, container, IID) + Nextcloud URI; files in `/Clients/.../Orders/{SO}/` |
| `orders` | `sale.order` + `purchase.order`; `first_order` derived, not a second orders table |
| `payment_scores` | Odoo score log (#10), not n8n state |

UUID primary keys in the paper are not a reason to abandon Odoo integer ids.

---

## 5. Suggested implementation order (slices)

Each slice needs its own dated plan before code. Do not combine P0 with P4 tools.

1. **Lot + CoA persist** (P0 #1–2) — unblocks quarantine default (fabric §7).
2. **`sale_management` ops install** if quotes are in use — no demo data; CAD/company already set.
3. **Buyer SFC + exporter IDs + 3PL partner + Incoterms + SO confirm gates** (P1 #3–7, #9).
4. **GREEN CoA metric pack** (P1 #8) on the lot.
5. **Credit v1 + term constraints** (P2 #10–11) after invoices exist.
6. **Vercel inbound GREEN lead form** (P2 #12) on the public/mocks or marketing project. **GREEN lot UI** (P3 #15) only in `middleware/` after T1 BFF / Keycloak unlock. Do not combine into one Vercel project or retarget root `vercel.json`.

Stop after each slice if it does not close a deal, cut compliance risk, or shorten cash.

---

## 6. Decisions recorded here

| Decision | Choice | Rejected |
| --- | --- | --- |
| Paper as backlog input | Rank + remap onto fabric | Implementing the paper stack as written |
| Order confirmation | Odoo Python gates | n8n draft→sale |
| Buyer/supplier/3PL master | `res.partner` | `clients`/`suppliers`/`freight_forwarders` tables |
| Marketing automation | Odoo CRM + later Vercel form | Mautic, NocoDB, Mixpost, Ghost, Chatwoot |
| Identity for this ranking horizon | Cloudflare Access + Odoo groups | Keycloak provision-on-lead |
| Inventory / replenishment | CRM activity from SO history | Odoo stock as brokerage inventory |
| Credit v1 | Internal P, V, M; manual F/R | Live bureau + formula auto-terms |

Unlocks that would change this ranking (new dated spec, not an edit): Phase 3a T1 acceptance recorded; Keycloak unlock list in `docs/runbooks/app-local-admin-and-roles.md`; OpCo DDP/Importer-of-Record policy; paid D&B contract.
