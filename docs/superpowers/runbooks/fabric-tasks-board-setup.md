# Fabric Implementation Tasks — board setup

**Status:** Done (2026-08-13)  
**Board:** https://app.notion.com/p/46215039e82947709763fe5de85533ab  
**Parent:** System Fabric (Sattva Brokers OpCo) — **not** LifeOS

## Why not LifeOS Tasks DB?

LifeOS is personal/scratch. Company fabric work must live under Trilok Ventures → Sattva Brokers so investors/hires never see personal pages.

## Schema

| Property | Values |
| --- | --- |
| Task name | title |
| Status | Not started / In progress / Done / Archived |
| Phase | 0 / 1 / 2 / 3 |
| Priority | High / Medium / Low |
| Plan Task | e.g. `Task 1` |
| Evidence Link | URL |
| Assignee / Due | optional |

Board view: **By Status**.

## Related Notion surfaces

| Surface | URL |
| --- | --- |
| Brainstorm capture | https://app.notion.com/p/3bbe8d8c60c781038394e93983d99c59 |
| Ops Dashboard blueprint | https://app.notion.com/p/3bbe8d8c60c781f49b60ffe2abf306ed |
| Fabric Ops Events DB | https://app.notion.com/p/cf8aef6567fa4993b013220a84564c17 |
| Git plan | `docs/superpowers/plans/2026-08-13-sattva-gcp-cf-notion-ops-dashboard.md` |

## Optional template

If you want a fresh duplicate of Notion’s sample board instead: https://notion.notion.site/code-with-notion-board — then move it under System Fabric and re-seed Phase 1 tasks.
