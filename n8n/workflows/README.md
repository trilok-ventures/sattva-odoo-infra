# n8n workflows (source of truth)

Production workflow JSON lives here, reviewed in PRs, imported to n8n.
Do not treat the n8n editor as canonical.

RED-touching nodes: disable save-data on success and on error so execution
logs never keep COA bytes or vault paths.

Until Phase 1 Compose adds n8n, this directory holds the contract only.
