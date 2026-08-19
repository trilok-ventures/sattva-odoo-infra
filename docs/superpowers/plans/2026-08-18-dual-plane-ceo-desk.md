# Dual-Plane CEO Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Dual-plane CEO desk real: git-canonical standing rules and spawn-brief gate, Cursor automations that comment on the triggering PR, two Grok Bots configured from those files, and recorded proofs for the three allowed paths.

**Architecture:** Grok Bot (Chief of Staff + PA on one shared user VM) handles always-on GREEN ops. CoS spawns a Cursor Cloud Agent for code. GitHub PR is the IPCo/agent-eval bus. Notion GREEN Content inbox is the only agent prose write. n8n stays the operational integration bus. No new SoR.

**Tech Stack:** Python 3 stdlib (`unittest` only); git files under `ops/dual-plane/` and `plugins/sattva-fabric-bind/`; Cursor Automations UI; Grok Bot app; Notion MCP (GREEN Content + Decisions log); GitHub PRs on `trilok-ventures/sattva-odoo-infra`.

## Global Constraints

- Dual-plane: Grok Bot (CoS + PA, one shared VM) = always-on **GREEN** ops; Cursor Cloud Agents = code via **official Grok spawn**; GitHub PR = IPCo/agent-eval bus; Notion GREEN Content inbox = **only** agent prose write; human promotes / merges / sends.
- No Odoo/Nextcloud Grok logins.
- No agent PO confirm.
- No RAG on COAs.
- No Notion CRM.
- n8n stays pass-through.
- Automations comment on the triggering PR, not orphan branches.
- Specialist Bots are not a security boundary.
- Bot-action audit unreleased, so eval = PR + inbox + approval cards.
- Not a new SoR.
- Spec: `docs/superpowers/specs/2026-08-18-dual-plane-ceo-desk-design.md`. Locked fabric wins conflicts.
- Grok/xAI is a GREEN-only destination. AMBER (partner names, prices, Odoo URLs) must not enter Grok or Cloud Agent context.
- Agents must not set `supplier_pcp_status`, confirm `purchase.order`, release lots, post invoices, approve payment, or edit price lists.
- Do not colocate the Grok Bot VM with Compose/Odoo/Nextcloud/n8n.
- Do not add Deal Brief, Compliance Brief, investor-analyst, or extra always-on Bots in this plan.
- Do not weaken `purchase.order.button_confirm`. Do not edit `config/odoo.conf`. Do not retarget root `vercel.json`.
- Spawn brief `stop_list` is exactly one of: `deal`, `compliance`, `cash-cycle`.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `ops/dual-plane/validate_spawn_brief.py` | Stdlib validator for Path C spawn briefs |
| `ops/dual-plane/test_operating_pack.py` | Unit tests for validator + deny-phrase pack |
| `ops/dual-plane/fixtures/valid.json` | Fixture that must pass |
| `ops/dual-plane/fixtures/missing-stop-list.json` | Fixture that must fail |
| `ops/dual-plane/fixtures/login-odoo.json` | Fixture that must fail (goal mentions Odoo login) |
| `ops/dual-plane/deny-phrases.txt` | Phrases every Bot description must contain |
| `ops/dual-plane/bots/chief-of-staff.md` | Paste-ready CoS description |
| `ops/dual-plane/bots/pa.md` | Paste-ready PA description |
| `ops/dual-plane/automation-landing.md` | Paste-ready Cursor Automation prompts |
| `ops/dual-plane/configure-grok-bots.md` | Human steps to create the two Bots from git |
| `ops/dual-plane/dry-run-log.md` | Evidence template; filled during Task 8 |
| `.github/pull_request_template.md` | Five-check eval rubric on every PR |
| `.github/workflows/dual-plane-pack.yml` | CI for the operating pack + plugin layout |
| `plugins/sattva-fabric-bind/` | Thin Cursor binder (rule + skill + command). Git is SoT |
| `AGENTS.md` | Pointer to dual-plane spec and `ops/dual-plane/` |

No Odoo/n8n/middleware/runtime files. No `mcpServers` in the plugin. No `agents/` or `hooks/` in the plugin.

## Phase split

| Tasks | Where they run | Start when |
| --- | --- | --- |
| 1–6 | Git in this repo | Immediately |
| 7 | Notion + Grok Bot + Cursor Automations UI | After Task 4 files exist (Task 2 for Bot paste) |
| 8 | Live proofs | After Tasks 1–7 |

---

### Task 1: Spawn brief validator

