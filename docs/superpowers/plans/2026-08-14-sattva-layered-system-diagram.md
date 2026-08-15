# Sattva Brokers Layered System Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a compliant Mermaid architecture diagram in a new Sattva Brokers Notion page.

**Architecture:** Create one layered `flowchart TB` that separates the current Phase 0 Odoo baseline from planned Phase 1–3 components. The page will render system-of-record boundaries, classified flows, and compliance controls without representing proposed infrastructure as deployed.

**Tech Stack:** Mermaid flowchart syntax; Notion MCP; Git-canonical architecture specifications.

## Global Constraints

- Create the page under `Trilok Ventures → Sattva Brokers` (`21fe8d8c60c780f8b260e20d555ef456`), never LifeOS.
- Label all current components `P0 CURRENT`; label target components `P1 PLANNED`, `P2 PLANNED`, or `P3 PLANNED`.
- Odoo is the operational SoR; Nextcloud/GCS WORM is the RED evidence SoR; GitHub is the code/spec/workflow SoR; Notion is the knowledge SoR; n8n is pass-through only.
- RED files must not flow to Vercel, Tavily, Hugging Face, Vertex AI, or marketing destinations. n8n must not persist RED payloads.
- Preserve the PCP rule: only a compliance officer can approve a supplier, and Odoo blocks PO confirmation until `supplier_pcp_status = approved`.
- Do not add infrastructure, configure services, change runtime files, or modify locked specifications.

---

## File Structure

- Create: Notion page `Sattva Brokers — Layered System Fabric` under the Sattva Brokers OpCo page.
- Read: `docs/superpowers/specs/2026-08-13-sattva-brokers-system-fabric-design.md`.
- Read: `docs/superpowers/specs/2026-08-14-integrated-system-architecture.md`.
- Read: `docs/superpowers/specs/2026-08-13-sattva-versioned-kb.md`.
- Read: `docs/superpowers/specs/2026-08-14-sattva-layered-system-diagram-design.md`.

### Task 1: Validate and publish the Notion architecture page

**Files:**
- Create: Notion page `Sattva Brokers — Layered System Fabric`
- Read: `docs/superpowers/specs/2026-08-14-sattva-layered-system-diagram-design.md`
- Test: Mermaid parse/render validation for the page diagram

**Interfaces:**
- Consumes: the approved design specification and the three canonical architecture specifications.
- Produces: one GREEN/AMBER knowledge page containing the scope note, Mermaid diagram, legend, phase key, guardrails, and canonical-source references.

- [ ] **Step 1: Search the Sattva Brokers Notion area for an existing page**

Use the Notion search tool with the exact title `Sattva Brokers — Layered System Fabric`.

Expected: no exact-title child exists under `Trilok Ventures → Sattva Brokers`. If an exact-title child exists, stop and ask the user whether to reuse it or create a second page.

- [ ] **Step 2: Create the Mermaid diagram text**

Write this exact Mermaid source to `/tmp/sattva-layered-system-fabric.mmd`:

```bash
cat > /tmp/sattva-layered-system-fabric.mmd <<'EOF'
flowchart TB
  classDef current fill:#00a651,stroke:#056b36,color:#fff,stroke-width:2px;
  classDef planned fill:#dff3e6,stroke:#00a651,color:#173b28,stroke-dasharray: 5 5;
  classDef sor fill:#f6c85f,stroke:#8a5d00,color:#1f1f1f,stroke-width:2px;
  classDef guard fill:#f9d6d5,stroke:#a22,color:#5c1111,stroke-width:2px;
  classDef red fill:#c62828,stroke:#6d1111,color:#fff,stroke-dasharray: 5 5;

  subgraph actors["Actors & governance"]
    Employee[Employees<br/>P0 CURRENT]:::current
    Compliance[Compliance officer<br/>P0 CURRENT]:::current
    Buyer[Buyer / supplier browser<br/>P2 PLANNED]:::planned
    GitHub[GitHub<br/>P0 CURRENT · SoR: code, specs, workflow JSON]:::sor
    Notion[Notion<br/>P0 CURRENT · SoR: policies, SOPs, decisions]:::sor
  end

  subgraph green["GREEN / PUBLIC edge"]
    Vercel[Vercel marketing + buyer UI<br/>P2 PLANNED · GREEN/PUBLIC only]:::planned
    Tavily[Tavily research<br/>P2 PLANNED · GREEN only]:::planned
    HF[Hugging Face inference<br/>P2 PLANNED · GREEN only]:::planned
  end

  subgraph amber["AMBER operating fabric"]
    Odoo[Odoo CE 18<br/>P0 CURRENT · Operational SoR]:::current
    Gate[PCP compliance gate<br/>P0 CURRENT · approved required for PO confirm]:::guard
    PG[(Postgres 15<br/>P0 CURRENT · Odoo database)]:::current
    N8N[n8n + Redis<br/>P1 PLANNED · pass-through only<br/>no persisted RED payload]:::planned
  end

  subgraph redzone["RED evidence & production controls"]
    Nextcloud[Nextcloud<br/>P1 PLANNED · RED evidence SoR]:::red
    GCS[GCS WORM retention<br/>P3 PLANNED]:::red
    Controls[Cloudflare + Keycloak + GCP runtime<br/>P3 PLANNED · access, identity, runtime]:::planned
    Secrets[Secret Manager<br/>P3 PLANNED · secrets only]:::red
  end

  Employee --> Odoo
  Compliance -->|approves supplier in Odoo| Gate
  Gate -->|permits only approved supplier| Odoo
  Odoo --> PG
  GitHub -->|versioned deploy definitions| Odoo
  GitHub -. P1 planned workflow promotion .-> N8N
  Notion -. GREEN / AMBER knowledge only .-> Employee
  Buyer -. P2 GREEN status only .-> Vercel
  Vercel -. P3 authenticated server-side access .-> Controls
  N8N -. P1 planned AMBER metadata / GREEN hash .-> Odoo
  N8N -. P1 planned RED file transfer only .-> Nextcloud
  Nextcloud -. P3 planned retention .-> GCS
  Secrets -. P3 planned boot-time secrets .-> Controls
  Tavily -. P2 GREEN briefs .-> Notion
  HF -. P2 GREEN results only .-> Odoo
EOF
```

