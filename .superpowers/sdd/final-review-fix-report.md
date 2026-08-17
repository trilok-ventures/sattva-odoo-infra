# Final review fix report

## Status

DONE

## Changes

1. `POST /api/documents` now accepts exactly `filename` and `sha256`; contract checks reject every reviewed RED/storage key and arbitrary extras, including an empty `path`.
2. The local upload origin streams bytes through SHA-256 and discards them without creating files.
3. Mock upload URLs are emitted only for `localhost`, `127.0.0.1`, or exact `https://upload.trilokventures.org` origins.
4. Supplier and buyer `search_read` calls now pass one nested domain argument, and event identity is restored explicitly after WebDAV responses.
5. Supplier and buyer workflows expand nested paths into ordered MKCOL prefixes and accept 2xx/405/409 outcomes.
6. All four GREEN webhook workflows unwrap `body ?? input` and require `x-sattva-webhook-hmac` to match `N8N_WEBHOOK_HMAC`.
7. Odoo HTTP nodes use `httpHeaderAuth.value` and bind generic header authentication.
8. Both n8n services receive the required Odoo, Nextcloud, and webhook environment variables; local placeholders are documented.
9. Vault, notification, handoff, and lead-score helpers require the n8n service group or superuser. Lead scoring uses a narrow sudo helper, and PO intents sudo-create drafts only.
10. COA mapping/comparison recursively rejects forbidden keys and strictly validates filenames, SHA-256 values, numeric moisture fields, and boolean mesh fields.
11. Notification roles map to named Odoo groups, exclude service users, and fail when no eligible human exists.
12. The T2 scanner checks every relative path segment and exempts only its exact scanner file.
13. Middleware documentation now states the BFF has no WebDAV/Nextcloud connection.
14. Every `wf.*.json` has a stable top-level string ID.

## Commits

- `509893ce26524c8e60ca5392ee191b3e602ddfa3` — `fix: harden document upload boundaries`
- `303339979beaa0d621ebba5276d21dd78e183ba1` — `fix: harden n8n workflow service boundaries`
- `5e8dd2a4804bdd29850b35c90d76b4694ab9d285` — `fix: restrict Odoo fabric service helpers`
- `7c7b6818a1025b46d486ba124c238dfd1ec85ffb` — `test: avoid T2 scanner fixture self-match`
- `d8d7cbdab27bee2561dd7714e1279c9b29000065` — `fix: scope notify assignee lookup after service gate`

## Exact commands and full final output

### Middleware build

Command:

```bash
cd /workspace/middleware && npm run build
```

Output:

```text

> sattva-middleware@0.0.0 build
> next build

   ▲ Next.js 15.1.11

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/4) ...
   Generating static pages (1/4) 
   Generating static pages (2/4) 
   Generating static pages (3/4) 
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    162 B           106 kB
├ ○ /_not-found                          979 B           106 kB
├ ƒ /api/activities                      162 B           106 kB
├ ƒ /api/catalogue                       162 B           106 kB
├ ƒ /api/compliance/queue                162 B           106 kB
├ ƒ /api/dashboard                       162 B           106 kB
├ ƒ /api/documents                       162 B           106 kB
├ ƒ /api/health                          162 B           106 kB
├ ƒ /api/lots                            162 B           106 kB
├ ƒ /api/purchase/orders                 162 B           106 kB
└ ƒ /api/purchase/orders/[id]/confirm    162 B           106 kB
+ First Load JS shared by all            105 kB
  ├ chunks/4bd1b696-20882bf820444624.js  52.9 kB
  ├ chunks/517-fe7ccad031cf7948.js       50.5 kB
  └ other shared chunks (total)          1.86 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

```

### Middleware contract

The rebuilt server ran on port 3013 with mock mode and the allowlisted local upload origin.

Command:

```bash
cd /workspace/middleware && SATTVA_BFF_URL=http://127.0.0.1:3013 UPLOAD_ORIGIN_PUBLIC_URL=http://127.0.0.1:8091 npm test
```

Output:

