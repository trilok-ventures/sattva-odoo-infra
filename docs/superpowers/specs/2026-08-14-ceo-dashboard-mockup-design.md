# Sattva Brokers CEO Dashboard Mockup Design

**Status:** Proposed mockup contract  
**Date:** 2026-08-14  
**Owner:** Sattva Brokers OpCo  
**Companion:** `2026-08-14-ceo-command-center-blueprint.md`, `2026-08-13-sattva-brokers-system-fabric-design.md` (locked)

## 1. Purpose

Create a CEO-explainable visual mockup for the Sattva control model:

> We do not buy until compliance says yes. We do not sell until a lot passes verification. We protect cash through controlled quote-to-invoice execution.

The mockup supports weekly internal operating review, monthly investor updates, and quarterly board packs. It is explicitly illustrative: every metric is mock or sanitized data until its authoritative source is instrumented and accepted.

## 2. Surface split

| Surface | Audience | Classification | Delivery boundary |
| --- | --- | --- | --- |
| Weekly Control Room | CEO/operator and authorized employees | AMBER | Internal fabric application only; not Vercel |
| Monthly Investor Update | Investors | GREEN/PUBLIC | Separate Vercel public-edge view after Phase 1 acceptance |
| Quarterly Board Pack | Board | GREEN/PUBLIC by default | Separate Vercel public-edge view after Phase 1 acceptance; any AMBER supplement stays separately access-controlled |

The mockup labels these boundaries visibly. It does not imply that any external surface may read AMBER operational information.

## 3. Internal control-room view

The weekly view uses an executive-control-room layout:

1. **Control tiles** — PCP gate, lot release, and cash. Each tile shows source, confidence, timestamp, owner, and escalation threshold.
2. **Exception-to-decision queue** — ranks compliance, lot, delivery, and cash exceptions by age and owner. It provides a derived explanation and a link to the Odoo source record.
3. **Metric confidence** — labels each metric `live`, `delayed`, or `not instrumented`. Unavailable values are never presented as live.
4. **Phase-gate scorecard** — marks every dependency as `planned`, `implemented`, or `accepted`, with the required acceptance evidence for the next phase.
5. **Decision rail** — read-only view of current priorities and linked Notion/Git decision records. Operational follow-up is created or linked in Odoo under its authorization rules.

The view may not approve suppliers, confirm purchase orders, release lots, edit invoices, assign a record independently of Odoo, expose evidence, or bypass the compliance gate.

## 4. Investor and board views

The investor and board states retain the same control narrative while exposing only approved GREEN/PUBLIC information:

- aggregated progress and conversion trends;
- normalized compliance-readiness, lot-pass, and delivery-reliability trends;
- approved phase milestones, material risks, and support requests;
- capital, hiring, or strategic decision asks; and
- sanitized system-readiness indicators.

They exclude counterparties, prices, cash detail, exception owners, decision assignments, Odoo links, vault paths, internal identifiers, PII, file contents, lab-report details, and any RED/AMBER data.

## 5. Interaction model

The dashboard is a derived, read-only projection. Its drill-down sequence is:

1. select an exception;
2. show control state, owner, age, source, metric confidence, and recommended decision;
3. link to the authoritative Odoo record for execution; and
4. record executive decisions through the existing Notion decision-log and Git promotion path.

The dashboard never becomes a second CRM, task system, workflow engine, evidence store, or analytics warehouse.

## 6. Integration-readiness layer

The design reserves cards for every fabric component without declaring it live prematurely.

| Component | System role | Current mock state | Safe dashboard content |
| --- | --- | --- | --- |
| Odoo CE | Operational system of record | Mapped first | Approved aggregates, source ownership, control state |
| Nextcloud | RED evidence vault | Planned in Phase 1 | Readiness phase and acceptance evidence only; never files or paths |
| n8n | Pass-through integration bus | Planned in Phase 1 | Sanitized health metadata only after implementation |
| Keycloak + Cloudflare | Identity and edge protection | Planned in Phase 3 | Phase readiness only until deployed |
| GitHub | Code, IaC, workflow-definition source | Present | Delivery milestone and acceptance-evidence status |

Every readiness card displays: owner, classification, source of truth, current phase state, last verified time when available, and next acceptance evidence. It never displays hostnames, credentials, payloads, error bodies, execution logs, vault paths, or internal identifiers.

## 7. Classification contract

| Classification | Mockup treatment |
| --- | --- |
| RED | Never display: COAs, PDFs, lab details, PII, bank data, vault paths, credentials |
| AMBER | Internal Control Room only: PCP status, lots, cash, exception ownership, decision assignment, Odoo links |
| GREEN | Approved aggregate trends, normalized pass/fail metrics, sanitized hashes, readiness indicators |
| PUBLIC | Approved narrative, brand-safe milestones, and public investor summary |

Figma content uses fictional sanitized examples and labels every sample as mock data.

## 8. Phase gating

| Phase | Mockup outcome |
| --- | --- |
| Phase 0 | Static Figma/HTML mockups with fictional sanitized content |
| Phase 1 | Local-fabric acceptance: Odoo partner views, vault-folder provisioning, n8n workflow, and verification fixtures |
| Phase 2 | Separate Vercel project for GREEN/PUBLIC investor and board surfaces only |
| Phase 3 | Production identity and infrastructure controls; internal operational access remains separately protected |

No production status, external Vercel deployment, or live integration is represented before its predecessor phase is accepted.

## 9. Validation

The design is complete when:

1. all three views communicate the same control narrative;
2. AMBER weekly material is visibly segregated from external GREEN/PUBLIC views;
3. every mock KPI shows source and confidence state;
4. no screen contains RED material, a vault path, or a production secret;
5. exception interactions link to Odoo rather than duplicating execution; and
6. readiness cards distinguish planned, implemented, and accepted states.

## 10. Non-goals

- A production dashboard implementation or Vercel deployment.
- Odoo, n8n, Nextcloud, Keycloak, Cloudflare, or GCP integration work.
- A Cloudflare Agent, Worker state store, or second workflow bus.
- A public Notion site or Notion database used as transactional state.
