#!/usr/bin/env bash
#
# run-tunnel.sh — Run the Sattva Cloudflare Tunnel in TOKEN mode.
#
# Token mode connects this machine to a Named Tunnel that was created in the
# Cloudflare Zero Trust dashboard. All ingress/public-hostname routing
# (sattva.trilokventures.org -> http://localhost:8069) is configured in the
# dashboard, so this script only needs the tunnel token.
#
# Prerequisites:
#   1. cloudflared is installed (see README.md).
#   2. Odoo is already running and reachable on http://localhost:8069.
#   3. The environment variable CLOUDFLARE_TUNNEL_TOKEN is set to the tunnel
#      token copied from the dashboard (Zero Trust -> Networks -> Tunnels ->
#      <your tunnel> -> Install connector).
#
# Usage:
#   export CLOUDFLARE_TUNNEL_TOKEN='eyJ...'      # secret; do NOT commit
#   ./deploy/cloudflare-tunnel/run-tunnel.sh
#
set -euo pipefail

# --- Preconditions -----------------------------------------------------------

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "ERROR: 'cloudflared' is not installed or not on PATH." >&2
  echo "       Install it first (see deploy/cloudflare-tunnel/README.md)." >&2
  exit 1
fi

if [ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
  echo "ERROR: CLOUDFLARE_TUNNEL_TOKEN is not set." >&2
  echo "       Create a Named Tunnel in the Cloudflare Zero Trust dashboard," >&2
  echo "       copy its connector token, then run:" >&2
  echo "         export CLOUDFLARE_TUNNEL_TOKEN='<token>'" >&2
  echo "         $0" >&2
  exit 1
fi

# --- Optional local reachability check --------------------------------------
# Warn (do not fail) if Odoo does not answer locally yet — the tunnel will
# still connect, but the public hostname would return 502 until Odoo is up.
ODOO_URL="${ODOO_LOCAL_URL:-http://localhost:8069}"
if command -v curl >/dev/null 2>&1; then
  if ! curl -fsS -o /dev/null --max-time 5 "${ODOO_URL}/web/health" 2>/dev/null; then
    echo "WARNING: ${ODOO_URL} did not respond to a health check." >&2
    echo "         The tunnel will start, but ${ODOO_URL} must be up for" >&2
    echo "         https://sattva.trilokventures.org to serve Odoo." >&2
  fi
fi

# --- Run the tunnel ----------------------------------------------------------
echo "Starting Cloudflare Tunnel (token mode)..."
echo "Public hostname routing is managed in the Zero Trust dashboard."
echo "Local origin: ${ODOO_URL}"

# --no-autoupdate keeps the process stable inside containers/VMs.
exec cloudflared tunnel --no-autoupdate run --token "${CLOUDFLARE_TUNNEL_TOKEN}"
