#!/usr/bin/env python3
"""Validate a Dual-plane Path C spawn brief. Stdlib only."""
from __future__ import annotations

import json
import re
import sys
from typing import Any

REQUIRED = ("goal", "stop_list", "paths", "inputs", "done", "forbidden")
STOP_LIST = frozenset({"deal", "compliance", "cash-cycle"})
SCANNED = ("goal",)
DENIED = re.compile(
    r"odoo|nextcloud|supplier_pcp_status|button_confirm|coa\.pdf|password|secret manager"
    r"|purchase_order|purchase\.order|sattva_compliance",
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
    inputs = data["inputs"]
    if not isinstance(inputs, list) or not inputs or not all(isinstance(i, str) and i.strip() for i in inputs):
        raise ValueError("inputs must be a non-empty list of strings")
    for key in SCANNED:
        value = data[key]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{key} must be a non-empty string")
        if DENIED.search(value):
            raise ValueError(f"{key} contains denied token: odoo/nextcloud/secrets")
    for item in inputs:
        if DENIED.search(item):
            raise ValueError("inputs contains denied token: odoo/nextcloud/secrets")
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