```text

> sattva-middleware@0.0.0 test
> node scripts/contract-check.mjs

OK strip drops path
OK strip drops password
OK strip drops checksum_sha256
OK strip keeps GREEN moisture
OK strip keeps GREEN coa_sha256
OK clean object has no RED keys
OK live mode refuses persona header
OK root vercel.json still publishes mocks only
OK health 200
OK health mock mode
OK health has no fabric hostnames
OK health has no urls
OK dashboard 200
OK dashboard GREEN
OK sales has no unpaid_invoices
OK finance sees invoices kpi
OK confirm pending is 409
OK title gate
OK no confirm anyway flag
OK approved confirm 200
OK state purchase
OK buyer cannot confirm
OK buyer lots GREEN
OK buyer sees SO-1042 lot
OK upload rejects client path
OK upload rejects extra key bytes
OK upload rejects extra key pdf
OK upload rejects extra key path
OK upload rejects extra key file_bytes
OK upload rejects extra key nextcloud_folder_path
OK upload rejects extra key unexpected
OK upload rejects traversal filename
OK upload receipt 200
OK upload returns sha256
OK upload has no path
OK upload_url omitted or origin
OK health has no nextcloud key
OK buyer may mint metadata receipt
OK local origin mint present
OK local origin mint host
OK mock allows missing persona
OK unknown persona 400
OK activities 200
OK activities GREEN
OK activities are SATTVA prefixed
OK buyer activities empty
OK catalogue 200
OK catalogue GREEN
OK catalogue has onion flake
OK catalogue has no price key
OK logistics persona 200
contract-check passed
```

### Upload-origin public URL deny case

The rebuilt server ran on port 3014 with `UPLOAD_ORIGIN_PUBLIC_URL=https://evil.example`.

Command:

```bash
cd /workspace/middleware && node --input-type=module -e "const response = await fetch('http://127.0.0.1:3014/api/documents', {method:'POST', headers:{'content-type':'application/json','x-sattva-persona':'supplier'}, body:JSON.stringify({filename:'coa.pdf',sha256:'a'.repeat(64)})}); const body=await response.json(); if(response.status!==200||body.upload_url!==undefined) throw new Error(JSON.stringify({status:response.status,body})); console.log('disallowed upload origin omitted:', JSON.stringify(body));"
```

Output:

```text
disallowed upload origin omitted: {"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","filename":"coa.pdf"}
```

### n8n validators

Commands and outputs:

```bash
cd /workspace && node n8n/workflows/validate-register.mjs
```

```text
service-register validation passed
```

```bash
cd /workspace && node n8n/workflows/leadscore.test.mjs
```

```text
leadscore tests passed
```

```bash
cd /workspace && node n8n/workflows/validate-workflows.mjs n8n/workflows/wf.*.json
```

```text
workflow validation passed
```

```bash
cd /workspace && node n8n/workflows/assert-no-mtls.mjs
```

```text
no T2 mTLS implementation files in this change set policy path
```

```bash
cd /workspace && node n8n/workflows/t2-absence-gate.test.mjs
```

```text
t2-absence-gate tests passed
```

### Upload-origin discard check

The current upload-origin ran on loopback port 8092.

Command:

```bash
cd /workspace && node --input-type=module -e "import { readdir } from 'node:fs/promises'; const files=async()=>{try{return (await readdir('/tmp/sattva-upload-origin')).sort()}catch(error){if(error.code==='ENOENT')return [];throw error}}; const before=await files(); const response=await fetch('http://127.0.0.1:8092/u/review-fixture',{method:'POST',body:Buffer.from('synthetic-red-pdf-bytes')}); const after=await files(); if(response.status!==204) throw new Error('expected 204, got '+response.status); if(JSON.stringify(before)!==JSON.stringify(after)) throw new Error('upload-origin persisted a file'); console.log('status='+response.status); console.log('files_before='+JSON.stringify(before)); console.log('files_after='+JSON.stringify(after)); console.log('upload-origin consumed, hashed, and discarded bytes');"
```

Output:

```text
status=204
files_before=["33ffd954-cdb3-438d-9fed-ad54b8270cf3"]
files_after=["33ffd954-cdb3-438d-9fed-ad54b8270cf3"]
upload-origin consumed, hashed, and discarded bytes
```

The pre-existing file is from an earlier implementation run; this test verified the new server created no additional file.

### Compose

Command:

```bash
cd /workspace && sudo env ODOO_DB_PASSWORD=sattva_db_secure_pass ODOO_N8N_UID=2 N8N_WEBHOOK_HMAC=review-local-only ./deploy/local/compose-healthcheck.sh .env
```

Output:

```text
Compose fabric is valid and all published ports are loopback-only.
```

Odoo test services were started with:

