# Trilok Ventures — Sattva Brokers Versioned Knowledge Base

**Status:** Locked design (Phase 0 knowledge plane)  
**Date:** 2026-08-13  
**Owner:** Sattva Brokers OpCo (content); IPCo (git-locked specs)  
**Companion:** `docs/superpowers/specs/2026-08-13-sattva-brokers-system-fabric-design.md`  
**HoldCo:** https://app.notion.com/p/3bbe8d8c60c78140a62cf7d4097fbf55  
**OpCo hub:** https://app.notion.com/p/21fe8d8c60c780f8b260e20d555ef456  
**OpCo knowledge base:** https://app.notion.com/p/3bbe8d8c60c78198b879e272e52dd5d4

This document is the git-canonical architecture for the company knowledge plane. It does not replace the fabric spec. It says where knowledge lives, how it is versioned, who may see it, and what agents may read or write.

---

## 1. Purpose

Keep Trilok / Sattva operating knowledge in one place that investors and hires can be invited into, without exposing LifeOS personal pages (workout, budget, hobbies, leave).

**Done when**

1. **Trilok Ventures** is a workspace top-level page, sibling of LifeOS. Sattva Brokers is its OpCo. The versioned KB is a child of that OpCo — not a child of LifeOS.
2. Git is the immutable version for locked / auditor-facing docs; Notion indexes SHA + URL.
3. RED files stay in Nextcloud. Notion holds process wiki and GREEN extracts only.
4. Agents read only `agent_ok` + GREEN/PUBLIC + Published. They write GREEN Content inbox, never the library.
5. “Approved team members” means a **closed teamspace**, not a private-page guest list. Until that teamspace exists, only Ninad can open the KB.

---

## 2. Placement

```
Ninad’s Notion (keep this workspace; do not add company as workspace-wide members)
├── Private (Ninad only)
│   └── LifeOS ← personal + scratch; never share
│       └── TRILOK VENTURES ← logo/prompt scratch; not the HoldCo
├── Trilok Ventures (HoldCo home — sibling of LifeOS)
│   ├── Sattva Brokers (OpCo)
│   │   ├── Knowledge Base ← this spec’s Notion hub
│   │   ├── departments, System Fabric twin
│   │   └── …
│   ├── IPCo (software, brand, n8n JSON)
│   └── AssetCo (vault / KMS pointers; no RED files in Notion)
└── Nextcloud vault ← RED + AMBER files
```

**Interim (now):** this tree is private to Ninad. Do not invite sales, investors, or guests.

**Target:** restore trashed teamspace `Sattva Brokers` (`328e8d8c-60c7-81d3-923b-00423d4f814a`) or create a **closed** `Trilok Ventures` teamspace, then **move the HoldCo tree** into it.

MCP cannot restore teamspaces or set page ACLs. Those steps are Notion UI only.

---

## 3. Planes (do not mix)

| Plane | What lives there | What must not |
| --- | --- | --- |
| This KB | Versioned policies, SOPs, decisions, investor pack, GREEN research after human review | RED files; live quotes/POs/price lists; LifeOS personal pages |
| Trilok Ventures | HoldCo entity map; OpCo / IPCo / AssetCo homes | LifeOS personal pages; vault PDFs |
| LifeOS | Personal + scratch operating notes | Company invitees, investors, agents scoped to OpCo |
| Odoo | Leads, quotes, POs, invoices, partners, PCP status, lots | Notion as a second CRM |
| Nextcloud | RED files: COAs, PCP packs, certificates | Public share links |
| GitHub | Locked specs, addons, n8n JSON | Unversioned “source of truth” only in Notion |

A Notion Sales Lead Database contradicts Odoo as CRM SoR. Kill or freeze it; do not rebuild it in this KB.

---

## 4. Hub structure

HoldCo → OpCo → KB. Do not clone department wikis into empty shells. Other charter OpCos (TenderCo, TES, Metal, Flyer) stay LifeOS scratch until they earn a page.

