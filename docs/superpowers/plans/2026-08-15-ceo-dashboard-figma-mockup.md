# CEO Dashboard Figma Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, sanitized Figma mockup of the Sattva Brokers CEO dashboard's internal weekly, investor, board, drill-down, and integration-readiness views.

**Architecture:** The existing `Sattva Middleware` Figma file is the design artifact. The mockup uses fictional sanitized content and explicitly separates the AMBER internal control room from GREEN/PUBLIC investor and board states. It does not create a runtime dashboard, connect to systems, or deploy to Vercel.

**Tech Stack:** Figma design file `NcyHhLoppe3f72fs5KjrvP`, Figma MCP, existing Sattva Middleware design conventions.

## Global Constraints

- Odoo CE remains the operational system of record; the mockup contains derived display content only.
- Nextcloud evidence, vault paths, files, credentials, PII, lab-report details, and bank data never appear in any frame.
- The internal weekly control room is AMBER and is not a Vercel surface.
- Investor and board frames use only GREEN/PUBLIC fictional or sanitized content.
- n8n is shown only as sanitized readiness/health metadata; it is never a business-state source.
- Integration cards must use `planned`, `implemented`, or `accepted`, never imply unavailable systems are live.
- Figma examples must visibly indicate mock/sanitized data.
- Do not add a Cloudflare Agent, a dashboard datastore, or a workflow bus.

---

## File Structure

| Artifact | Responsibility |
| --- | --- |
| Figma file `NcyHhLoppe3f72fs5KjrvP` | Contains named dashboard frames and reusable visual primitives |
| `docs/superpowers/specs/2026-08-14-ceo-dashboard-mockup-design.md` | Canonical content, classification, and interaction contract |
| `docs/superpowers/mocks/sattva-middleware-portal.html` | Existing HTML twin; reference only unless separately approved for synchronization |

### Task 1: Verify the Figma editing surface and design-system assets

**Files:**
- Modify: Figma file `NcyHhLoppe3f72fs5KjrvP`
- Reference: `docs/superpowers/specs/2026-08-14-ceo-dashboard-mockup-design.md`

**Interfaces:**
- Consumes: the CEO dashboard mockup contract and the existing Figma file.
- Produces: a component, variable, and style inventory for the dashboard frames.

- [ ] **Step 1: Confirm that Figma MCP canvas-write access is available**

Run the Figma MCP `get_metadata` call for file key `NcyHhLoppe3f72fs5KjrvP`.

Expected: the response lists the existing Figma pages and does not return a Starter-plan rate-limit response.

- [ ] **Step 2: Discover reusable assets before creating frames**

Run Figma MCP `get_libraries` and separate `search_design_system` calls for:

```text
dashboard card
button
navigation
background
foreground
space
radius
heading
```

Expected: a recorded list of reusable components, variables, and text/effect styles. If no matching design-system assets exist, record that result and use a minimal local visual primitive only for the static mockup.

- [ ] **Step 3: Inspect current Sattva Middleware frame conventions**

Run Figma MCP `get_metadata` for page `0:1`, then inspect the existing `E1 · Ops Dashboard`, `E2 · Compliance Review Queue`, and `B2 · Buyer Order Detail` frames.

Expected: frame names, sizing, type styles, and component-instance conventions are known before new CEO frames are created.

- [ ] **Step 4: Commit the plan artifact**

```bash
git add docs/superpowers/plans/2026-08-15-ceo-dashboard-figma-mockup.md
git commit -m "Plan CEO dashboard Figma mockup"
```

Expected: the plan is versioned before Figma work begins.

### Task 2: Create the internal Weekly Control Room frame

**Files:**
- Modify: Figma file `NcyHhLoppe3f72fs5KjrvP`
- Reference: `docs/superpowers/specs/2026-08-14-ceo-dashboard-mockup-design.md:26-36`

**Interfaces:**
- Consumes: approved components, variables, styles, and the control-room content contract.
- Produces: frame `CEO · Weekly Control Room` with mock AMBER content and no executable operations.

- [ ] **Step 1: Build the frame wrapper**

Create a desktop-width frame named `CEO · Weekly Control Room` with visible labels:

```text
Internal / AMBER
Mock data — not a live operating system
As of: illustrative timestamp
```

Expected: the frame is separate from investor and board frames and its title signals internal classification.

- [ ] **Step 2: Add the three primary control tiles**

Add tiles using fictional values:

```text
PCP gate — 4 awaiting review — Mock · Odoo source
Lot release — 3 quarantined — Mock · Odoo source
Cash — 6 unpaid invoices — Mock · Finance-only
```

Expected: each tile visibly includes source and confidence; no partner names, prices, identifiers, or evidence references appear.

- [ ] **Step 3: Add the decision-oriented lower panels**

Add:

```text
Exception-to-decision queue
Metric confidence: Live / Delayed / Not instrumented
Phase-gate scorecard: Planned / Implemented / Accepted
Decision rail: three priorities
```

Expected: the queue explains a next decision and points to Odoo for execution; it provides no approve, confirm, release, or evidence-view control.

- [ ] **Step 4: Validate the internal frame**

Run Figma MCP `get_screenshot` for `CEO · Weekly Control Room`.

Expected: the primary tiles appear before lower panels; text is not clipped; AMBER status is visually distinguishable; no RED content appears.