**Files:**
- Create: `ops/dual-plane/validate_spawn_brief.py`
- Create: `ops/dual-plane/fixtures/valid.json`
- Create: `ops/dual-plane/fixtures/missing-stop-list.json`
- Create: `ops/dual-plane/fixtures/login-odoo.json`
- Create: `ops/dual-plane/test_operating_pack.py`
- Create: `.github/workflows/dual-plane-pack.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: `validate_spawn_brief.validate(data: dict) -> None` raises `ValueError` on failure. CLI: `python3 ops/dual-plane/validate_spawn_brief.py <json-path>` exits `0` on pass, `1` on fail. Required JSON keys (lowercase, exact): `goal`, `stop_list`, `paths`, `inputs`, `done`, `forbidden`. `stop_list` ∈ `{deal, compliance, cash-cycle}`. `paths` is a non-empty list of strings. `goal`, `inputs`, and each `paths` item must not match the case-insensitive regex `odoo|nextcloud|supplier_pcp_status|button_confirm|coa\.pdf|password|secret manager`. The `forbidden` and `done` fields are not scanned for those tokens (they name the denylist).

- [ ] **Step 1: Write the failing tests**

Create `ops/dual-plane/test_operating_pack.py`:

```python
#!/usr/bin/env python3
"""Tests for the dual-plane operating pack (spawn brief + deny phrases)."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
import sys

sys.path.insert(0, str(ROOT))
from validate_spawn_brief import validate  # noqa: E402

FIXTURES = ROOT / "fixtures"


class SpawnBriefTests(unittest.TestCase):
    def test_valid_fixture_passes(self):
        data = json.loads((FIXTURES / "valid.json").read_text())
        validate(data)

    def test_missing_stop_list_fails(self):
        data = json.loads((FIXTURES / "missing-stop-list.json").read_text())
        with self.assertRaises(ValueError) as ctx:
            validate(data)
        self.assertIn("stop_list", str(ctx.exception))

    def test_login_odoo_in_goal_fails(self):
        data = json.loads((FIXTURES / "login-odoo.json").read_text())
        with self.assertRaises(ValueError) as ctx:
            validate(data)
        self.assertIn("odoo", str(ctx.exception).lower())

    def test_forbidden_field_may_name_odoo(self):
        data = json.loads((FIXTURES / "valid.json").read_text())
        self.assertIn("Odoo", data["forbidden"])
        validate(data)


if __name__ == "__main__":
    unittest.main()
```

Create `ops/dual-plane/fixtures/valid.json`:

```json
{
  "goal": "Add a dry-run evidence heading to ops/dual-plane/dry-run-log.md",
  "stop_list": "compliance",
  "paths": ["ops/dual-plane/dry-run-log.md"],
  "inputs": ["Published GREEN dual-plane spec only"],
  "done": "Draft PR that only edits the dry-run log",
  "forbidden": "Odoo write, Nextcloud, secrets, merge main"
}
```

Create `ops/dual-plane/fixtures/missing-stop-list.json`:

```json
{
  "goal": "Touch a docs file",
  "paths": ["docs/superpowers/specs/2026-08-18-dual-plane-ceo-desk-design.md"],
  "inputs": ["Published GREEN spec only"],
  "done": "Draft PR",
  "forbidden": "Odoo write, Nextcloud, secrets, merge main"
}
```

Create `ops/dual-plane/fixtures/login-odoo.json`:

```json
{
  "goal": "Log into Odoo and approve the supplier",
  "stop_list": "deal",
  "paths": ["addons/sattva_compliance/models/purchase_order.py"],
  "inputs": ["Published GREEN spec only"],
  "done": "Draft PR",
  "forbidden": "Odoo write, Nextcloud, secrets, merge main"
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 ops/dual-plane/test_operating_pack.py -v`

Expected: `ModuleNotFoundError` or `ImportError` for `validate_spawn_brief` (file does not exist yet). Do not create the module before this step.

- [ ] **Step 3: Write the validator**

Create `ops/dual-plane/validate_spawn_brief.py`:

```python
#!/usr/bin/env python3
"""Validate a Dual-plane Path C spawn brief. Stdlib only."""
from __future__ import annotations

import json
import re
import sys
from typing import Any

REQUIRED = ("goal", "stop_list", "paths", "inputs", "done", "forbidden")
STOP_LIST = frozenset({"deal", "compliance", "cash-cycle"})
SCANNED = ("goal", "inputs")
DENIED = re.compile(
    r"odoo|nextcloud|supplier_pcp_status|button_confirm|coa\.pdf|password|secret manager",
    re.I,
)


def validate(data: dict[str, Any]) -> None:
    if not isinstance(data, dict):
        raise ValueError("brief must be a JSON object")
    missing = [k for k in REQUIRED if k not in data]
    if missing:
        raise ValueError(f"missing {missing[0]}")
    stop = data["stop_list"]
    if stop not in STOP_LIST:
        raise ValueError("stop_list must be deal, compliance, or cash-cycle")
    paths = data["paths"]
    if not isinstance(paths, list) or not paths or not all(isinstance(p, str) and p.strip() for p in paths):
        raise ValueError("paths must be a non-empty list of strings")
    for key in SCANNED:
        value = data[key]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{key} must be a non-empty string")
        if DENIED.search(value):
            raise ValueError(f"{key} contains denied token: odoo/nextcloud/secrets")
    for item in paths:
        if DENIED.search(item):
            raise ValueError("paths contains denied token: odoo/nextcloud/secrets")
    for key in ("done", "forbidden"):
        if not isinstance(data[key], str) or not data[key].strip():
            raise ValueError(f"{key} must be a non-empty string")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: validate_spawn_brief.py <brief.json>", file=sys.stderr)
        return 2
    path = argv[1]
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    try:
        validate(data)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 1
    print("OK", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 ops/dual-plane/test_operating_pack.py -v`

Expected: `OK` and `Ran 4 tests`.

Run: `python3 ops/dual-plane/validate_spawn_brief.py ops/dual-plane/fixtures/valid.json`

Expected: `OK ops/dual-plane/fixtures/valid.json`

Run: `python3 ops/dual-plane/validate_spawn_brief.py ops/dual-plane/fixtures/login-odoo.json ; echo exit:$?`

Expected: stderr contains `odoo`, `exit:1`.

- [ ] **Step 5: Add CI**

Create `.github/workflows/dual-plane-pack.yml`:

```yaml
name: dual-plane-pack

on:
  pull_request:
    paths:
      - ops/dual-plane/**
      - plugins/sattva-fabric-bind/**
      - .github/workflows/dual-plane-pack.yml
      - .github/pull_request_template.md

jobs:
  pack:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Operating pack tests
        run: python3 ops/dual-plane/test_operating_pack.py -v
      - name: Plugin layout tests
        run: python3 plugins/sattva-fabric-bind/tests/test_plugin_layout.py -v
        if: hashFiles('plugins/sattva-fabric-bind/tests/test_plugin_layout.py') != ''
```

Until Task 5 lands the plugin test file, the `hashFiles` guard skips it. After Task 5, the same workflow runs both.

- [ ] **Step 6: Commit**

```bash
git add ops/dual-plane/validate_spawn_brief.py \
  ops/dual-plane/test_operating_pack.py \
  ops/dual-plane/fixtures/valid.json \
  ops/dual-plane/fixtures/missing-stop-list.json \
  ops/dual-plane/fixtures/login-odoo.json \
  .github/workflows/dual-plane-pack.yml
git commit -m "feat: add dual-plane spawn-brief validator"
```

---

### Task 2: Bot standing-rule files

**Files:**
- Create: `ops/dual-plane/deny-phrases.txt`
- Create: `ops/dual-plane/bots/chief-of-staff.md`
- Create: `ops/dual-plane/bots/pa.md`
- Modify: `ops/dual-plane/test_operating_pack.py` (add `DenyPhraseTests`)

**Interfaces:**
- Consumes: nothing.
- Produces: `DENY_PHRASES` as newline-separated exact strings in `ops/dual-plane/deny-phrases.txt`. Both bot files must contain every phrase. Task 7 pastes these files into Grok Bot descriptions verbatim.

- [ ] **Step 1: Write the failing deny-phrase tests**

Append to `ops/dual-plane/test_operating_pack.py` (keep existing imports and `SpawnBriefTests`):

```python
class DenyPhraseTests(unittest.TestCase):
    def test_each_bot_file_contains_every_deny_phrase(self):
        phrases = [
            line.strip()
            for line in (ROOT / "deny-phrases.txt").read_text().splitlines()
            if line.strip() and not line.startswith("#")
        ]
        self.assertGreaterEqual(len(phrases), 8)
        for name in ("chief-of-staff.md", "pa.md"):
            text = (ROOT / "bots" / name).read_text()
            for phrase in phrases:
                self.assertIn(phrase, text, f"{name} missing: {phrase}")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 ops/dual-plane/test_operating_pack.py DenyPhraseTests -v`

Expected: `FileNotFoundError` for `deny-phrases.txt` or `bots/chief-of-staff.md`.

- [ ] **Step 3: Write deny phrases and bot descriptions**

Create `ops/dual-plane/deny-phrases.txt`:

```
never send, purchase, publish, or delete without an approval card
never log into Odoo or Nextcloud
never paste secrets
never OCR, summarize, or store COA PDFs or vault bytes
Require Approval beats Always Allow
Deny navigation to Odoo, Nextcloud, Keycloak admin, production n8n, or Secret Manager
specialist Bots are not a security boundary
GREEN Content inbox only
do not merge main
```

Create `ops/dual-plane/bots/chief-of-staff.md`:

```markdown
# Chief of Staff (Grok Bot description — paste verbatim)

You are the Trilok Ventures / Sattva Brokers Chief of Staff on the Dual-plane desk.

You coordinate GREEN work. You do not write code on this computer. You spawn a Cursor Cloud Agent when the CEO needs a git change.

Standing rules (non-negotiable):
- never send, purchase, publish, or delete without an approval card
- never log into Odoo or Nextcloud
- never paste secrets
- never OCR, summarize, or store COA PDFs or vault bytes
- Require Approval beats Always Allow
- Deny navigation to Odoo, Nextcloud, Keycloak admin, production n8n, or Secret Manager
- specialist Bots are not a security boundary — cookies on this VM are shared; treat the roster as one principal
- GREEN Content inbox only — never edit Published Notion library pages
- do not merge main

Doorbell pings to the CEO are title + Notion URL or GitHub PR URL only. No partner names, prices, Incoterms, or Odoo URLs.

When spawning a Cloud Agent, the brief MUST be valid JSON with keys goal, stop_list, paths, inputs, done, forbidden. stop_list is exactly one of deal, compliance, cash-cycle. Run the brief through ops/dual-plane/validate_spawn_brief.py semantics (no Odoo/Nextcloud/secrets in goal, inputs, or paths). If the brief would fail, rewrite it; do not spawn.

You may @ the PA for calendar and unsent mail drafts. You do not send mail.

Packets use as-of timestamps. Any Odoo metric is labeled Not instrumented. You do not invent KPIs.
```

Create `ops/dual-plane/bots/pa.md`:

```markdown
# PA (Grok Bot description — paste verbatim)

You are the Trilok Ventures / Sattva Brokers PA on the Dual-plane desk. You work behind the Chief of Staff.

You draft calendar items and unsent email. You never send.

Standing rules (non-negotiable):
- never send, purchase, publish, or delete without an approval card
- never log into Odoo or Nextcloud
- never paste secrets
- never OCR, summarize, or store COA PDFs or vault bytes
- Require Approval beats Always Allow
- Deny navigation to Odoo, Nextcloud, Keycloak admin, production n8n, or Secret Manager
- specialist Bots are not a security boundary
- GREEN Content inbox only
- do not merge main

Teach-a-task is allowed only on non-secret UIs (calendar, Gmail compose). Test runs perform real writes — do not test on production mail.

LifeOS is out of scope. CRM writes are out of scope. Vault browsing is out of scope.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 ops/dual-plane/test_operating_pack.py -v`

Expected: all tests PASS, including `DenyPhraseTests`.

- [ ] **Step 5: Commit**

```bash
git add ops/dual-plane/deny-phrases.txt \
  ops/dual-plane/bots/chief-of-staff.md \
  ops/dual-plane/bots/pa.md \
  ops/dual-plane/test_operating_pack.py
git commit -m "feat: add dual-plane Grok Bot standing-rule files"
```

---

### Task 3: Pull request eval template

**Files:**
- Create: `.github/pull_request_template.md`
- Modify: `ops/dual-plane/test_operating_pack.py` (add `PrTemplateTests`)

**Interfaces:**
- Consumes: spec §7 five checks (exact wording below).
- Produces: GitHub PR body checklist. Every later dual-plane PR (including Task 8 dry-run) uses this template.

- [ ] **Step 1: Write the failing template test**

Append:

```python
class PrTemplateTests(unittest.TestCase):
    def test_template_contains_five_checks(self):
        text = (ROOT.parents[1] / ".github" / "pull_request_template.md").read_text()
        for needle in (
            "Stop-list",
            "Classification",
            "One SoR",
            "Human gate",
            "Span",
        ):
            self.assertIn(needle, text)
        self.assertIn("do not merge main", text.lower())
```

`ROOT` is `ops/dual-plane`, so `ROOT.parents[1]` is the repo root.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 ops/dual-plane/test_operating_pack.py PrTemplateTests -v`

Expected: `FileNotFoundError` for `.github/pull_request_template.md`.

- [ ] **Step 3: Write the template**

Create `.github/pull_request_template.md`:

```markdown
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 ops/dual-plane/test_operating_pack.py -v`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/pull_request_template.md ops/dual-plane/test_operating_pack.py
git commit -m "feat: add dual-plane PR eval checklist"
```

---

### Task 4: Automation landing prompts

**Files:**
- Create: `ops/dual-plane/automation-landing.md`

**Interfaces:**
- Consumes: Cursor Automation IDs `c8a92dde-9421-11f1-ba66-0e7d0216e441` (Pull Request Router) and `c88e8a91-9421-11f1-ba66-0e7d0216e441` (Security Reviewer).
- Produces: exact prompt text Task 7 pastes into the Automations UI. Required comment markers (exact strings the dry-run must find on the triggering PR): `dual-plane-router` and `dual-plane-security`.

There is no unit test for the Cursor UI. The contract is the markers. Task 8 fails if a new `cursor/pr-approval-agent-logic-*` or `cursor/security-review-orchestrator-*` branch is created with an empty diff. When pasting into the Automations UI, strip the four-space indent from the prompt blocks.

- [ ] **Step 1: Write the landing file**

Create `ops/dual-plane/automation-landing.md` with this exact body (inner prompt blocks use four-space indent, not fences):

~~~~
# Cursor Automation landing (paste into dashboard)

Do not create new automations. Edit the two existing ones.

## Pull Request Router

- Dashboard: https://cursor.com/automations/c8a92dde-9421-11f1-ba66-0e7d0216e441
- Required behavior: comment on the **GitHub PR that triggered this run**. Do not `git checkout -b`. Do not open a new PR. Do not merge.

Prompt to paste:

    You are the Pull Request Router for trilok-ventures/sattva-odoo-infra.

    Find the GitHub pull request that triggered this automation. Post one comment on THAT pull request. Do not create a branch. Do not create a new PR. Do not push. Do not merge.

    Comment body must include these lines verbatim:

    dual-plane-router
    Eval: routing note only. Human merges. Agents do not merge main.

    Then one short paragraph: whether this PR looks like Path C (code) of the Dual-plane desk, and whether .github/pull_request_template.md checklist is present.

    If you cannot find the triggering PR, comment on the most recently opened open PR by a cursor/* branch and say you could not bind githubIssueId. Still do not create a branch.

## Security Reviewer

- Dashboard: https://cursor.com/automations/c88e8a91-9421-11f1-ba66-0e7d0216e441
- Required behavior: comment on the **same triggering PR**. Do not open orphan `cursor/security-review-orchestrator-*` branches.

Prompt to paste:

    You are the Security Reviewer for trilok-ventures/sattva-odoo-infra Dual-plane desk.

    Find the GitHub pull request that triggered this automation. Post one review comment or PR comment on THAT pull request. Do not create a branch. Do not create a new PR. Do not merge.

    Comment body must include these lines verbatim:

    dual-plane-security
    Fail closed: no Odoo/Nextcloud credentials, no RED files, no agent PO confirm.

    Check the diff for: secrets, Nextcloud paths, COA PDFs, supplier_pcp_status writes, button_confirm calls, RED payloads toward Vercel/HF/Tavily. If none, say "no RED/SoR violations in diff."

    If the diff touches Odoo, n8n, Nextcloud, Keycloak, GCP, Cloudflare, or Vercel, remind the author to invoke .cursor/agents/fabric-architect.md.

## Verify after save

1. Open a docs-only PR (Task 8).
2. Confirm both comments appear on that PR.
3. Confirm no new empty `cursor/pr-approval-agent-logic-*` or `cursor/security-review-orchestrator-*` branches were created for that event.
~~~~

- [ ] **Step 2: Confirm the file contains both markers**

Run:

```bash
python3 -c "
from pathlib import Path
t = Path('ops/dual-plane/automation-landing.md').read_text()
assert 'dual-plane-router' in t
assert 'dual-plane-security' in t
assert 'c8a92dde-9421-11f1-ba66-0e7d0216e441' in t
assert 'c88e8a91-9421-11f1-ba66-0e7d0216e441' in t
assert 'Do not create a branch' in t
print('OK landing markers')
"
```

Expected: `OK landing markers`

- [ ] **Step 3: Commit**

```bash
git add ops/dual-plane/automation-landing.md
git commit -m "docs: add dual-plane Cursor automation landing prompts"
```

---

### Task 5: `sattva-fabric-bind` plugin

**Files:**
- Create: `plugins/sattva-fabric-bind/.cursor-plugin/plugin.json`
- Create: `plugins/sattva-fabric-bind/README.md`
- Create: `plugins/sattva-fabric-bind/rules/fabric-bind.mdc`
- Create: `plugins/sattva-fabric-bind/skills/route-ceo-ask/SKILL.md`
- Create: `plugins/sattva-fabric-bind/commands/sattva-route.md`
- Create: `plugins/sattva-fabric-bind/tests/test_plugin_layout.py`

**Interfaces:**
- Consumes: spec §12 invariants (verbatim in the rule).
- Produces: git-canonical plugin. Derived install path is `~/.cursor/plugins/local/sattva-fabric-bind/` (copy, not SoT). No `agents/`, `hooks/`, or `mcpServers`.

- [ ] **Step 1: Write the failing layout test**

Create `plugins/sattva-fabric-bind/tests/test_plugin_layout.py`:

```python
#!/usr/bin/env python3
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVARIANTS = [
    "No Odoo/Nextcloud Grok logins.",
    "No agent PO confirm.",
    "No RAG on COAs.",
    "No Notion CRM.",
    "n8n stays pass-through.",
    "Automations comment on the triggering PR, not orphan branches.",
    "Specialist Bots are not a security boundary.",
    "Not a new SoR.",
]


class PluginLayoutTests(unittest.TestCase):
    def test_manifest(self):
        data = json.loads((ROOT / ".cursor-plugin" / "plugin.json").read_text())
        self.assertEqual(data["name"], "sattva-fabric-bind")
        self.assertEqual(data["license"], "UNLICENSED")
        for key in ("rules", "skills", "commands"):
            path = data[key]
            self.assertFalse(path.startswith("/"))
            self.assertNotIn("..", path)
            self.assertTrue((ROOT / path.lstrip("./")).exists(), path)

    def test_rule_contains_invariants(self):
        text = (ROOT / "rules" / "fabric-bind.mdc").read_text()
        for line in INVARIANTS:
            self.assertIn(line, text)

    def test_no_forbidden_components(self):
        self.assertFalse((ROOT / "agents").exists())
        self.assertFalse((ROOT / "hooks").exists())
        self.assertFalse((ROOT / "mcp.json").exists())
        self.assertFalse((ROOT / "mcpServers").exists())

    def test_skill_and_command_exist(self):
        self.assertTrue((ROOT / "skills" / "route-ceo-ask" / "SKILL.md").is_file())
        self.assertTrue((ROOT / "commands" / "sattva-route.md").is_file())


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 plugins/sattva-fabric-bind/tests/test_plugin_layout.py -v`

Expected: `FileNotFoundError` for `plugin.json`.

- [ ] **Step 3: Write plugin files**

Create `plugins/sattva-fabric-bind/.cursor-plugin/plugin.json`:

```json
{
  "name": "sattva-fabric-bind",
  "displayName": "Sattva Fabric Bind",
  "version": "0.1.0",
  "description": "Bind Cursor sessions to the locked Sattva fabric: one SoR per domain, GREEN/agent_ok reads, GREEN inbox writes, route CEO asks to Grok Bot / Cloud Agents / Notion. Not an agent runtime.",
  "author": { "name": "Trilok Ventures IPCo" },
  "license": "UNLICENSED",
  "keywords": ["sattva", "fabric-bind", "internal"],
  "rules": "./rules/",
  "skills": "./skills/",
  "commands": "./commands/"
}
```

Create `plugins/sattva-fabric-bind/rules/fabric-bind.mdc`:

```markdown
---
description: Bind Cursor sessions to the Dual-plane CEO desk and locked Sattva fabric.
alwaysApply: true
---

You are in an IPCo Cursor session for trilok-ventures/sattva-odoo-infra.

Canonical specs (git wins): `docs/superpowers/specs/2026-08-13-sattva-brokers-system-fabric-design.md`, `docs/superpowers/specs/2026-08-13-sattva-versioned-kb.md` §8, `docs/superpowers/specs/2026-08-18-dual-plane-ceo-desk-design.md`. Notion Agent Instructions twin KB §8.

Invariants (verbatim):
- Dual-plane: Grok Bot (CoS + PA, one shared VM) = always-on **GREEN** ops; Cursor Cloud Agents = code via **official Grok spawn**; GitHub PR = IPCo/agent-eval bus; Notion GREEN Content inbox = **only** agent prose write; human promotes / merges / sends.
- No Odoo/Nextcloud Grok logins.
- No agent PO confirm.
- No RAG on COAs.
- No Notion CRM.
- n8n stays pass-through.
- Automations comment on the triggering PR, not orphan branches.
- Specialist Bots are not a security boundary.
- Bot-action audit unreleased, so eval = PR + inbox + approval cards.
- Not a new SoR.

Read: `agent_ok` + GREEN/PUBLIC + Published only. Write prose to GREEN Content inbox only. Code changes are draft PRs. Never merge main. Never set supplier_pcp_status, confirm purchase.order, release lots, post invoices, approve payment, or edit price lists.

If the user asks for a CEO workflow, follow `skills/route-ceo-ask/SKILL.md`.
```

Create `plugins/sattva-fabric-bind/skills/route-ceo-ask/SKILL.md`:

```markdown
---
name: route-ceo-ask
description: Route a CEO ask to Grok Bot, Cursor Cloud, Notion inbox, or a human in Odoo/Nextcloud.
---

Decide exactly one destination:

1. Grok Bot Chief of Staff / PA — calendar, unsent mail, GREEN cadence, doorbell pings.
2. Cursor Cloud Agent — git/code/locked spec. Require a spawn brief that passes `ops/dual-plane/validate_spawn_brief.py`.
3. Notion GREEN Content inbox — prose/SOP/packet drafts. Status inbox, kb_layer inbox, red_scan unscanned, agent_ok false.
4. Human in Odoo or Nextcloud — money, partners, PCP, POs, lots, vault files.

Refuse: RED files, PCP approve, PO confirm, lot release, payment approve, price-list edit, LifeOS, HubSpot-as-CRM, RAG on COAs, logging Grok into Odoo/Nextcloud.
```

Create `plugins/sattva-fabric-bind/commands/sattva-route.md`:

```markdown
---
name: sattva-route
description: Force the Dual-plane CEO routing tree.
---

Apply `skills/route-ceo-ask/SKILL.md` to the user's latest ask. Reply with the chosen destination (1–4) and one sentence why. Do not start Odoo or Nextcloud work.
```

Create `plugins/sattva-fabric-bind/README.md`:

```markdown
# sattva-fabric-bind

Git is the source of truth. Copy this directory to `~/.cursor/plugins/local/sattva-fabric-bind/` on IPCo machines only. Do not install on personal/LifeOS Cursor profiles. Do not publish to the marketplace.

Not an agent runtime. Grok Bot owns chat/approvals. Cursor Cloud owns code. Notion owns policy. Odoo/Nextcloud stay human or n8n.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 plugins/sattva-fabric-bind/tests/test_plugin_layout.py -v`

Expected: `OK` and 4 tests.

Run: `python3 ops/dual-plane/test_operating_pack.py -v`

Expected: still PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/sattva-fabric-bind
git commit -m "feat: add sattva-fabric-bind Cursor plugin"
```

---

### Task 6: `AGENTS.md` pointer

**Files:**
- Modify: `AGENTS.md` (append one section after the Canonical specs list; do not rewrite Cloud gotchas)

**Interfaces:**
- Consumes: spec path and `ops/dual-plane/` paths from Tasks 1–5.
- Produces: Cloud Agents on this repo see the Dual-plane pointer.

- [ ] **Step 1: Append the section**

After the Canonical specs bullet list in `AGENTS.md`, add:

```markdown
- `docs/superpowers/specs/2026-08-18-dual-plane-ceo-desk-design.md` — Dual-plane CEO desk
  (Grok Bot GREEN ops + Cursor Cloud spawn). Operating pack: `ops/dual-plane/`.
  Binder plugin: `plugins/sattva-fabric-bind/`. Spawn briefs must pass
  `python3 ops/dual-plane/validate_spawn_brief.py <brief.json>`.
```

Do not change Docker, `odoo.conf`, or Vercel gotchas.

- [ ] **Step 2: Confirm the pointer exists**

Run:

```bash
python3 -c "
from pathlib import Path
t = Path('AGENTS.md').read_text()
assert '2026-08-18-dual-plane-ceo-desk-design.md' in t
assert 'ops/dual-plane/' in t
assert 'validate_spawn_brief.py' in t
print('OK AGENTS pointer')
"
```

Expected: `OK AGENTS pointer`

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: point AGENTS.md at the dual-plane operating pack"
```

---

### Task 7: Decision log + configure Grok Bots and automations

**Files:**
- Create: `ops/dual-plane/configure-grok-bots.md`
- Notion: Decisions log row (not a git file)

**Interfaces:**
- Consumes: `ops/dual-plane/bots/*.md`, `ops/dual-plane/automation-landing.md`.
- Produces: one Decisions log page; two Grok Bots whose descriptions match git; two automations whose prompts match git.

- [ ] **Step 1: Write the configure runbook**

Create `ops/dual-plane/configure-grok-bots.md`:

```markdown
# Configure Grok Bots from git

Eligibility: Cursor Ultra, Cursor Teams Premium, or SuperGrok Heavy. App: https://cursor.com/bot/onboarding

1. Create Bot named `Chief of Staff`. Paste `ops/dual-plane/bots/chief-of-staff.md` into the description (body after the heading).
2. Create Bot named `PA`. Paste `ops/dual-plane/bots/pa.md` the same way.
3. Settings → Auto-review: Require Approval for send, publish, purchase, delete. Deny for URLs matching odoo, nextcloud, keycloak, n8n, secretmanager.
4. Team / dashboard Grok Bot: keep Cloud Agents launch enabled. Do not sign either Bot into Odoo or Nextcloud. Do not store those passwords in the VM.
5. Do not create a third Bot in this plan.
6. Edit Pull Request Router and Security Reviewer using `ops/dual-plane/automation-landing.md`.
```

- [ ] **Step 2: Create the Decisions log row**

Use Notion MCP `notion-create-pages` with parent `data_source_id` `b54a9939-d615-4187-8b16-75e084b9dd50` and properties:

- `Title`: `Dual-plane CEO desk`
- `Choice`: `Grok Bot CoS+PA for GREEN ops; official spawn to Cursor Cloud; GitHub PR is IPCo eval bus; GREEN inbox only`
- `Classification`: `GREEN`
- `Status`: `Proposed`
- `Spec section`: `docs/superpowers/specs/2026-08-18-dual-plane-ceo-desk-design.md`
- `Rationale`: `Reduces compliance risk via classification and human gates; shortens cash cycle when a spawn unblocks a ticket. Not a new SoR. n8n remains the operational bus. Grok is GREEN-only. Specialist Bots are not a security boundary.`
- `Rejected`: `Grok Bot codes on /workspace as SoR; CEO as copy-paste bus; 10-bot org; Odoo/Nextcloud Grok logins`
- `agent_ok`: `__NO__`
- `date:Effective date:start`: `2026-08-18`
- `date:Effective date:is_datetime`: `0`

Page content: pointer to the git spec, `ops/dual-plane/`, and this plan. Human later sets Status `Locked`.

- [ ] **Step 3: Execute the runbook (human / this agent with Grok access)**

Follow `configure-grok-bots.md` steps 1–6. Record Bot names and automation save time in `ops/dual-plane/dry-run-log.md` (create the skeleton if missing):

```markdown
# Dual-plane dry-run log

Classification: GREEN. No partner names, prices, or Odoo URLs.

## Configuration

- CoS Bot created: (yes/no, date)
- PA Bot created: (yes/no, date)
- Auto-review Deny saved: (yes/no)
- Router prompt updated: (yes/no)
- Security prompt updated: (yes/no)
- Decisions log URL:

## Proofs

(filled in Task 8)
```

- [ ] **Step 4: Commit the runbook and log skeleton**

```bash
git add ops/dual-plane/configure-grok-bots.md ops/dual-plane/dry-run-log.md
git commit -m "docs: add dual-plane Grok Bot configure runbook"
```

---

### Task 8: Recorded proofs

**Files:**
- Modify: `ops/dual-plane/dry-run-log.md` (fill proof rows)

**Interfaces:**
- Consumes: validator CLI, Bot descriptions, automation markers `dual-plane-router` and `dual-plane-security`, GREEN Content data source `7ac3a738-aa10-4146-b3b7-d34690436961`.
- Produces: filled log. Do not merge a proof PR that fails the five-check template.

- [ ] **Step 1: Negative spawn (automated)**

Run: `python3 ops/dual-plane/validate_spawn_brief.py ops/dual-plane/fixtures/login-odoo.json ; echo exit:$?`

Expected: non-zero exit. Paste the stderr line into the dry-run log under **Negative spawn**.

- [ ] **Step 2: Knowledge path**

Create one GREEN Content inbox row (Notion `notion-create-pages`, data_source `7ac3a738-aa10-4146-b3b7-d34690436961`):

- `Title`: `Dual-plane dry-run packet`
- `Classification`: `GREEN`
- `Status`: `inbox`
- `kb_layer`: `inbox`
- `red_scan`: `unscanned`
- `agent_ok`: `__NO__`
- `source`: `human`
- `hf_eligible`: `__NO__`
- `audience`: `["human"]`
- Content must include `as of` and `Not instrumented`. Must not include partner names or Odoo URLs.

Confirm Published library row count is unchanged. Plant the string `Odoo URL https://odoo.example` in a **scratch** sentence, set `red_scan` to `flagged`, do not promote. Record the inbox URL in the log.

- [ ] **Step 3: Code path (docs-only PR)**

Validate this brief then spawn (Grok CoS or Cursor Cloud with the same JSON):

```json
{
  "goal": "Record code-path proof timestamp in ops/dual-plane/dry-run-log.md",
  "stop_list": "compliance",
  "paths": ["ops/dual-plane/dry-run-log.md"],
  "inputs": ["Published GREEN dual-plane spec only"],
  "done": "Draft PR that only edits the dry-run log",
  "forbidden": "Odoo write, Nextcloud, secrets, merge main"
}
```

Run: `python3 ops/dual-plane/validate_spawn_brief.py /tmp/code-path-brief.json` after writing that JSON to `/tmp/code-path-brief.json`.

Expected: `OK`.

Open a draft PR on `cursor/*` that only edits `ops/dual-plane/dry-run-log.md`. Wait for automations. Pass only if:

1. The PR has a comment containing `dual-plane-router`.
2. The PR has a comment containing `dual-plane-security`.
3. No new empty `cursor/pr-approval-agent-logic-*` or `cursor/security-review-orchestrator-*` branch was created for this event.

If 3 fails, stop and fix the automation prompts (Task 4/7) before claiming the desk works.

- [ ] **Step 4: PA path and negative Grok (manual)**

With the PA Bot: create an unsent draft. Trigger an approval card. Choose **Deny**. Confirm nothing sent. Record yes/no in the log.

Ask CoS to open Nextcloud. Expected: Deny / refusal. Do not complete a login takeover. If a session was created, Reset the Grok computer and log an incident in the Decisions log.

- [ ] **Step 5: Commit the filled log**

```bash
git add ops/dual-plane/dry-run-log.md
git commit -m "docs: record dual-plane desk dry-run proofs"
```

CEO merges proof PRs using the five-check template. Agents do not merge main.

---

## Spec coverage (self-review)

| Spec section | Task |
| --- | --- |
| §1 Done-when 1 (two Bots + standing rules) | 2, 7 |
| §1 Done-when 2 (spawn → draft PR) | 1, 8 |
| §1 Done-when 3 (automations comment on triggering PR) | 4, 7, 8 |
| §1 Done-when 4 (GREEN inbox) | 8 |
| §1 Done-when 5 (no Odoo/Nextcloud creds / no PO confirm) | 2, 5, 7, 8 |
| §2 Architecture / GREEN-only Grok / VM not Compose | 5, 6, 7 |
| §3 Components / non-components | 2, 5 (plugin last, no extra Bots) |
| §4 Spawn brief fields | 1 |
| §5 Monitor/modify/evaluate | 3, 4, 7 |
| §6 Error handling / denylist | 1, 2, 8 |
| §7 Eval rubric | 3 |
| §8 Testing table | 8 |
| §9 Phase 0 only | all tasks stay config + git; no fabric credentials |
| §10 Implementation notes 1–5 | 7, 2, 4, 8, 5 |
| §12 Invariants | Global Constraints + plugin rule |

No placeholder `TBD`/`TODO`/`implement later` in this plan.
