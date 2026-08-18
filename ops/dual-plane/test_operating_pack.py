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
