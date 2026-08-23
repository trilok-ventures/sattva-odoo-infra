#!/usr/bin/env bash
# Seed the fabric §5.3 Nextcloud folder convention for the admin user.
# Does not enable public shares. Does not create a second admin.
set -euo pipefail

log() { echo "$*" >&2; }
NC="${NEXTCLOUD_CONTAINER:-sattva-prod-nextcloud}"

if ! docker inspect "${NC}" >/dev/null 2>&1; then
  log "missing container ${NC}"
  exit 1
fi

docker exec "${NC}" bash -s <<'BASH'
set -euo pipefail
DATA="/var/www/html/data/admin/files"
trees=(
  PCP/Supplier_Audits
  PCP/Hazard_Control
  PCP/Verification_Records
  PCP/CAPA
  PCP/Consumer_Protection
  PCP/Training_Evidence
  PCP/Retention_Logs
  Suppliers
  Clients
)
for rel in "${trees[@]}"; do
  mkdir -p "${DATA}/${rel}"
done
if id www-data >/dev/null 2>&1; then
  chown -R www-data:www-data "${DATA}/PCP" "${DATA}/Suppliers" "${DATA}/Clients"
fi
BASH

docker exec -u www-data "${NC}" php occ files:scan --path="/admin/files/PCP"
docker exec -u www-data "${NC}" php occ files:scan --path="/admin/files/Suppliers"
docker exec -u www-data "${NC}" php occ files:scan --path="/admin/files/Clients"
docker exec "${NC}" php occ config:app:set core shareapi_allow_links --value=no
docker exec "${NC}" php occ config:app:set core shareapi_allow_public_upload --value=no
log "Seeded /PCP/* /Suppliers /Clients for Nextcloud userid admin. Public shares stay off."
