#!/bin/bash
set -euo pipefail
python3 - <<'PY'
import os
tpl = open("/etc/odoo/odoo.conf.template").read()
for key in ("POSTGRES_PASSWORD", "ODOO_ADMIN_PASSWD"):
    value = os.environ.get(key)
    if not value:
        raise SystemExit(f"missing required env {key}")
    tpl = tpl.replace("${%s}" % key, value)
with open("/tmp/odoo.conf", "w") as fh:
    fh.write(tpl)
PY
exec odoo -c /tmp/odoo.conf "$@"
