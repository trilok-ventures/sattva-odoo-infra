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


if __name__ == "__main__":
    unittest.main()
