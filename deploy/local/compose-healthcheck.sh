#!/usr/bin/env bash
set -euo pipefail

readonly repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly env_file="${1:-${repo_root}/.env}"
readonly config_file="$(mktemp)"

trap 'rm -f "${config_file}"' EXIT

if [[ ! -f "${env_file}" ]]; then
  printf 'Environment file not found: %s\n' "${env_file}" >&2
  exit 1
fi

docker compose \
  --project-directory "${repo_root}" \
  --env-file "${env_file}" \
  config --quiet

docker compose \
  --project-directory "${repo_root}" \
  --env-file "${env_file}" \
  config --format json > "${config_file}"

python3 - "${config_file}" <<'PY'
import json
import sys


with open(sys.argv[1], encoding="utf-8") as config_stream:
    config = json.load(config_stream)

services = config.get("services", {})
required_hostnames = {
    "web": "odoo",
    "nextcloud": "nextcloud",
    "n8n": "n8n",
    "redis": "redis",
}
errors = []

for service_name, hostname in required_hostnames.items():
    service = services.get(service_name)
    if service is None:
        errors.append(f"missing service: {service_name}")
        continue

    networks = service.get("networks", {})
    network_config = networks.get("sattva_cloud_net") if isinstance(networks, dict) else None
    aliases = network_config.get("aliases", []) if isinstance(network_config, dict) else []
    if service_name != hostname and hostname not in aliases:
        errors.append(f"{service_name} is missing network alias: {hostname}")
    if "sattva_cloud_net" not in networks:
        errors.append(f"{service_name} is not attached to sattva_cloud_net")

    ports = service.get("ports", [])
    if not ports:
        errors.append(f"{service_name} has no loopback port binding")
    for port in ports:
        if port.get("host_ip") != "127.0.0.1":
            errors.append(
                f"{service_name} port {port.get('published')} binds to "
                f"{port.get('host_ip') or 'all interfaces'}"
            )

worker = services.get("n8n-worker")
if worker is None:
    errors.append("missing service: n8n-worker")
else:
    if worker.get("ports"):
        errors.append("n8n-worker must not publish host ports")
    command = worker.get("command") or []
    if "worker" not in command:
        errors.append("n8n-worker command must include worker")
    if "sattva_cloud_net" not in (worker.get("networks") or {}):
        errors.append("n8n-worker is not attached to sattva_cloud_net")
    environment = worker.get("environment") or {}
    env_map = environment if isinstance(environment, dict) else {}
    if isinstance(environment, list):
        env_map = dict(item.split("=", 1) for item in environment if "=" in item)
    if env_map.get("EXECUTIONS_MODE") != "queue":
        errors.append("n8n-worker EXECUTIONS_MODE must be queue")
    if env_map.get("QUEUE_BULL_REDIS_HOST") != "redis":
        errors.append("n8n-worker must use redis queue host")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print("Compose fabric is valid and all published ports are loopback-only.")
PY
