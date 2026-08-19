# Canada–India Brokerage Knowledge Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a governed, role-oriented Notion knowledge library for the Canada–India dehydrated-spice brokerage process without creating a second operational record or exposing RED/AMBER data.

**Architecture:** Build the material first as a GREEN Content inbox draft, using the approved git design as the canonical source. A human owner reviews and promotes the draft into the closed Sattva Brokers Knowledge Base; Notion remains a non-transactional presentation layer. Middleware receives no integration in this plan—its future contract is documented as a pointer-only, GREEN-only boundary.

**Tech Stack:** Notion MCP, Notion GREEN Content inbox, GitHub versioned specifications, Odoo CE, Nextcloud, n8n, middleware documentation.

## Global Constraints

- Odoo CE is the sole source of truth for partners, quotes, Incoterms, orders, approvals, lots, invoices, and live performance.
- Nextcloud is the sole evidence vault for RED documents; no Notion page may contain vault files, file bytes, public links, Nextcloud paths, COAs, signed contracts, banking data, or full lab reports.
- n8n may orchestrate but must not own business state or persist RED payloads in execution logs.
- The library is non-transactional: it must not track onboarding completion, document status, provider quotations, prices, client selections, shipment status, or approvals.
- The library content is GREEN/PUBLIC only. It uses generic role guidance, templates, document names, classifications, and escalation rules.
- Notion access does not authorize runtime operations; Odoo separation of duties remains authoritative.
- The existing supplier gate remains unchanged: only a compliance officer can set `supplier_pcp_status` to `approved`, and Odoo blocks PO confirmation otherwise.
- The first-delivery baseline is DAP at a named Canadian destination under Incoterms 2020; alternative Incoterms or importer-of-record arrangements require internal approval recorded in Odoo.
- Sattva’s initial provider-comparison service fee is disclosed separately; the buyer selects the provider and approves final provider payment.
- Until a closed `Trilok Ventures` teamspace exists, the KB remains private to its owner. Agents may write only the GREEN Content inbox; a human promotes content to the Library.
- Do not modify Odoo models, Nextcloud, n8n, Keycloak, Cloudflare, Vercel configuration, or middleware runtime code in this plan.

---

## File Structure

| Location | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-08-16-canada-india-dehydrated-spice-brokerage-library-design.md` | Git-canonical operating design and source of the Notion draft. |
| `docs/superpowers/plans/2026-08-16-canada-india-brokerage-library.md` | This execution plan and promotion controls. |
| Notion → GREEN Content inbox | Draft library content created by an agent. |
| Notion → Sattva Brokers → Knowledge Base | Human-promoted published library after closed-teamspace verification. |

### Task 1: Establish the governed Notion destination

**Files:**
- Reference: `docs/superpowers/specs/2026-08-13-sattva-versioned-kb.md`
- Reference: `docs/superpowers/specs/2026-08-16-canada-india-dehydrated-spice-brokerage-library-design.md`
- External location: Notion GREEN Content inbox

**Interfaces:**
- Consumes: the existing GREEN Content database and the Sattva Brokers Knowledge Base hierarchy.
- Produces: a confirmed, agent-writable draft destination and a human-confirmed promotion destination.

- [ ] **Step 1: Verify the owner’s teamspace precondition**

The owner verifies one of these exact conditions in Notion:

```text
A closed, invite-only Trilok Ventures teamspace contains:
Trilok Ventures → Sattva Brokers → Knowledge Base

OR