| Node | Notion | Role |
| --- | --- | --- |
| HoldCo | [Trilok Ventures](https://app.notion.com/p/3bbe8d8c60c78140a62cf7d4097fbf55) | Layer A home; sibling of LifeOS |
| OpCo hub | [Sattva Brokers](https://app.notion.com/p/21fe8d8c60c780f8b260e20d555ef456) | Layer B operating surface + departments |
| IPCo | [IPCo](https://app.notion.com/p/3bbe8d8c60c781a39378f70f97ffdba6) | Software / brand pointers |
| AssetCo | [AssetCo](https://app.notion.com/p/3bbe8d8c60c781da8a54ee7613e9a861) | Vault pointers; no RED files |
| Hub | [KB root](https://app.notion.com/p/3bbe8d8c60c78198b879e272e52dd5d4) | Index + stop list + fabric reminder |
| Version Catalog | [database](https://app.notion.com/p/c6467eb65b354b81be163e95d9e1c60a) | Doc ID `SBK-*`; SHA; Notion URL; Published / Git-locked views; `Supersedes` / `Superseded by` |
| SOPs | [database](https://app.notion.com/p/179c903838924beda3ecd6d5bfa74d7f) | Working SOPs; Catalog relation; By department board |
| Decisions log | [database](https://app.notion.com/p/211624078e8944799364046196917236) | ADR-style; Locked when fabric-binding |
| GREEN Content | [database](https://app.notion.com/p/dc7b9bd551be48c4bf878af04d37a9b8) | Inbox vs Library via `kb_layer`; no HubSpot source enum |
| How to use | [page](https://app.notion.com/p/3bbe8d8c60c781cd8f78f2e81440fdea) | Human operating instructions |
| Access policy | [page](https://app.notion.com/p/3bbe8d8c60c78152a991d1d236ef1808) | Interim vs Phase-1; anti-patterns |
| Agent Instructions | [page](https://app.notion.com/p/3bbe8d8c60c781c5bbb8ec48efaee81e) | `agent_ok` contract |
| Classification cheat sheet | [page](https://app.notion.com/p/3bbe8d8c60c781b28d53ec256955f7d9) | RED/AMBER/GREEN/PUBLIC |
| Investor one-pager | [page](https://app.notion.com/p/3bbe8d8c60c7814f8d14ce3c9f20d5c8) | GREEN/PUBLIC subtree only |
| 90-day operating set | [page](https://app.notion.com/p/3bbe8d8c60c78145b5a4f1d7bcdae5f5) | Minimum working set for Year-1 |

Working twin of the fabric spec lives under the OpCo hub: https://app.notion.com/p/3bbe8d8c60c7816ba0def605bf847c5a

---

## 5. Versioning

| Kind | Canonical | Notion role |
| --- | --- | --- |
| Locked / auditor-facing (fabric spec, this spec, n8n JSON, addon source) | Git SHA | Catalog row with SHA + URL. Check **Drift** if the twin is edited after the SHA. |
| Working SOPs | Notion until promotion | Draft → review → Catalog row; then git if the SOP is compliance-binding. |
| Decisions | Notion log; git when they bind the fabric | Locked status in the log. |
| GREEN briefs | Notion GREEN Content | Inbox until a human promotes to Library. |

Promotion path: edit in Notion → human review → commit git if locked → catalog SHA + Notion URL → mark Published. Do not put a SHA on a page that has no git file.

Existing fabric twins under the OpCo hub do not yet all carry SHAs. Fabric spec SHA `630787f1ca9ca485464544aef92c52ebb8700a47` was seeded; this spec is catalogued at `14342d1`.

---

## 6. Access

Notion permissions are Full access / Can edit / Can comment / Can view. Live segregation of duties stays in Odoo (`sales.exec` cannot confirm unapproved-supplier POs or edit price lists; PO creator is not sole payment approver). Notion only mirrors view vs edit.

| Role | Notion grant (after teamspace exists) | Must not |
| --- | --- | --- |
| Owner (Ninad) | Teamspace owner; Full access on KB | RED files in Notion |
| Compliance editor | Can edit Compliance/SOP; Can view rest | Confirm POs; sole payment approve; vault PDFs |
| Sales viewer | Can view KB; no edit on Compliance or Finance | Edit SOPs; live price lists; RED; investor-only numbers |
| Investor viewer | Can view GREEN/PUBLIC + selected summary subtree only | KB root (AMBER leakage); LifeOS; RED; compliance evidence |
| Agent / MCP | Connection scoped to teamspace/KB | LifeOS; RED; Secret Manager; Slack-paste AMBER |
| Default | Not invited | Everything |

**Reject as the access model:** workspace-wide members on `Ninad’s Notion`; guests on AMBER/RED; public / anyone-with-the-link / Notion Sites; sharing LifeOS to reach the KB.

**Manual UI steps (Ninad):** Settings → Teamspaces → Trash → restore **Sattva Brokers**, or New teamspace closed/invite-only named **Trilok Ventures**. If closed teamspaces are greyed out, upgrade to Business (`query_meeting_notes` already returns `upgrade_required`). Default Can view. Move the **Trilok Ventures** tree in. Scope Notion MCP and openclawbot off LifeOS. Do not invite humans until that move is done.

---

## 7. Classification in this plane

| Class | Notion | Nextcloud |
| --- | --- | --- |
| RED | Forbidden | Required home. No public share links. |
| AMBER | Process wiki and partner names as encyclopedia only, and only after teamspace RBAC. No live CRM. | Contracts and working copies. |
| GREEN | SOPs, decisions, hashed COA refs, pass/fail tables, Tavily briefs after review | Not SoR (Odoo holds GREEN fields too). |
| PUBLIC | Draft brand copy destined for Vercel | No |
| Secrets | Forbidden | Not Secret Manager |

Hugging Face, Vertex, Tavily, and any future HubSpot overlay receive GREEN only. 2025 “AI-Agent Training” pages that RAG COAs are superseded.

---

## 8. Agents

Read: `agent_ok` = true **and** classification GREEN or PUBLIC **and** catalog status Published.

Write: GREEN Content **inbox** only. A human promotes to Library.

Never: persist RED; dump HubSpot CRM into Notion; paste AMBER/RED to Slack; treat LifeOS as OpCo corpus.

---

## 9. Ninety-day minimum set

Keep in the KB (and promote to Catalog when stable): quote-to-cash SOP, supplier qualification SOP, CFIA document-request runbook, lot/COA verification SOP, this access policy, agent instructions, investor one-pager, fabric spec pointer.

Keep in Odoo: live pipeline, PCP status, lots, invoices.

Keep in Nextcloud: `/PCP/…`, `/Suppliers/{name}/Certificates/`, `/Clients/{name}/Orders/{order}/`.

Keep in LifeOS: personal cadence and scratch notes. OpCo department pages now live under Trilok Ventures → Sattva Brokers.

---

## 10. Scope

**In scope:** this architecture, the Trilok Ventures HoldCo home, Sattva Brokers as OpCo, the versioned KB under that OpCo, catalog/SOP/decision/GREEN databases, access and agent pages.

**Out of scope until a later approved plan:** Compose expansion, GCP, HubSpot, restoring the teamspace via API, rewriting department databases, creating empty OpCo shells for TenderCo / TES / Metal / Flyer.

---

## 11. Published copies

Canonical git copy: this file.

Notion hub and children are listed in §4. Fabric spec published twins remain in §13 of the companion spec until they are moved into the teamspace.
