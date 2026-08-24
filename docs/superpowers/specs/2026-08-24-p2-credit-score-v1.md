# P2 credit score v1 and Incoterm × risk-tier

**Status:** Implementing on `cursor/paas-feature-ranking-952c`  
**Date:** 2026-08-24  
**Owner:** IPCo (software); Sattva Brokers OpCo (finance assigns terms)  
**Companion ranking:** `2026-08-24-spice-trade-paas-feature-ranking.md` (P2 #10–11; §5 item 5)  
**Locked fabric:** `2026-08-13-sattva-brokers-system-fabric-design.md` §3.1 / §3.3 / §3.4 / §12  
**Prior slices:** `2026-08-24-p1-sale-gates-partner-fields.md` (Incoterms), `2026-08-24-p1-coa-green-metrics.md`

## Goal

Compute an internal client credit score in Odoo. Finance assigns payment terms. Sales cannot self-serve Net 60. Credit tier 4 buyers confirm FOB only. n8n does not compute the score, does not post terms, and does not confirm the SO.

Paper `payment_scores` maps onto Odoo (`sattva.payment.score` log + partner fields). No sidecar Postgres table.

## Formula (Sattva-authored v1)

The PaaS paper names \(S_{client} = 0.2(P+V+M+F+R)\) and Paydex \(R\). Live D&B / statement Altman Z stay P4 (#28). Until a dated finance spec extracts the paper’s exact buckets, this slice uses the following **internal** mapping. Changing buckets needs a new dated spec, not a silent edit.

\[
S = \mathrm{round}(0.2(P+V+M+F+R))
\]

Each component is an integer 0–100.

| Component | Source | Unknown / default |
| --- | --- | --- |
| \(P\) punctuality | Posted customer invoices (`account.move` `out_invoice`, `state=posted`) on the **commercial** partner. Average days-beyond-terms (DBT). | No posted invoices → **50** |
| \(V\) volume | Sum of `sale.order.fcl_count` on confirmed SOs (`state in (sale, done)`) for the commercial partner. \(V = \min(100, 20 \times \sum \mathrm{FCL})\). | Sum 0 → **50** |
| \(M\) market | `res.partner.industry_sector`: food_service 80, retail 70, manufacturing 60, other/unset **50** | unset / other → **50** |
| \(F\) financial | Manual integer on the partner | **50** until finance writes it |
| \(R\) Paydex stand-in | Manual integer on the partner. Not a live bureau call. | **50** until finance writes it |

Punctuality from average DBT when invoices exist:

| Average DBT (days) | \(P\) |
| --- | --- |
| ≤ 0 (on or before due) | 100 |
| ≤ 15 | 80 |
| ≤ 30 | 60 |
| ≤ 60 | 40 |
| > 60 | 20 |

v1 DBT for a posted invoice:

- `payment_state == paid` → 0 days beyond terms (paid is treated current until a dated spec wires payment matching dates).
- else if `invoice_date_due` is set and `< today` → calendar days overdue.
- else → 0 (open, not due). Average those values.

Tiers from \(S\):

| \(S\) | Tier | Incoterm v1 |
| --- | --- | --- |
| ≥ 80 | 1 | FOB / CIF / DAP |
| 65–79 | 2 | FOB / CIF / DAP |
| 50–64 | 3 | FOB / CIF / DAP |
| **< 50** | **4** | **FOB only** |

The paper’s full Incoterm × tier matrix is not encoded beyond **tier 4 → FOB**. Remaining rows wait for a dated OpCo extract.

Default new buyer: \(P=V=M=F=R=50\) → \(S=50\) → tier 3. Existing P1 sale-confirm tests stay valid.

## Behaviour

- `res.partner`: `industry_sector`; stored manual `payment_score_financial`, `payment_score_paydex` (0–100, default 50); computed (non-stored) \(P,V,M,S\) and `credit_risk_tier`.
- `sattva.payment.score`: AMBER snapshot log (`partner_id`, component scores, total, tier, FCL sum, invoice count). Created on finance write of \(F\)/\(R\)/`industry_sector` and on `action_recompute_payment_score`. Not an n8n SoR.
- `sale.order.fcl_count`: Integer ≥ 0, AMBER, default 0. Sales may set FCL. Volume uses **already confirmed** SOs, so the SO being confirmed does not count toward \(V\) yet.
- `sale.order` confirm: after existing P1 gates, if commercial buyer `credit_risk_tier == '4'` and `sattva_incoterm != 'fob'` → `UserError` “Compliance Gate Blocked” (FOB only).
- Payment term SoD: max `account.payment.term.line.nb_days` across the term. **Net 60** means that max ≥ 60. Immediate / Net 30 remain self-serve for sales.
- Users with `sales_team.group_sale_salesman` and **without** `account.group_account_manager` cannot write \(F\), \(R\), `property_payment_term_id` when max days ≥ 60, or `sale.order.payment_term_id` when max days ≥ 60.
- `account.group_account_manager` may write \(F\)/\(R\) and Net 60+ terms. `account.group_account_user` alone cannot.
- n8n fabric service: read-only on the score log; cannot write \(F\)/\(R\)/industry/payment terms; cannot call `action_recompute_payment_score`; no workflow helper that posts terms. n8n still must not call `button_confirm` / `action_confirm`.
- Public `write()` on the partner and SO enforces the SoD even if a client injects fields over JSON-RPC.

## Out of scope

- Live D&B Paydex, Altman Z, auto-posted terms from n8n (P4 #28 / ranking #10).
- Vendor-bill dual control (“PO creator cannot be sole payment approver”, fabric §3.4). This slice is **customer** credit + sales term SoD. Vendor payment approval needs a later dated finance spec on `account.payment`.
- Full paper Incoterm × tier table beyond tier 4 FOB.
- `sale_management` ops install (Phase 3a T1). Do not add that dependency.
- DDP / Importer of Record, buyer portal, Keycloak, `/Logistics/` MKCOL.
