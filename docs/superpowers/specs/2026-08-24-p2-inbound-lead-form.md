# P2 inbound GREEN technical-content lead

**Status:** Implementing on `cursor/paas-feature-ranking-952c`  
**Date:** 2026-08-24  
**Owner:** IPCo  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md` (P2 #12; §5 item 6)  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §3.1 / §3.3 / §5.6 / §5.10  
**Prior slices:** `2026-08-24-p1-sale-gates-partner-fields.md`, `2026-08-24-p2-credit-score-v1.md`

## Goal

Public technical-content form on the **mocks / marketing Vercel project** creates an Odoo `crm.lead`. n8n is pass-through (HMAC webhook). Odoo remains the lead SoR. Not Mautic, not NocoDB, not Keycloak user provision, not the `middleware/` BFF.

## Behaviour

- Static page `docs/superpowers/mocks/inbound-lead.html` (linked from the mocks index). Root `vercel.json` stays `outputDirectory: docs/superpowers/mocks`. No Next.js, no `NEXT_PUBLIC_` fabric URLs, no n8n/Odoo hostname in committed HTML/JS.
- Browser collects AMBER contact (`contact_name`, `work_email`, `company_name`) and GREEN technical fields (`product_family_code`, `fcl_band`, `content_topic`). The page does not persist those values on Vercel (no serverless, no analytics POST, no localStorage).
- Live POST is operator-only: `sessionStorage.sattva_lead_webhook` + `sessionStorage.sattva_lead_hmac`. Committed default is local validate + preview (no fetch). The HMAC secret must not ship in git or in the static bundle.
- `wf.lead.inbound` verifies `x-sattva-webhook-hmac`, allowlists keys, rejects nested objects and unknown fields, then calls `sattva.fabric.lead.ingest.create_inbound`. Execution save-data stays `none` (AMBER email in transit).
- `create_inbound` is n8n fabric service only. It creates `crm.lead` (`type=lead`) and stores GREEN family/band/topic. It does **not** create `res.users`, Keycloak accounts, partners-as-IdP, or confirm SO/PO.
- The same workflow then scores with the existing GREEN allowlist (`hashed_partner_id` = SHA-256 of lowercased email, `stage_rank=1`, `days_in_stage=0`, `order_count=0`) via `sattva.fabric.leadscore.write_score`. Raw email never enters the score payload.
- Optional sales ping: `sattva.fabric.notify.create_role_activity` with a summary that contains lead id + product family, **not** email or name.
- n8n still must not call `button_confirm` / `action_confirm`. Hugging Face is not on this path.

## Allowlists

Inbound webhook (AMBER + GREEN): `contact_name`, `work_email`, `company_name`, `product_family_code`, `fcl_band`, `content_topic`.

GREEN score (unchanged): `hashed_partner_id`, `stage_rank`, `days_in_stage`, `product_family_code`, `order_count` (+ `lead_id` for the write helper).

`product_family_code` ∈ {ONION, GARLIC, CHILLI, OTHER}. `fcl_band` ∈ {1, 2_5, 6_plus}. `content_topic` ∈ {sfcr, coa_spec, steam_sterilization}.

## Out of scope

Keycloak provision-on-lead, HubSpot dual pipeline, Mautic/Ghost/NocoDB, buyer portal / live BFF (`middleware/`), retargeting root `vercel.json`, live D&B, `/Logistics/` MKCOL, `sale_management` ops install.