The teamspace is not yet available, so the draft remains in GREEN Content
and is visible only to the owner until the teamspace is restored.
```

Expected result: no client, supplier, investor, or guest receives access to the new material.

- [ ] **Step 2: Confirm the draft database properties**

Confirm that the GREEN Content inbox can represent this draft with the following values:

```text
Title: Client & Supplier Onboarding Library — Canada–India Dehydrated Spices
kb_layer = inbox
classification: GREEN
agent_ok: false
Status = inbox
```

Expected result: the `kb_layer = inbox` and `Status = inbox` values represent the draft/inbox state, explicitly excluding the draft from automated-agent retrieval and from the published Library.

- [ ] **Step 3: Record the promotion owner**

Record the page owner as `Sattva Brokers OpCo owner` and the required human reviewers as:

```text
Commercial: Sattva sales lead
Compliance: Sattva compliance officer
Operations: Sattva logistics lead
```

Expected result: a person, not an agent, is accountable for promotion and any compliance-binding interpretation.

- [ ] **Step 4: Verify the precondition**

Open the draft record and confirm all values match:

```text
kb_layer = inbox
classification = GREEN
agent_ok = false
Status = inbox
```

Expected: all four values are present; otherwise stop before creating page content.

- [ ] **Step 5: Commit planning evidence if the git plan changes**

```bash
git add docs/superpowers/plans/2026-08-16-canada-india-brokerage-library.md
git commit -m "docs: plan brokerage knowledge library"
```

Expected: the plan commit contains only the plan file and no external credentials or operational records.

### Task 2: Create the GREEN Content inbox draft

**Files:**
- Reference: `docs/superpowers/specs/2026-08-16-canada-india-dehydrated-spice-brokerage-library-design.md`
- Create: Notion GREEN Content inbox page `Client & Supplier Onboarding Library — Canada–India Dehydrated Spices`

**Interfaces:**
- Consumes: the approved library design and the Task 1 GREEN draft destination.
- Produces: one non-transactional parent page with the complete role-oriented hierarchy below.

- [ ] **Step 1: Create the parent page with controlled properties**

Create the page in GREEN Content using:

```text
Title: Client & Supplier Onboarding Library — Canada–India Dehydrated Spices
kb_layer = inbox
classification: GREEN
agent_ok: false
Status = inbox
```

These values represent the GREEN Content draft/inbox state.

Use this exact parent-page body:

```markdown
# Client & Supplier Onboarding Library

## Start here
This library describes Sattva Brokers’ disclosed-agent operating model for container-scale dehydrated onion, garlic, and related spice ingredients moving from qualified Indian suppliers to Canadian food manufacturers.

It is guidance, not a live tracker. Odoo owns partners, quotations, Incoterms, orders, approvals, lots, invoices, and performance. Nextcloud owns evidence. n8n orchestrates approved workflows without owning business state. This library contains no live records, prices, files, vault links, or approval status.

## First-delivery baseline
The default operating profile is DAP, named Canadian destination, Incoterms 2020. The Indian supplier is seller/exporter. The Canadian buyer is normally importer of record. Sattva acts as a disclosed coordinator under authority from the principals. Any exception requires the applicable commercial, compliance, finance, and logistics approval in Odoo.

## Provider comparison
Sattva may charge a separately disclosed fee to collect and normalize initial quotations from customs brokers, freight forwarders, and destination 3PLs. The buyer selects the provider and approves final provider payment. The comparison does not replace the buyer’s commercial, customs, or legal review.

## Use this library
1. Select the page matching your role and shipment stage.
2. Follow the document requirement and escalation guidance.
3. Complete live actions and decisions in Odoo.
4. Store evidence only in Nextcloud.
5. Escalate missing, contradictory, or lot-specific compliance requirements to Sattva Compliance.
```

Expected: one parent page exists in the GREEN Content inbox without a real client, supplier, provider, quote, order, or document.

- [ ] **Step 2: Add the six child pages**

Create these child pages with the exact titles:

```text
1. Roles and System Boundaries
2. Client Onboarding
3. Supplier Qualification
4. Logistics Coordination
5. Document Classification and Retention
6. Middleware Knowledge-Access Contract
```

Expected: navigation matches the approved hierarchy and stays small enough for a person to understand by responsibility.

- [ ] **Step 3: Add the Roles and System Boundaries content**

Use this body:

```markdown
# Roles and System Boundaries

## Decision rights
| Role | Owns | Must not decide |
| --- | --- | --- |
| Buyer procurement | Product need, destination, provider selection, commercial acceptance | Supplier compliance approval |
| Buyer QA | Ingredient specification and lot acceptance/rejection | Release of an unverified supplier |
| Buyer importer/finance | Importer acceptance, broker authority, payment approval | Food-safety release |
| Supplier commercial/export | Offer, lead time, export-document submission | Supplier self-approval |
| Supplier QA | Specifications, lot-dossier submission, corrective evidence | Supplier PCP status |
| Sattva sales | Intake completeness and commercial escalation | Supplier approval and unapproved PO confirmation |
| Sattva compliance officer | Supplier review, approval, and block decision in Odoo | Buyer payment approval |
| Sattva logistics | Provider comparison, booking readiness, exception escalation | Unapproved commercial-term changes |
| Broker, forwarder, or 3PL | Scoped service execution | Odoo, n8n, Nextcloud, or unrelated-order access |

## System boundaries
Odoo is the only source of truth for commercial and operational state. Nextcloud is the evidence vault. n8n is the integration bus. Notion provides guidance only. No page in this library authorizes a commercial, compliance, payment, or runtime-access decision.

