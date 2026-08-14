# Sattva Brokers Layered System Diagram

**Status:** Proposed knowledge-capture design  
**Date:** 2026-08-14  
**Owner:** Sattva Brokers OpCo (knowledge); IPCo (source definitions)  
**Canonical architecture sources:**

- `docs/superpowers/specs/2026-08-13-sattva-brokers-system-fabric-design.md` (locked)
- `docs/superpowers/specs/2026-08-14-integrated-system-architecture.md` (proposed; subordinate to the locked fabric)
- `docs/superpowers/specs/2026-08-13-sattva-versioned-kb.md` (locked)

## Purpose

Publish a single Mermaid diagram in the Sattva Brokers Notion area that presents the
operating fabric in a layered retail-architecture style. It must make the current
Phase 0 baseline visually distinct from Phase 1–3 target components, while preserving
the system-of-record, data-classification, compliance, and phase-gating rules.

This is a knowledge artifact only. It does not deploy, configure, or approve any
runtime component.

## Placement and classification

- **Destination:** `Trilok Ventures → Sattva Brokers`; never LifeOS.
- **Notion role:** GREEN/AMBER process knowledge index. Git remains canonical for
  locked architecture specifications.
- **Forbidden content:** RED files, secrets, live prices, POs, customer/supplier
  records, or other transactional data.
- **Working title:** `Sattva Brokers — Layered System Fabric`.

## Diagram composition

The page uses one Mermaid `flowchart TB` with four horizontal conceptual layers:

1. **Actors and governance:** employees, buyers/suppliers, compliance, GitHub, and
   Notion.
2. **GREEN/PUBLIC edge:** Vercel marketing/buyer UI, Tavily research, and Hugging
   Face models. These endpoints receive only GREEN or PUBLIC material.
3. **AMBER operating fabric:** Odoo CE 18, Postgres, the PCP purchase-order gate,
   and future n8n/Redis integration services.
4. **RED evidence and production controls:** Nextcloud evidence vault, future GCS
   WORM retention, Secret Manager, Keycloak, Cloudflare, and the phase-gated GCP
   runtime.

The diagram includes a compact legend:

- `P0 current` uses a solid-outline node.
- `P1`, `P2`, and `P3` nodes include an explicit phase tag.
- Solid arrows represent the current Odoo ↔ Postgres baseline or a system-of-record
  relationship. Dashed arrows represent planned flows.
- Zones and flow labels carry RED, AMBER, GREEN, or PUBLIC classifications.

## Required system boundaries

| Component | Diagram label | Phase | Role |
| --- | --- | --- | --- |
| Odoo CE 18 + `sattva_compliance` | `P0 CURRENT · Operational SoR` | P0 | Partners, PCP status, POs, lots, invoices |
| Postgres 15 | `P0 CURRENT · Odoo database` | P0 | Odoo persistence only |
| n8n + Redis | `P1 PLANNED · pass-through fabric` | P1 | Integration/queue; no business state and no persisted RED payload |
| Nextcloud | `P1 PLANNED · RED evidence SoR` | P1 | COAs, PCP packs, certificates |
| Vercel buyer UI | `P2 PLANNED · GREEN UI` | P2 | Read-only GREEN status; no direct vault access |
| Tavily / Hugging Face | `P2 PLANNED · GREEN-only` | P2 | Research and model inference on sanitized extracts |
| Cloudflare / Keycloak / GCP runtime / GCS WORM / Secret Manager | `P3 PLANNED · production controls` | P3 | Network/identity/runtime, retention, and secrets |
| GitHub | `SoR · code/specs/workflows` | P0 | Versioned source definitions |
| Notion | `SoR · knowledge` | P0 | Policies, SOPs, decisions, and approved briefs |

The diagram must not claim that n8n, Nextcloud, Redis, Keycloak, Cloudflare, GCP,
the buyer portal, or WORM retention is presently deployed. It also must not blend the
locked fabric's future GKE/Cloud Run wording with the operational spec's proposed
single-VM topology as an established deployment.

## Flows and controls

1. **Supplier compliance:** a vendor begins in Odoo as `pending`; evidence is stored
   in Nextcloud once Phase 1 is implemented; a compliance officer sets `approved`;
   only then can Odoo confirm a PO. Sales, Notion, and n8n cannot approve suppliers
   or bypass the gate.
2. **Lot verification:** a COA remains RED in Nextcloud. n8n may extract and send
   GREEN measurements and a hash to Odoo, then write pass/fail or CAPA state there.
   n8n execution logs must not retain the PDF or other RED payload.
3. **Buyer experience:** Phase 2 browsers access a Vercel/middleware surface that
   shows GREEN status only. Browsers never access the vault, n8n editor, or Odoo
   directly.
4. **Promotion:** GitHub is the source for addon code, infrastructure, and n8n
   workflow JSON. Production credentials are supplied only through Phase 3 Secret
   Manager.

## Error and safety signals

The diagram calls out three visible guardrails:

- A PO confirmation attempt for a non-approved supplier is blocked in Odoo.
- A COA parse failure or specification mismatch leaves the lot quarantined and opens
  a compliance action; it never becomes buyer-visible as available.
- RED material is blocked from Vercel, Tavily, Hugging Face, Vertex AI, and marketing
  destinations.

## Validation and publication

1. Draft the Mermaid code from this design and validate that it parses.
2. Check every node and flow against the locked fabric's SoR register, classification
   table, and phase gates.
3. Search the `Trilok Ventures → Sattva Brokers` Notion area for the exact title
   before creating a page; reuse or obtain user confirmation if one already exists.
4. Create the page under the Sattva Brokers OpCo location with a short scope note,
   Mermaid diagram, legend, phase key, and the three source-spec references.
5. Add a Git canonical-source notice. If the artifact becomes an auditor-facing twin,
   add the committing SHA and catalog it under the knowledge-plane process.

## Scope

**In scope:** the Notion architecture page and its compliant Mermaid diagram.

**Out of scope:** new runtime services, changes to Compose, GCP/Cloudflare/Keycloak
configuration, live Vercel integration, Odoo behavior changes, and changes to the
locked architecture specifications.
