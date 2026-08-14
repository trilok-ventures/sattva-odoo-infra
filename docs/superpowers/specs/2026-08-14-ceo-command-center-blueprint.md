# Sattva Brokers CEO Command Center Blueprint

**Status:** Proposed (Phase 0 presentation contract)
**Date:** 2026-08-14
**Owner:** Sattva Brokers OpCo
**Companion specs:** `2026-08-13-sattva-brokers-system-fabric-design.md` (locked), `2026-08-13-sattva-versioned-kb.md` (locked), `2026-08-14-integrated-system-architecture.md`

## 1. Purpose

Define one CEO-explainable command center for:

1. weekly operating reviews;
2. monthly investor updates; and
3. quarterly board packs.

The command center presents existing system-of-record data. It does not create a CRM, task system, reporting warehouse, file store, or operational workflow.

Its operating narrative is:

> We do not buy until compliance says yes. We do not sell until a lot passes verification. We protect cash through controlled quote-to-invoice execution.

This improves decision speed and demonstrates compliance controls without weakening the locked fabric's one-system-of-record, data-classification, or phase-gating rules.

## 2. Architecture and source ownership

The CEO Command Center is a Notion presentation and meeting layer under `Trilok Ventures → Sattva Brokers`. It is read-only and time-stamped: meeting notes and decisions link to source records rather than copying or editing them.

| Concern | Source of truth | Command-center use | Must not do |
| --- | --- | --- | --- |
| Leads, quotes, orders, POs, invoices, partners, PCP status, lots | Odoo CE | Show approved aggregates and deep links for internal reviewers | Store or calculate transactional data in Notion |
| Evidence, COAs, certificates, PCP packs | Nextcloud | Refer to evidence availability or approved hashes only | Embed files, paths, share links, or file contents |
| Integration health | n8n | Show health/run metadata only | Show execution payloads or use n8n as business state |
| Code, infrastructure, workflow definitions, delivery status | GitHub | Show delivery milestone status and links | Replace the repository's promotion contract |
| Policies, SOPs, decisions, meeting notes | Notion KB | Present reviewed narrative and link to the decision log | Act as a second CRM, task system, or operational database |
| Future external presentation | Vercel, Phase 2 only | Mirror approved GREEN/PUBLIC content read-only | Expose AMBER data or access Nextcloud directly |

No metric is considered live merely because it appears in Notion. Each rendered view shows an `as of` timestamp and links to the named source system.

## 3. Audiences and classification

| View | Audience | Classification | Access and content |
| --- | --- | --- | --- |
| Weekly operating review | CEO/operator and authorized employees | AMBER | Restricted internal view with Odoo deep links and operational aggregates. Finance and health details remain role-limited. |
| Monthly investor update | Investors | GREEN/PUBLIC | Sanitized trends, milestones, risks, and approved narrative. No names, prices, counterparties, Odoo links, or evidence pointers. |
| Quarterly board pack | Board | GREEN/PUBLIC by default | Consolidates approved monthly trends, phase gates, risks, decisions, and capital/hiring asks. Any AMBER supplement remains separately access-controlled. |

The AMBER weekly view must not be created, shared, or distributed until the Sattva Brokers KB is in a closed teamspace with role-based access. Until then, it remains owner-only. Investor access is limited to a separately curated GREEN/PUBLIC subtree; investors never receive access to the KB root, LifeOS, or vault materials.

## 4. Information architecture

The command-center landing page contains:

1. **Executive narrative** — the three control statements, current delivery phase, and three current priorities.
2. **Review selector** — links to the weekly, monthly, and quarterly views.
3. **Metric dictionary** — the approved definitions, classifications, owners, and escalation thresholds.
4. **Decision and risk register** — links to existing decision-log entries with owner, due date, and status.
5. **Phase roadmap** — Phase 0–3 delivery gates, evidence required to advance, and deferred work.

### 4.1 Weekly operating review

The weekly review follows this sequence:

1. review commercial, compliance, delivery, cash, and operational-health exceptions;
2. follow internal Odoo links for named action; do not duplicate transactional records in Notion;
3. record decisions, owners, and dates in the existing decision log; and
4. publish the following week's three priorities.

Internal metric groups:

| Group | Metrics |
| --- | --- |
| Commercial | Active opportunities, quotes awaiting action, confirmed orders |
| Compliance | Suppliers pending/review, blocked PO confirmations, lots in quarantine, open CAPAs, open CFIA requests |
| Delivery | Shipments at risk, documents due, orders awaiting release |
| Cash | Unpaid invoices and cash/runway narrative, finance-restricted |
| Operational health | Service reachability and n8n health/run metadata, IT/CEO-restricted |