## Supplier gate
Only a Sattva compliance officer can mark a supplier approved. Odoo blocks purchase-order confirmation for pending, review, or blocked suppliers.
```

Expected: the page communicates roles without listing users, client records, or live authority assignments.

- [ ] **Step 4: Verify the draft structure**

Verify:

```text
Parent page count: 1
Child page count: 6
All pages: GREEN, draft/inbox context under the parent with kb_layer = inbox and Status = inbox
All pages: no file uploads, live tables, prices, party names, or vault URLs
```

Expected: the page tree is navigable and cannot be mistaken for an operational database.

- [ ] **Step 5: Commit the source/design update only if a correction is required**

If creation reveals a design error, correct the git design before changing the draft content:

```bash
git add docs/superpowers/specs/2026-08-16-canada-india-dehydrated-spice-brokerage-library-design.md
git commit -m "docs: clarify brokerage library design"
```

Expected: Git stays canonical for any compliance-binding wording change.

### Task 3: Populate client, supplier, and logistics guidance

**Files:**
- Reference: `docs/superpowers/specs/2026-08-16-canada-india-dehydrated-spice-brokerage-library-design.md`
- Modify: Notion child pages `Client Onboarding`, `Supplier Qualification`, and `Logistics Coordination`

**Interfaces:**
- Consumes: Task 2 parent page and role-boundary language.
- Produces: role-specific, static document catalogues with no live completion status.

- [ ] **Step 1: Write Client Onboarding**

Use this body:

```markdown
# Client Onboarding

## One-time requirements
| Requirement | Why it is needed | Record owner |
| --- | --- | --- |
| Legal entity and billing profile | Identify the contracting principal | Odoo; sensitive evidence in Nextcloud |
| Procurement, QA, receiving, and finance contacts | Route approvals and exceptions | Odoo |
| Delivery-site and receiving-capability profile | Confirm container delivery feasibility | Odoo |
| Product acceptance specification | Define form, mesh, quality, packaging, label, and allergen requirements | Odoo; supporting files in Nextcloud |
| Importer-of-record and broker readiness | Establish Canadian import responsibility | Odoo; authorization evidence in Nextcloud |
| Initial Incoterm and delivery profile | Allocate transport, risk, and charges | Odoo |
| Provider-comparison service acknowledgement | Disclose Sattva’s comparison fee and buyer choice | Odoo; signed file in Nextcloud |

## Per-container requirements
| Requirement | Why it is needed | Record owner |
| --- | --- | --- |
| Purchase order and agreed specification | Bind quantity and acceptance criteria | Odoo |
| Selected provider approval | Record buyer-selected broker, forwarder, and 3PL scope | Odoo |
| Importer/broker release confirmation | Confirm customs-clearance authority | Odoo; evidence in Nextcloud |
| Delivery appointment and receiving instructions | Make destination handling executable | Odoo |
| Receipt, discrepancy, and acceptance record | Close the delivery or trigger a claim/CAPA | Odoo; evidence in Nextcloud |

## Escalate when
Escalate to Sattva sales, logistics, compliance, and finance when the proposed Incoterm, importer role, delivery location, product specification, provider scope, or payment allocation changes from the Odoo-approved delivery profile.
```

Expected: client users can understand requirements without seeing another client’s data.

- [ ] **Step 2: Write Supplier Qualification**

Use this body:

```markdown
# Supplier Qualification

## One-time requirements
| Requirement | Why it is needed | Record owner |
| --- | --- | --- |
| Legal registration, Indian food/export registrations, and plant identity | Establish legal exporting entity | Odoo and Nextcloud |
| QA and commercial contacts | Route evidence requests | Odoo |
| Current GFSI, HACCP, BRCGS, FSSC 22000, or equivalent evidence | Assess food-safety certification | Nextcloud; GREEN flags in Odoo |
| PCP/HACCP summary, sanitation, pest, training, recall, and traceability evidence | Establish preventive controls | Nextcloud |
| Signed NDA, code-of-conduct, and food-safety declaration | Set contractual and conduct baseline | Nextcloud; state in Odoo |
| Product capability and specification profile | Confirm form, mesh, capacity, MOQ, lead time, packaging, and controls | Odoo; supporting evidence in Nextcloud |

