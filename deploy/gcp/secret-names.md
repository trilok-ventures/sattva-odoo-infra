# Secret names (AssetCo) — values never in git

Create these in Secret Manager in the AssetCo project. Grant the OpCo VM
service account accessor. Map a subset into the Vercel BFF project as env vars
(URLs + least-privilege API keys only).

| Secret id | Used by | Notes |
| --- | --- | --- |
| `odoo-db-password` | OpCo VM / Odoo | Not for Vercel |
| `odoo-admin-passwd` | OpCo VM / Caddy block list_db | Not for Vercel |
| `odoo-n8n-api-key` | n8n → Odoo | Fabric user `n8n.fabric` |
| `odoo-middleware-api-key` | Vercel BFF → Odoo | Fabric user `middleware.bff` |
| `n8n-encryption-key` | n8n | Not for Vercel |
| `n8n-db-password` | n8n Postgres on the VM | Not for Vercel |
| `n8n-webhook-hmac` | BFF / n8n callbacks | Optional |
| `origin-tls-cert` | Caddy Origin Certificate PEM | Not for Vercel |
| `origin-tls-key` | Caddy Origin Certificate private key | Not for Vercel |
| `nextcloud-admin-password` | OpCo VM | Not for Vercel |
| `nextcloud-n8n-app-password` | n8n WebDAV | Same trees, distinct account |
| `upload-origin-hmac` | origin Caddy / local upload-origin | Minted POST tokens; not for Vercel |
| `keycloak-admin-password` | Phase 3 | Not for Vercel |
| `middleware-session-secret` | Vercel BFF | Cookie encryption |

Vercel env names (BFF): `FABRIC_MODE`, `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`,
`ODOO_API_KEY`, `N8N_BASE_URL`. `ODOO_URL` etc. are server-only. Never prefix with
`NEXT_PUBLIC_`.

Create ids in AssetCo (values added as versions; never commit them):

```bash
ASSET=tv-assetco-secrets
for id in odoo-db-password odoo-admin-passwd n8n-encryption-key n8n-webhook-hmac \
  n8n-db-password nextcloud-admin-password nextcloud-n8n-app-password \
  odoo-n8n-api-key origin-tls-cert origin-tls-key; do
  gcloud secrets describe "${id}" --project="${ASSET}" >/dev/null 2>&1 \
    || gcloud secrets create "${id}" --replication-policy=automatic --project="${ASSET}"
done
# Add a version from a local file you do not commit:
# gcloud secrets versions add odoo-db-password --data-file=./odoo-db-password.txt --project="${ASSET}"
```