### Task 3: Create the GREEN/PUBLIC investor and board frames

**Files:**
- Modify: Figma file `NcyHhLoppe3f72fs5KjrvP`
- Reference: `docs/superpowers/specs/2026-08-14-ceo-dashboard-mockup-design.md:38-48`

**Interfaces:**
- Consumes: the visual primitives from Task 2 and the external disclosure contract.
- Produces: frames `CEO · Monthly Investor Update` and `CEO · Quarterly Board Pack`.

- [ ] **Step 1: Create the investor-update frame**

Use the following visible sections:

```text
Monthly progress
Compliance readiness trend
Lot release trend
Delivery reliability trend
Milestones
Material risk
Support requested
Publication check: GREEN/PUBLIC approved
```

Expected: values are directional or fictional aggregates only; the frame contains no Odoo link, cash detail, counterparty, exception owner, or vault reference.

- [ ] **Step 2: Create the quarterly-board frame**

Use the following visible sections:

```text
Quarter overview
Trend summary
Phase-gate scorecard
Risks and controls
Capital and hiring asks
Board actions: approve / defer / request evidence
```

Expected: board actions are presentation controls only; the frame does not create operational tasks or change source-system records.

- [ ] **Step 3: Validate disclosure separation**

Run Figma MCP `get_screenshot` for both frames and compare against the weekly frame.

Expected: external frames omit all AMBER/RED values and visibly state `GREEN/PUBLIC`.

### Task 4: Create the exception drill-down and integration-readiness frames

**Files:**
- Modify: Figma file `NcyHhLoppe3f72fs5KjrvP`
- Reference: `docs/superpowers/specs/2026-08-14-ceo-dashboard-mockup-design.md:50-73`

**Interfaces:**
- Consumes: the weekly control-room design language and classification contract.
- Produces: frames `CEO · Exception Drill-down` and `CEO · Integration Readiness`.

- [ ] **Step 1: Create the exception drill-down frame**

Use these sections:

```text
Exception detail
Control state
Owner
Age
Source: Odoo record
Metric confidence
Recommended decision
Open Odoo record
Decision-log context
```

Expected: the only execution affordance is `Open Odoo record`; the frame contains no supplier approval, PO confirmation, lot release, or evidence download control.

- [ ] **Step 2: Create the integration-readiness frame**

Create cards for:

```text
Odoo CE — operational system of record — mapped first
Nextcloud — RED evidence vault — planned in Phase 1
n8n — pass-through integration bus — planned in Phase 1
Keycloak + Cloudflare — identity and edge protection — planned in Phase 3
GitHub — code and workflow-definition source — present
```

Each card must show:

```text
Owner
Classification
Source of truth
Planned / Implemented / Accepted
Last verified time when available
Next acceptance evidence
```

Expected: no card displays hostnames, internal IDs, credentials, payloads, error bodies, execution logs, or vault paths.

- [ ] **Step 3: Validate both supporting frames**

Run Figma MCP `get_screenshot` for both frames.

Expected: drill-down is decision-focused; readiness distinguishes unavailable planned services from live ones.

### Task 5: Add navigation and complete visual verification

**Files:**
- Modify: Figma file `NcyHhLoppe3f72fs5KjrvP`
- Reference: `docs/superpowers/specs/2026-08-14-ceo-dashboard-mockup-design.md:97-106`

**Interfaces:**
- Consumes: all five CEO dashboard frames.
- Produces: visible navigation relationships and a validated static mockup set.

- [ ] **Step 1: Add visible mock navigation**

Add labelled navigation controls:

```text
Weekly Control Room → Exception Drill-down
Weekly Control Room → Integration Readiness
Weekly Control Room → Monthly Investor Update
Monthly Investor Update → Quarterly Board Pack
Quarterly Board Pack → Decision-log context
```

Expected: labels make audience changes and drill-down destinations clear; controls are static prototypes and do not imply write access.

- [ ] **Step 2: Run the classification review**

Inspect all five frames and verify:

```text
No COA, PDF, lab detail, PII, bank data, vault path, credential, hostname, payload, or production secret.
No named counterparty, price, cash detail, owner assignment, Odoo link, or AMBER content in investor/board frames.
Every sample is marked mock or sanitized.
Every readiness state is planned, implemented, or accepted.
```

Expected: all checks pass before the mockup is presented.

- [ ] **Step 3: Capture final evidence**

Run Figma MCP `get_screenshot` for each CEO frame:

```text
CEO · Weekly Control Room
CEO · Monthly Investor Update
CEO · Quarterly Board Pack
CEO · Exception Drill-down
CEO · Integration Readiness
```

Expected: screenshots show readable text, no overlaps, and the intended classification split.

- [ ] **Step 4: Commit any repository-side mockup references only if changed**

```bash
git status --short
```

Expected: do not commit Figma-only changes as fabricated repository artifacts. Commit only an intentional repository-side reference or documentation change if one was made.

## Plan Self-Review

- Spec coverage: Tasks 2–5 cover the internal control room, investor and board views, read-only drill-down, integration readiness, classification boundaries, phase states, and visual verification.
- Placeholder scan: no incomplete markers are present.
- Interface consistency: all tasks use the same five named Figma frames and the same `planned`/`implemented`/`accepted` readiness vocabulary.