```bash
cd /workspace && sudo env ODOO_DB_PASSWORD=sattva_db_secure_pass ODOO_N8N_UID=2 N8N_WEBHOOK_HMAC=review-local-only docker compose up -d db web
```

Output:

```text
 Container sattva-odoo-db Recreate 
 Container sattva-odoo-db Recreated 
 Container sattva-odoo-web Recreate 
 Container sattva-odoo-web Recreated 
 Container sattva-odoo-db Starting 
 Container sattva-odoo-db Started 
 Container sattva-odoo-web Starting 
 Container sattva-odoo-web Started 
```

### Odoo Python syntax

Command:

```bash
cd /workspace && sudo docker exec sattva-odoo-web python3 -c "import ast,sys; [print('OK', f) or ast.parse(open(f).read(), f) for f in sys.argv[1:]]" /mnt/extra-addons/sattva_compliance/models/service_security.py /mnt/extra-addons/sattva_compliance/models/leadscore.py /mnt/extra-addons/sattva_compliance/models/vault.py /mnt/extra-addons/sattva_compliance/models/notify.py /mnt/extra-addons/sattva_compliance/models/order_handoff.py /mnt/extra-addons/sattva_compliance/tests/test_vault_path.py /mnt/extra-addons/sattva_compliance/tests/test_notify_activity.py /mnt/extra-addons/sattva_compliance/tests/test_order_handoff.py /mnt/extra-addons/sattva_compliance/tests/test_lead_green_score.py
```

Output:

```text
OK /mnt/extra-addons/sattva_compliance/models/service_security.py
OK /mnt/extra-addons/sattva_compliance/models/leadscore.py
OK /mnt/extra-addons/sattva_compliance/models/vault.py
OK /mnt/extra-addons/sattva_compliance/models/notify.py
OK /mnt/extra-addons/sattva_compliance/models/order_handoff.py
OK /mnt/extra-addons/sattva_compliance/tests/test_vault_path.py
OK /mnt/extra-addons/sattva_compliance/tests/test_notify_activity.py
OK /mnt/extra-addons/sattva_compliance/tests/test_order_handoff.py
OK /mnt/extra-addons/sattva_compliance/tests/test_lead_green_score.py
```

### Odoo module update

Command:

```bash
cd /workspace && sudo docker exec sattva-odoo-web odoo -d sattva -u sattva_compliance --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons -c /dev/null --http-port=8070 --stop-after-init
```

Output:

