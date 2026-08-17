# n8n workflows (source of truth)

Production workflow JSON lives here, reviewed in PRs, imported to staging
then production. Do not treat the n8n editor as canonical.

Compose runs `n8n` (editor, host 127.0.0.1:5678) plus `n8n-worker` (no
host ports) on Redis (`EXECUTIONS_MODE=queue`).

RED-touching nodes: `settings.saveDataSuccessExecution` and
`settings.saveDataErrorExecution` must be `none` so execution logs never
keep COA bytes or vault paths. CI runs `validate-workflows.mjs`.

Local `127.0.0.1:8091` (`deploy/local/upload-origin`) is an ephemeral T0
test sink. It is not Nextcloud and not production `upload.trilokventures.org`.

Credential names used by workflows (values stay in the n8n store, not git):
`odooN8nFabric`, `nextcloudN8nVault`.