- [ ] **Step 3: Validate that the Mermaid source parses**

Run:

```bash
npx --yes @mermaid-js/mermaid-cli \
  --input /tmp/sattva-layered-system-fabric.mmd \
  --output /tmp/sattva-layered-system-fabric.svg
```

Expected: exit code `0` and `/tmp/sattva-layered-system-fabric.svg` exists. If parsing fails, correct only Mermaid syntax; do not alter the approved components, phase labels, systems of record, or flow constraints.

- [ ] **Step 4: Create the Notion page under the OpCo hub**

Create a new child page of `21fe8d8c60c780f8b260e20d555ef456` titled
`Sattva Brokers — Layered System Fabric` with these exact blocks:

1. Heading `Scope`, followed by:
   `This GREEN/AMBER knowledge view depicts the current Phase 0 baseline and phase-gated P1–P3 target fabric. It is a navigation aid, not a deployment record. Git remains canonical for the source specifications.`
2. Heading `Architecture`, followed by a Mermaid code block whose content is read
   unchanged from `/tmp/sattva-layered-system-fabric.mmd`.
3. Heading `Legend`, followed by these bullets:
   - `Solid green nodes and lines: P0 CURRENT baseline or a canonical system-of-record relationship.`
   - `Dashed nodes and lines: P1–P3 PLANNED components and flows; they are not deployed.`
   - `RED: evidence, retention, and secret-handling boundary.`
   - `AMBER: operational data inside Odoo and in-transit through n8n.`
   - `GREEN/PUBLIC: buyer status, research, inference, and marketing-safe material only.`
4. Heading `Guardrails`, followed by these bullets:
   - `Odoo is the only operational record for partners, PCP status, lots, POs, invoices, and CRM data.`
   - `A supplier must be approved by compliance before Odoo permits PO confirmation.`
   - `Nextcloud/GCS WORM holds RED evidence; the browser never receives vault credentials.`
   - `n8n passes data between systems but does not hold business state or RED execution logs.`
   - `RED material never reaches Vercel, Tavily, Hugging Face, Vertex AI, or marketing destinations.`
   - `Phase 3 infrastructure remains proposed until preceding phase acceptance criteria pass.`
5. Heading `Canonical sources`, followed by these bullets:
   - `docs/superpowers/specs/2026-08-13-sattva-brokers-system-fabric-design.md (locked)`
   - `docs/superpowers/specs/2026-08-14-integrated-system-architecture.md (proposed; subordinate to the locked fabric)`
   - `docs/superpowers/specs/2026-08-13-sattva-versioned-kb.md (locked)`
   - `docs/superpowers/specs/2026-08-14-sattva-layered-system-diagram-design.md (approved publication design)`

Expected: the created page is a child of the Sattva Brokers OpCo page, contains no RED documents or secrets, and returns a stable Notion page URL.

- [ ] **Step 5: Verify the published page**

Check the returned page title, parent, and rendered Mermaid block. Confirm:

```text
title  = Sattva Brokers — Layered System Fabric
parent = Trilok Ventures → Sattva Brokers
P0     = Odoo CE 18, Postgres 15, PCP compliance gate
P1     = n8n/Redis and Nextcloud
P2     = Vercel, Tavily, Hugging Face
P3     = Cloudflare, Keycloak, GCP, GCS WORM, Secret Manager
```

Expected: every component has an explicit phase and no planned service is represented as active.

- [ ] **Step 6: Commit the implementation-plan record**

Run:

```bash
git add docs/superpowers/plans/2026-08-14-sattva-layered-system-diagram.md
git commit -m "docs: plan layered Sattva fabric page"
git push -u origin cursor/sattva-layered-fabric-bbdd
```

Expected: the plan commit is present on the existing branch and the draft PR reflects it.
