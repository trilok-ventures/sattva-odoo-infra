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