## Per-lot or per-container requirements
| Requirement | Why it is needed | Record owner |
| --- | --- | --- |
| Commercial invoice and packing list | Identify shipment and contents | Nextcloud; references in Odoo |
| Lot traceability and manufacturing/packing linkage | Trace product to source lot | Nextcloud; GREEN/hash references in Odoo |
| Product specification and certificate of analysis | Verify agreed quality parameters | Nextcloud; extracted GREEN values in Odoo |
| Labels, batch marks, and packaging evidence | Match product and receiving requirements | Nextcloud |
| Bill of lading or airway bill and certificate of origin where applicable | Support transport and customs process | Nextcloud; shipment state in Odoo |
| Product- or destination-specific evidence | Meet the approved compliance checklist | Nextcloud |

## Approval rule
An uncertified or incomplete supplier remains in Odoo review or blocked status. A supplier receives no purchase-order confirmation rights until a Sattva compliance officer records approval in Odoo.
```

Expected: supplier users receive a submission checklist without a mechanism to change their own approval state.

- [ ] **Step 3: Write Logistics Coordination**

Use this body:

```markdown
# Logistics Coordination

## Provider comparison
Sattva may request comparable quotations from customs brokers, forwarders, and Canadian destination 3PLs. Normalize scope, route, transit, insurance, accessorial charges, exclusions, validity, and provider responsibilities. Record the buyer’s selected provider and approved payment responsibility in Odoo.

## Provider requirements
| Provider | One-time baseline | Per-container baseline |
| --- | --- | --- |
| Customs broker | License/authority scope, service terms, escalation contact | Importer authorization, entry/release status, exception notice |
| Freight forwarder | Service capability, insurance scope, route/service terms | Booking confirmation, shipping instructions, transit exceptions |
| Destination 3PL | Food-handling capability, insurance, receiving capacity, service terms | Container/delivery appointment, handling instructions, proof of delivery, discrepancy report |

## First-container execution
1. Confirm the Odoo-approved buyer, supplier, product specification, named destination, importer role, and selected providers.
2. Do not book if the supplier is not approved or the lot dossier is incomplete.
3. Give each provider only the instructions and evidence required for its scoped service.
4. Capture delivery, discrepancy, and proof-of-delivery outcomes in Odoo with supporting evidence in Nextcloud.

## Escalate when
Escalate any inconsistent document, unapproved provider change, customs hold, damaged container, missed appointment, temperature or hygiene concern, delivery discrepancy, or quality claim.
```

Expected: logistics providers receive generic instruction and no direct system access.

- [ ] **Step 4: Verify static-content safety**

Search the three pages for prohibited content:

```text
No buyer, supplier, provider, employee, order, lot, price, quote, email, phone, bank, invoice, or file-path value.
No attachment, public share link, or embedded vault file.
No checkbox, status rollup, or database table that tracks completion.
```

Expected: only template-level guidance remains.

- [ ] **Step 5: Commit any canonical-content correction**

```bash
git add docs/superpowers/specs/2026-08-16-canada-india-dehydrated-spice-brokerage-library-design.md
git commit -m "docs: refine brokerage library catalogue"
```

Expected: only execute this commit when human review identifies a design correction.

### Task 4: Populate classification, middleware contract, and promotion record

**Files:**
- Reference: `docs/superpowers/specs/2026-08-13-sattva-versioned-kb.md`
- Reference: `docs/superpowers/specs/2026-08-16-canada-india-dehydrated-spice-brokerage-library-design.md`
- Modify: Notion child pages `Document Classification and Retention` and `Middleware Knowledge-Access Contract`
- External location: Notion Version Catalog, after human approval only

**Interfaces:**
- Consumes: Task 2 page hierarchy and Task 3 role pages.
- Produces: safe classification rules and a documented future middleware boundary; a human-owned publication record.

- [ ] **Step 1: Write Document Classification and Retention**

Use this body:

```markdown
# Document Classification and Retention

| Classification | Examples | Approved location |
| --- | --- | --- |
| RED | Certificates, COAs, signed contracts, full lab reports, identity, banking, invoice files, vault paths | Nextcloud only |
| AMBER | Partner names, live quotations, prices, Incoterms, orders, operational notes | Odoo; n8n only in transit when required |
| GREEN | Generic SOPs, document names, anonymized examples, pass/fail concepts, approved product guidance | This library and curated middleware guidance |
| PUBLIC | Approved generic marketing material | Public site after marketing approval |

## Retention
PCP evidence, COAs, and trace dossiers are retained for seven years in the approved evidence system. This library records the rule; it does not store or archive the evidence.

## Escalation
If a document cannot be safely classified, treat it as RED and send it through the approved evidence-vault process. Do not upload it to Notion, attach it to a ticket, paste it into chat, or expose it through middleware.
```

Expected: the page gives clear handling guidance without creating a copy of any document.

- [ ] **Step 2: Write Middleware Knowledge-Access Contract**

Use this body:

```markdown
# Middleware Knowledge-Access Contract

