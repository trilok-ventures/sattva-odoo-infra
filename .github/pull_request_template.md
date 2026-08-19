## Dual-plane eval (fail any check → do not merge)

- [ ] **Stop-list** — this change moves a deal step, a compliance control, or the cash cycle.
- [ ] **Classification** — GREEN/PUBLIC + `agent_ok` inputs only; no COA/PII/vault; no AMBER in the PR title or summary.
- [ ] **One SoR** — no Notion CRM, no Bot memory as file, no live Odoo KPIs, n8n still pass-through.
- [ ] **Human gate** — a human merges. Agents do not merge main. PCP / PO confirm / lot release / payment stay in Odoo.
- [ ] **Span** — at most one Cloud Agent spawn for this ticket.

## What changed

<!-- paths and why -->

## Proof

<!-- tests / logs / spawn brief JSON if a Cloud Agent opened this PR -->
