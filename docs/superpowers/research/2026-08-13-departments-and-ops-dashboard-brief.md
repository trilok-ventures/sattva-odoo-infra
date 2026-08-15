# Research Brief: Departments Analysis + Ops Dashboard Brainstorm

**Date:** 2026-08-13  
**HoldCo:** [Trilok Ventures](https://app.notion.com/p/3bbe8d8c60c78140a62cf7d4097fbf55)  
**OpCo hub:** [Sattva Brokers](https://app.notion.com/p/21fe8d8c60c780f8b260e20d555ef456)  
**Companion plan:** `docs/superpowers/plans/2026-08-13-sattva-gcp-cf-notion-ops-dashboard.md`  
**Fabric spec:** `docs/superpowers/specs/2026-08-13-sattva-brokers-system-fabric-design.md`

## Executive summary

The Departments block under Sattva Brokers is a navigation shell for nine functions. Most department pages are thin (Databases/Views stubs). The locked System Fabric already assigns real systems of record (Odoo / Nextcloud / n8n / Notion). The pragmatic move is **not** to rebuild department wikis, but to add a single **Ops Dashboard** fed by GREEN/AMBER webhooks, with deep links into Odoo and Nextcloud, edge-proxied via Cloudflare Tunnel into a GCP Compose-on-VM runtime.

Hand-drawn architecture (`sattva.trilokventures.org` → landing → auth → Custom Middleware → Nextcloud / Odoo / n8n) aligns with Tool Fabric if middleware stays a **role router** and n8n stays the only bus.

## Departments inventory

| Department | Notion depth today | Real work lives in | Ops Dashboard signal |
| --- | --- | --- | --- |
| Business Intelligence | Models/CAPA/forecast pages | GREEN extracts from Odoo | KPI cards only |
| Sales & BD | Templates + Lead Database (kill as SoR) | Odoo CRM | Pipeline stage events |
| Supplier & Procurement | Stub | Odoo Purchase + PCP gate | `vendor.pcp` events |
| Compliance & Regulatory | Stub | Odoo gates + Nextcloud PCP paths | `coa.verify` pass/fail |
| Logistics & Ops | Stub | Odoo shipment records | lot quarantine status |
| Finance & Accounts | Stub | Odoo Accounting | `invoice.posted` |
| IT & Data Management | Fabric pointers | GCP + n8n + CF | webhook health |
| Marketing & Branding | Stub | Vercel + GREEN Content DB | content publish (later) |
| Human Resources | Stub | Role → Access mapping | none until hire |

**90-day operating set** already labels empty department shells and the Notion Lead Database as shelfware. Do not promote them.

## Architecture decision (brainstorm → lock)

### Recommended topology

```
Public / Buyer GREEN     Employees (Access)           RED vault
─────────────────       ───────────────────         ──────────
Vercel marketing   →    CF Access + Tunnel     →    Nextcloud
Buyer portal (P2)  →    Middleware role claim  →    (no buyer DNS)
                        ├─ Odoo CE (SoR)
                        ├─ n8n (bus only)
                        └─ Notion Ops (status)
```

1. **Phase 1:** Compose (Odoo + Postgres + Nextcloud + n8n + Redis) + CF Tunnel multi-hostname.
2. **Phase 3:** Same Compose on one GCP VM; Cloud SQL when needed; GCS WORM for 7-year retention; IAP/Armor only if buyer/audit requires.
3. **Reject now:** GKE-first, HubSpot CRM, department DB rewrite, Notion as file vault, Buyers hitting Nextcloud.

### Integrity contract

- Odoo stores `nextcloud_folder_path` + `nextcloud_folder_checksum` (SHA-256 of evidence package pointer / latest COA).
- PDFs never leave Nextcloud/GCS toward Notion, HF, Tavily, or HubSpot.
- n8n execution success payloads omit file bytes (`EXECUTIONS_DATA_SAVE_ON_SUCCESS=none`).

### Live webhook catalog (safe)

| Event | Source | Notion fields |
| --- | --- | --- |
| `vendor.pcp_status_changed` | Odoo | partner name, status, Odoo URL |
| `vendor.folder_provisioned` | n8n | path, partner id |
| `lot.coa_verified` | n8n | result, GREEN metrics, checksum, vault path |
| `po.blocked` | Odoo | PO name, reason, supplier status |
| `invoice.posted` | Odoo | invoice number, amount (AMBER — employee-only DB view) |

## Role access

| Role | Notion | Odoo | Nextcloud | n8n |
| --- | --- | --- | --- | --- |
| Employee | Ops + KB (RBAC) | Group ACL | Path ACL | IT only |
| Buyer | GREEN subtree / portal | Portal/API GREEN | Never | Never |
| Supplier | SOP subset | Limited portal | Controlled upload only | Never |
| Investor | Investor one-pager + GREEN | Never | Never | Never |

## Tasks board setup

Existing **Tasks DB** under LifeOS is the wrong plane. Create **Fabric Implementation Tasks** under Sattva Knowledge Base / System Fabric. Template inspiration: https://notion.notion.site/code-with-notion-board — duplicate only if a fresh board is preferred; otherwise create typed tasks DB via MCP under the OpCo KB.

## Risks

| Risk | Mitigation |
| --- | --- |
| Dual-SoR creep via department DBs | Stop list; kill Lead Database as SoR |
| RED in Notion via “helpful” uploads | Access policy + agent instructions + no file props on Ops Events |
| Overbuilt middleware | Spec as JWT role router only until Phase 2 portals |
| Budget overrun (GKE) | Compose-on-VM primary path |
| LifeOS leakage | Closed Trilok teamspace before invites |

## Sources

- Notion: Trilok Ventures, Sattva Brokers, System Fabric children, Access policy, 90-day operating set, IT & Data Management
- Repo branches: `cursor/sattva-system-fabric-spec-7285`, `cursor/prod-deploy-blueprint-9921`, `cursor/cf-tunnel-runbook-9921`
- Hand-drawn architecture for `sattva.trilokventures.org`