## Allowed future experience
Employees may see role-relevant SOPs and escalation paths. Buyers may see generic onboarding and delivery guidance. Suppliers may see qualification and lot-submission guidance. Logistics providers may see generic scoped-service instructions.

## Prohibited experience
Middleware is not a CRM, pricing system, document repository, or authorization source. It must not return Odoo, n8n, or Nextcloud credentials; Nextcloud paths; RED file bytes; live price lists; provider quotations; or another principal’s commercial state.

## Publication condition
Only published GREEN/PUBLIC content explicitly marked agent-readable may be selected for middleware presentation. The current library draft is not agent-readable and must not be fetched by a live portal.

## Future implementation boundary
A separate approved Phase 2 plan must define authentication, role claims, content publication selection, API contracts, RED-key contract tests, and manual verification before any middleware integration is built.
```

Expected: the page prevents a documentation project from being mistaken for a live portal feature.

- [ ] **Step 3: Run the owner review**

The three reviewers inspect the inbox draft against this exact checklist:

```text
[ ] Sattva remains a disclosed agent and does not take title by default.
[ ] DAP named Canadian destination is a default, not a universal rule.
[ ] Buyer selection and payment approval remain independent.
[ ] Supplier approval remains a compliance-only Odoo decision.
[ ] No live record, evidence file, RED content, credentials, price, or quote exists in the draft.
[ ] Each role receives only its relevant guidance.
[ ] Middleware is documented as future GREEN-only guidance, not implemented access.
```

Expected: every item is checked by a human reviewer before promotion.

- [ ] **Step 4: Human-promote the draft**

After review, the owner moves the pages from the GREEN Content inbox to:

```text
Trilok Ventures → Sattva Brokers → Knowledge Base
```

Then sets:

```text
kb_layer: Library
classification: GREEN
agent_ok: true only after a separate owner decision
status: Published
```

Expected: promotion is performed by a human in a verified closed teamspace, not by an agent.

- [ ] **Step 5: Add the Version Catalog entry**

The owner adds one Version Catalog entry:

```text
Document title: Client & Supplier Onboarding Library — Canada–India Dehydrated Spices
Canonical git file: docs/superpowers/specs/2026-08-16-canada-india-dehydrated-spice-brokerage-library-design.md
Git commit: b4197c3
Classification: GREEN
Status: Published
Notion URL: published parent-page URL
```

Expected: the Catalog records a real git commit and the exact published Notion URL.

- [ ] **Step 6: Verify the published result**

Verify all of the following:

```text
The published parent page has six child pages.
No page contains a live operational tracker or a real party’s documents.
The Version Catalog points to commit b4197c3 and the published parent page.
The parent and all child pages are inside the closed Sattva Brokers teamspace.
The middleware has received no code or configuration change.
```

Expected: the library is discoverable for authorized humans while preserving every fabric boundary.

- [ ] **Step 7: Commit the publication-reference update only if required**

If the published Notion URL is added to a git-controlled cross-reference, commit only that documentation update:

```bash
git add docs/superpowers/specs/2026-08-16-canada-india-dehydrated-spice-brokerage-library-design.md
git commit -m "docs: link published brokerage library"
```

Expected: do not add real customer, supplier, quote, order, or vault details to Git.

## Plan Self-Review

### Spec coverage

| Approved design requirement | Plan task |
| --- | --- |
| Disclosed-agent DAP baseline and client-controlled exceptions | Tasks 2 and 3 |
| Separate provider-comparison charge and independent buyer selection | Tasks 2 and 3 |
| One-time and per-container requirements for buyers, suppliers, and providers | Task 3 |
| Odoo/Nextcloud/n8n/Notion/middleware ownership boundaries | Tasks 2 and 4 |
| Supplier compliance gate preservation | Tasks 2 and 3 |
| Role-appropriate access | Tasks 2 and 3 |
| GREEN-only, non-transactional Notion library | Tasks 1 through 4 |
| Middleware as a future, constrained integration | Task 4 |
| Human review and governed publication | Task 4 |

No scope requirement is omitted. Middleware implementation, live Odoo integration, and regulatory validation are intentionally excluded because they require separate Phase 2/operational implementation plans.

### Placeholder and consistency check

The plan has no unspecified file paths, undefined interfaces, vague verification steps, or unassigned promotion owner. The two cited Git documents use the existing canonical paths, and all Notion content uses exact titles and body text.