### 4.2 Monthly investor update

The monthly update presents only approved GREEN/PUBLIC material:

- pipeline progression and conversion trends;
- compliance readiness and lot-release trends;
- delivery reliability;
- cash/runway narrative at the approved aggregation level;
- phase milestones, material risks, and requested support.

No live links, named counterparties, prices, partner identifiers, vault paths, file hashes tied to counterparties, or other AMBER/RED details appear in this view.

### 4.3 Quarterly board pack

The quarterly pack:

1. incorporates the three monthly trend snapshots;
2. reports phase-gate status and supporting control attestations;
3. highlights material risks and mitigations;
4. requests decisions on capital, hiring, and strategic exceptions; and
5. records resolutions in the decision log.

## 5. Metric contract

Every metric must define:

| Field | Requirement |
| --- | --- |
| Name and purpose | Plain-language decision it supports |
| Owner | Accountable system role |
| Formula | Verifiable calculation or count |
| Source of truth | Odoo, GitHub, n8n health metadata, or an approved knowledge artifact |
| Classification | RED, AMBER, GREEN, or PUBLIC |
| Audience | Weekly internal, investor, board, or a role-limited subset |
| Cadence and timestamp | Weekly, monthly, or quarterly plus source observation time |
| Threshold | Target, warning, or escalation criterion |
| Escalation | Named role and fail-closed next action |

Unavailable metrics are labeled **Not instrumented** with an accountable owner and decision date. They must not be estimated, manually fabricated, or labeled live.

## 6. Governance and controls

- The command center adds presentation views only; it does not introduce a new tool or datastore.
- Notion pages do not write back to Odoo, Nextcloud, n8n, or GitHub.
- RED evidence never appears in any dashboard or board material.
- n8n information is limited to service health and run metadata. It excludes execution payloads, workflow business state, file contents, and RED data. RED-touching workflows must retain disabled execution-data persistence.
- An investor-facing content review checks for PII, counterparties, prices, vault paths, raw evidence, Odoo URLs, and any other AMBER/RED data before publication.
- Any newly proposed metric or tool must meet the stop-list test: it closes a deal, reduces compliance risk, or shortens the cash cycle.
- Compliance-binding metric rules are promoted through the KB path: working Notion draft → human review → Git commit when locked → Version Catalog SHA → Published.

## 7. Failures and exceptions

| Condition | Required response |
| --- | --- |
| Source data unavailable | Show `Not instrumented`, identify owner and decision date; do not invent a metric |
| Classification issue in external view | Remove the content, record a classification incident, review, and republish only after approval |
| Phase 2/3 dependency unavailable | Mark it roadmap-only; do not represent mock or unavailable data as live |
| Operational exception | Link to the Odoo source and create a decision-log entry; do not create a parallel Notion workflow |
| n8n health failure | Keep the relevant lot or process quarantined according to the fabric error-handling rules |

## 8. Phased delivery

| Phase | Command-center outcome | Boundary |
| --- | --- | --- |
| Phase 0 | This Git presentation contract plus Notion blueprint working pages | No live dashboard claim, new analytics tool, or external portal deployment |
| Phase 1 | Internal Odoo-backed operating metrics once local fabric acceptance passes | No GCP production infrastructure or buyer/supplier production portal |
| Phase 2 | Separate Vercel project mirrors approved GREEN/PUBLIC investor/board content; existing portal gains approved role views | Never retarget the mocks deployment or expose AMBER/RED data |
| Phase 3 | Production identity, access, and WORM controls enforce production-ready internal/external views | Deferred security extras remain subject to the locked stop list |

## 9. Validation

Before publishing a view:

1. verify each metric's source, owner, formula, classification, cadence, threshold, and escalation path;
2. test the weekly review against real Odoo deep links and record decisions in the existing decision log;
3. review monthly investor and quarterly board material for AMBER/RED leakage;
4. verify no page stores transactional operational data or evidence; and
5. confirm every phase claim matches predecessor acceptance evidence.

## 10. Explicit non-goals

- A Notion leads, quotes, orders, lots, invoices, or task database.
- A new BI product, warehouse, CRM, or file vault.
- Live or mock operational metrics presented as production data.
- External access to AMBER weekly content.
- Direct browser access to Nextcloud.
- Vercel deployment before Phase 1 acceptance, or deployment into the existing mocks project.
