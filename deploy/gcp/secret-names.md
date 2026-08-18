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
| `n8n-webhook-hmac` | BFF / n8n callbacks | Optional |
| `nextcloud-admin-password` | OpCo VM | Not for Vercel |
| `nextcloud-n8n-app-password` | n8n WebDAV | Same trees, distinct account |
| `upload-origin-hmac` | origin Caddy / local upload-origin | Minted POST tokens; not for Vercel |
| `keycloak-admin-password` | Phase 3 | Not for Vercel |
| `middleware-session-secret` | Vercel BFF | Cookie encryption |

Vercel env names (BFF): `FABRIC_MODE`, `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`,
`ODOO_API_KEY`, `N8N_BASE_URL`. `ODOO_URL` etc. are server-only. Never prefix with
`NEXT_PUBLIC_`.
