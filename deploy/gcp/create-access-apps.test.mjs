#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAccessApps, HOSTS, ZONE } from "./access-apps.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const errors = [];
function fail(msg) {
  errors.push(msg);
}

let threw = false;
try {
  buildAccessApps({ itEmails: "" });
} catch {
  threw = true;
}
if (!threw) fail("empty CF_ACCESS_IT_EMAILS must fail");

threw = false;
try {
  buildAccessApps({ itEmails: "not-an-opco@example.com" });
} catch {
  threw = true;
}
if (!threw) fail("non-OpCo IT email must fail");

const apps = buildAccessApps({ itEmails: "archneo@trilokventures.org" });
const names = apps.map((a) => a.name);
if (apps.length !== 4) fail("expected four Access apps");
if (!names.includes("Sattva Odoo") || !names.includes("Sattva Vault")) {
  fail("employee hosts missing");
}
if (!names.includes("n8n editor") || !names.includes("n8n webhooks HMAC")) {
  fail("n8n editor/webhook split missing");
}

for (const app of apps) {
  if (app.allow_authenticate_via_warp !== false) {
    fail(`${app.name} must disable WARP client auth`);
  }
  if (app.type !== "self_hosted") fail(`${app.name} must be self_hosted`);
}

const odoo = apps.find((a) => a.domain === HOSTS.odoo);
const vault = apps.find((a) => a.domain === HOSTS.vault);
const editor = apps.find((a) => a.domain === HOSTS.n8n);
const hooks = apps.find((a) => a.domain === `${HOSTS.n8n}/webhook`);
if (odoo?.policies[0].decision !== "allow") fail("odoo must Allow employees");
if (vault?.policies[0].decision !== "allow") fail("vault must Allow employees");
if (editor?.policies[0].decision !== "allow") fail("n8n editor must Allow IT");
if (hooks?.policies[0].decision !== "bypass") fail("webhooks must Bypass");
if (!hooks?.destinations.some((d) => d.uri === `${HOSTS.n8n}/webhook/*`)) {
  fail("webhook destination must be /webhook/*");
}

const blob = JSON.stringify(apps);
for (const banned of [`*.${ZONE}`, `app.${ZONE}`, `auth.${ZONE}`, `upload.${ZONE}`]) {
  if (blob.includes(banned)) fail(`payload must not mention ${banned}`);
}
if (apps.some((a) => a.domain === ZONE || a.destinations.some((d) => d.uri === ZONE))) {
  fail("payload must not protect the apex");
}

const script = readFileSync(join(ROOT, "create-access-apps.mjs"), "utf8");
if (!script.includes("allow_authenticate_via_warp: false") && !script.includes("buildAccessApps")) {
  fail("apply script must keep WARP flag false");
}
if (/CF_API_TOKEN=['\"][A-Za-z0-9_-]{20,}/.test(script)) {
  fail("literal API token in create-access-apps.mjs");
}

const runbook = readFileSync(
  join(ROOT, "../../docs/runbooks/cloudflare-access-path-b.md"),
  "utf8",
);
if (!runbook.includes("allow_authenticate_via_warp")) {
  fail("runbook must document the WARP flag error");
}
if (!runbook.includes("Do **not** use **Applications → Install**")) {
  fail("runbook must tell operators to skip the installer");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("access app payload tests passed");