```text
2026-08-17 17:32:55,201 21 INFO ? odoo: Odoo version 18.0-20260810 
2026-08-17 17:32:55,201 21 INFO ? odoo: addons paths: ['/usr/lib/python3/dist-packages/odoo/addons', '/var/lib/odoo/.local/share/Odoo/addons/18.0', '/mnt/extra-addons'] 
2026-08-17 17:32:55,201 21 INFO ? odoo: database: odoo@db:5432 
Warn: Can't find .pfb for face 'Courier'
2026-08-17 17:32:55,540 21 INFO ? odoo.addons.base.models.ir_actions_report: Will use the Wkhtmltopdf binary at /usr/local/bin/wkhtmltopdf 
2026-08-17 17:32:55,549 21 INFO ? odoo.addons.base.models.ir_actions_report: Will use the Wkhtmltoimage binary at /usr/local/bin/wkhtmltoimage 
2026-08-17 17:32:56,002 21 INFO sattva odoo.modules.loading: loading 1 modules... 
2026-08-17 17:32:56,005 21 INFO sattva odoo.modules.loading: 1 modules loaded in 0.00s, 0 queries (+0 extra) 
2026-08-17 17:32:56,022 21 INFO sattva odoo.modules.loading: updating modules list 
2026-08-17 17:32:56,025 21 INFO sattva odoo.addons.base.models.ir_module: ALLOW access to module.update_list on [] to user __system__ #1 via n/a 
2026-08-17 17:32:56,619 21 WARNING sattva odoo.modules.module: Missing `license` key in manifest for 'sattva_compliance', defaulting to LGPL-3 
2026-08-17 17:32:56,751 21 INFO sattva odoo.addons.base.models.ir_module: ALLOW access to module.button_upgrade on ['Sattva Brokers: Compliance & Supplier Gates'] to user __system__ #1 via n/a 
2026-08-17 17:32:56,751 21 INFO sattva odoo.addons.base.models.ir_module: ALLOW access to module.update_list on ['Sattva Brokers: Compliance & Supplier Gates'] to user __system__ #1 via n/a 
2026-08-17 17:32:57,107 21 INFO sattva odoo.addons.base.models.ir_module: ALLOW access to module.button_install on [] to user __system__ #1 via n/a 
2026-08-17 17:32:57,132 21 INFO sattva odoo.modules.loading: loading 57 modules... 
2026-08-17 17:32:58,712 21 INFO sattva odoo.modules.loading: Loading module sattva_compliance (57/57) 
2026-08-17 17:32:58,856 21 INFO sattva odoo.modules.registry: module sattva_compliance: creating or updating database tables 
2026-08-17 17:32:58,996 21 INFO sattva odoo.modules.loading: loading sattva_compliance/security/sattva_security.xml 
2026-08-17 17:32:59,029 21 INFO sattva odoo.modules.loading: loading sattva_compliance/security/ir.model.access.csv 
2026-08-17 17:32:59,041 21 INFO sattva odoo.modules.loading: Module sattva_compliance loaded in 0.33s, 174 queries (+174 other) 
2026-08-17 17:32:59,041 21 INFO sattva odoo.modules.loading: 57 modules loaded in 1.91s, 174 queries (+174 extra) 
2026-08-17 17:32:59,695 21 INFO sattva odoo.modules.loading: Modules loaded. 
2026-08-17 17:32:59,697 21 INFO sattva odoo.modules.registry: Registry changed, signaling through the database 
2026-08-17 17:32:59,699 21 INFO sattva odoo.modules.registry: Registry loaded in 3.737s 
2026-08-17 17:32:59,699 21 INFO sattva odoo.service.server: Initiating shutdown 
2026-08-17 17:32:59,699 21 INFO sattva odoo.service.server: Hit CTRL-C again or send a second signal to force the shutdown. 
2026-08-17 17:32:59,699 21 INFO sattva odoo.sql_db: ConnectionPool(read/write;used=0/count=0/max=64): Closed 1 connections  
```

### Odoo addon tests

Command:

```bash
cd /workspace && sudo docker exec sattva-odoo-web odoo -d sattva -u sattva_compliance --test-enable --test-tags /sattva_compliance --db_host=db --db_port=5432 --db_user=odoo --db_password=sattva_db_secure_pass --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons -c /dev/null --http-port=8070 --stop-after-init
```

Output:

```text
2026-08-17 17:33:52,476 50 INFO ? odoo: Odoo version 18.0-20260810 
2026-08-17 17:33:52,477 50 INFO ? odoo: addons paths: ['/usr/lib/python3/dist-packages/odoo/addons', '/var/lib/odoo/.local/share/Odoo/addons/18.0', '/mnt/extra-addons'] 
2026-08-17 17:33:52,477 50 INFO ? odoo: database: odoo@db:5432 
Warn: Can't find .pfb for face 'Courier'
2026-08-17 17:33:52,810 50 INFO ? odoo.addons.base.models.ir_actions_report: Will use the Wkhtmltopdf binary at /usr/local/bin/wkhtmltopdf 
2026-08-17 17:33:52,817 50 INFO ? odoo.addons.base.models.ir_actions_report: Will use the Wkhtmltoimage binary at /usr/local/bin/wkhtmltoimage 
2026-08-17 17:33:53,217 50 INFO ? odoo.service.server: HTTP service (werkzeug) running on 4d57f611f457:8070 
2026-08-17 17:33:53,333 50 INFO sattva odoo.tests.common: Importing test framework 
2026-08-17 17:33:53,364 50 INFO sattva odoo.modules.loading: loading 1 modules... 
2026-08-17 17:33:53,367 50 INFO sattva odoo.modules.loading: 1 modules loaded in 0.00s, 0 queries (+0 extra) 
2026-08-17 17:33:53,383 50 INFO sattva odoo.modules.loading: updating modules list 
2026-08-17 17:33:53,385 50 INFO sattva odoo.addons.base.models.ir_module: ALLOW access to module.update_list on [] to user __system__ #1 via n/a 
2026-08-17 17:33:53,813 50 WARNING sattva odoo.modules.module: Missing `license` key in manifest for 'sattva_compliance', defaulting to LGPL-3 
2026-08-17 17:33:53,921 50 INFO sattva odoo.addons.base.models.ir_module: ALLOW access to module.button_upgrade on ['Sattva Brokers: Compliance & Supplier Gates'] to user __system__ #1 via n/a 
2026-08-17 17:33:53,921 50 INFO sattva odoo.addons.base.models.ir_module: ALLOW access to module.update_list on ['Sattva Brokers: Compliance & Supplier Gates'] to user __system__ #1 via n/a 
2026-08-17 17:33:54,291 50 INFO sattva odoo.addons.base.models.ir_module: ALLOW access to module.button_install on [] to user __system__ #1 via n/a 
2026-08-17 17:33:54,311 50 INFO sattva odoo.modules.loading: loading 57 modules... 
2026-08-17 17:33:55,686 50 INFO sattva odoo.modules.loading: Loading module sattva_compliance (57/57) 
2026-08-17 17:33:55,827 50 INFO sattva odoo.modules.registry: module sattva_compliance: creating or updating database tables 
2026-08-17 17:33:55,952 50 INFO sattva odoo.modules.loading: loading sattva_compliance/security/sattva_security.xml 
2026-08-17 17:33:55,958 50 INFO sattva odoo.modules.loading: loading sattva_compliance/security/ir.model.access.csv 
2026-08-17 17:33:55,977 50 INFO sattva odoo.modules.loading: Module sattva_compliance loaded in 0.29s, 148 queries (+148 other) 
2026-08-17 17:33:55,977 50 INFO sattva odoo.modules.loading: 57 modules loaded in 1.67s, 148 queries (+148 extra) 
2026-08-17 17:33:56,647 50 INFO sattva odoo.modules.loading: Modules loaded. 
2026-08-17 17:33:56,650 50 INFO sattva odoo.modules.registry: Registry changed, signaling through the database 
2026-08-17 17:33:56,651 50 INFO sattva odoo.modules.registry: Registry loaded in 3.433s 
2026-08-17 17:33:56,651 50 INFO sattva odoo.service.server: Starting post tests 
2026-08-17 17:33:56,744 50 INFO sattva odoo.models.unlink: User #1 deleted mail.mail records with IDs: [28] 
2026-08-17 17:33:56,753 50 INFO sattva odoo.models.unlink: User #1 deleted mail.message records with IDs: [171] 
2026-08-17 17:33:56,755 50 INFO sattva odoo.addons.auth_signup.models.res_users: Signup email sent for user <synthetic_n8n_fabric_service_kyc> to <s.s@example.com> 
2026-08-17 17:33:56,756 50 INFO sattva odoo.addons.sattva_compliance.tests.test_buyer_kyc: Starting TestBuyerKyc.test_buyer_kyc_complete_does_not_unlock_po ... 
2026-08-17 17:33:56,813 50 INFO sattva odoo.addons.sattva_compliance.tests.test_buyer_kyc: Starting TestBuyerKyc.test_customer_create_queues_onboarding_folder_and_pending_kyc ... 
2026-08-17 17:33:56,825 50 INFO sattva odoo.addons.sattva_compliance.tests.test_buyer_kyc: Starting TestBuyerKyc.test_dual_role_keeps_two_vault_pointers ... 
2026-08-17 17:33:56,840 50 INFO sattva odoo.addons.base.models.ir_attachment: filestore gc 0 checked, 0 removed 
2026-08-17 17:33:56,902 50 INFO sattva odoo.models.unlink: User #1 deleted mail.mail records with IDs: [29] 
2026-08-17 17:33:56,907 50 INFO sattva odoo.models.unlink: User #1 deleted mail.message records with IDs: [179] 
2026-08-17 17:33:56,908 50 INFO sattva odoo.addons.auth_signup.models.res_users: Signup email sent for user <synthetic_n8n_leadscore> to <s.s@example.com> 
2026-08-17 17:33:56,982 50 INFO sattva odoo.models.unlink: User #1 deleted mail.mail records with IDs: [30] 
2026-08-17 17:33:56,986 50 INFO sattva odoo.models.unlink: User #1 deleted mail.message records with IDs: [181] 
2026-08-17 17:33:56,988 50 INFO sattva odoo.addons.auth_signup.models.res_users: Signup email sent for user <synthetic_non_fabric_leadscore> to <s.s@example.com> 
2026-08-17 17:33:56,991 50 INFO sattva odoo.addons.sattva_compliance.tests.test_lead_green_score: Starting TestLeadGreenScore.test_green_score_fields_require_no_pii ... 
2026-08-17 17:33:57,016 50 INFO sattva odoo.addons.sattva_compliance.tests.test_lead_green_score: Starting TestLeadGreenScore.test_green_score_rejects_non_service_user ... 
2026-08-17 17:33:57,040 50 INFO sattva odoo.addons.base.models.ir_attachment: filestore gc 1 checked, 1 removed 
2026-08-17 17:33:57,103 50 INFO sattva odoo.models.unlink: User #1 deleted mail.mail records with IDs: [31] 
2026-08-17 17:33:57,108 50 INFO sattva odoo.models.unlink: User #1 deleted mail.message records with IDs: [185] 
2026-08-17 17:33:57,110 50 INFO sattva odoo.addons.auth_signup.models.res_users: Signup email sent for user <synthetic_n8n_notify> to <s.s@example.com> 
2026-08-17 17:33:57,183 50 INFO sattva odoo.models.unlink: User #1 deleted mail.mail records with IDs: [32] 
2026-08-17 17:33:57,187 50 INFO sattva odoo.models.unlink: User #1 deleted mail.message records with IDs: [187] 
2026-08-17 17:33:57,188 50 INFO sattva odoo.addons.auth_signup.models.res_users: Signup email sent for user <synthetic_human_sales_assignee> to <s.s@example.com> 
2026-08-17 17:33:57,260 50 INFO sattva odoo.models.unlink: User #1 deleted mail.mail records with IDs: [33] 
2026-08-17 17:33:57,264 50 INFO sattva odoo.models.unlink: User #1 deleted mail.message records with IDs: [189] 
2026-08-17 17:33:57,266 50 INFO sattva odoo.addons.auth_signup.models.res_users: Signup email sent for user <synthetic_non_fabric_notify> to <s.s@example.com> 
2026-08-17 17:33:57,268 50 INFO sattva odoo.addons.sattva_compliance.tests.test_notify_activity: Starting TestNotifyActivity.test_notify_rejects_non_service_user ... 
2026-08-17 17:33:57,288 50 INFO sattva odoo.addons.sattva_compliance.tests.test_notify_activity: Starting TestNotifyActivity.test_notify_rejects_service_user_as_compliance_assignee ... 
2026-08-17 17:33:57,310 50 INFO sattva odoo.addons.sattva_compliance.tests.test_notify_activity: Starting TestNotifyActivity.test_qualified_lead_creates_sales_activity ... 
2026-08-17 17:33:57,387 50 INFO sattva odoo.models.unlink: User #34 deleted mail.mail records with IDs: [34] 
2026-08-17 17:33:57,398 50 INFO sattva odoo.addons.base.models.ir_attachment: filestore gc 2 checked, 2 removed 
2026-08-17 17:33:57,461 50 INFO sattva odoo.models.unlink: User #1 deleted mail.mail records with IDs: [35] 
2026-08-17 17:33:57,464 50 INFO sattva odoo.models.unlink: User #1 deleted mail.message records with IDs: [195] 
2026-08-17 17:33:57,466 50 INFO sattva odoo.addons.auth_signup.models.res_users: Signup email sent for user <synthetic_n8n_handoff> to <s.s@example.com> 
2026-08-17 17:33:57,540 50 INFO sattva odoo.models.unlink: User #1 deleted mail.mail records with IDs: [36] 
2026-08-17 17:33:57,544 50 INFO sattva odoo.models.unlink: User #1 deleted mail.message records with IDs: [197] 
2026-08-17 17:33:57,546 50 INFO sattva odoo.addons.auth_signup.models.res_users: Signup email sent for user <synthetic_non_fabric_handoff> to <s.s@example.com> 
2026-08-17 17:33:57,548 50 INFO sattva odoo.addons.sattva_compliance.tests.test_order_handoff: Starting TestOrderHandoff.test_handoff_creates_draft_and_does_not_confirm_pending_supplier ... 
2026-08-17 17:33:57,594 50 INFO sattva odoo.addons.sattva_compliance.tests.test_order_handoff: Starting TestOrderHandoff.test_handoff_rejects_non_service_user ... 
2026-08-17 17:33:57,626 50 INFO sattva odoo.addons.base.models.ir_attachment: filestore gc 1 checked, 1 removed 
2026-08-17 17:33:57,687 50 INFO sattva odoo.models.unlink: User #1 deleted mail.mail records with IDs: [37] 
2026-08-17 17:33:57,690 50 INFO sattva odoo.models.unlink: User #1 deleted mail.message records with IDs: [206] 
2026-08-17 17:33:57,692 50 INFO sattva odoo.addons.auth_signup.models.res_users: Signup email sent for user <synthetic_n8n_fabric_service> to <s.s@example.com> 
2026-08-17 17:33:57,692 50 INFO sattva odoo.addons.sattva_compliance.tests.test_supplier_folder_request: Starting TestSupplierFolderRequest.test_non_supplier_creation_does_not_queue_folder_request ... 
2026-08-17 17:33:57,702 50 INFO sattva odoo.addons.sattva_compliance.tests.test_supplier_folder_request: Starting TestSupplierFolderRequest.test_supplier_creation_queues_request_for_fabric_service_user ... 
2026-08-17 17:33:57,718 50 INFO sattva odoo.addons.base.models.ir_attachment: filestore gc 0 checked, 0 removed 
2026-08-17 17:33:57,779 50 INFO sattva odoo.models.unlink: User #1 deleted mail.mail records with IDs: [38] 
2026-08-17 17:33:57,783 50 INFO sattva odoo.models.unlink: User #1 deleted mail.message records with IDs: [210] 
2026-08-17 17:33:57,785 50 INFO sattva odoo.addons.auth_signup.models.res_users: Signup email sent for user <synthetic_n8n_vault> to <s.s@example.com> 
2026-08-17 17:33:57,857 50 INFO sattva odoo.models.unlink: User #1 deleted mail.mail records with IDs: [39] 
2026-08-17 17:33:57,860 50 INFO sattva odoo.models.unlink: User #1 deleted mail.message records with IDs: [212] 
2026-08-17 17:33:57,862 50 INFO sattva odoo.addons.auth_signup.models.res_users: Signup email sent for user <synthetic_non_fabric_vault> to <s.s@example.com> 
2026-08-17 17:33:57,864 50 INFO sattva odoo.addons.sattva_compliance.tests.test_vault_path: Starting TestVaultPath.test_set_partner_path_rejects_non_service_user ... 
2026-08-17 17:33:57,875 50 INFO sattva odoo.addons.sattva_compliance.tests.test_vault_path: Starting TestVaultPath.test_set_partner_path_rejects_unknown_kind ... 
2026-08-17 17:33:57,887 50 INFO sattva odoo.addons.sattva_compliance.tests.test_vault_path: Starting TestVaultPath.test_set_supplier_path_does_not_change_pcp ... 
2026-08-17 17:33:57,903 50 INFO sattva odoo.addons.base.models.ir_attachment: filestore gc 1 checked, 1 removed 
2026-08-17 17:33:57,904 50 INFO sattva odoo.service.server: 15 post-tests in 1.25s, 2265 queries 
2026-08-17 17:33:57,904 50 INFO sattva odoo.tests.stats: sattva_compliance: 27 tests 1.25s 2265 queries 
2026-08-17 17:33:57,904 50 INFO sattva odoo.tests.result: 0 failed, 0 error(s) of 15 tests when loading database 'sattva' 
2026-08-17 17:33:57,904 50 INFO sattva odoo.service.server: Initiating shutdown 
2026-08-17 17:33:57,904 50 INFO sattva odoo.service.server: Hit CTRL-C again or send a second signal to force the shutdown. 
2026-08-17 17:33:58,247 50 INFO sattva odoo.sql_db: ConnectionPool(read/write;used=0/count=0/max=64): Closed 1 connections  
```

## Iteration notes

- The first T2 scan flagged the test fixture's literal forbidden directory token. Commit `7c7b6818a1025b46d486ba124c238dfd1ec85ffb` constructs the same path token at runtime, preserving the regression case without exempting the test file.
- The first Odoo suite run found that a gated service caller could not read `res.groups` while selecting an assignee. Commit `d8d7cbdab27bee2561dd7714e1279c9b29000065` applies scoped sudo only to the post-gate group membership lookup. The complete suite then passed.

## Concerns

- Odoo still emits the pre-existing manifest warning that `sattva_compliance` has no explicit `license`; it does not affect module load or tests.
- `/tmp/sattva-upload-origin` contained one file from an earlier implementation run. The new discard test verified the directory contents did not change.
