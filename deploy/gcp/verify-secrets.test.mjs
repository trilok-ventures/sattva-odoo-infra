#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));
const script = readFileSync(join(ROOT, "verify-secrets.sh"), "utf8");
const errors = [];

function fail(msg) {
  errors.push(msg);
}

for (const id of [
  "odoo-db-password",
  "odoo-admin-passwd",
  "n8n-encryption-key",
  "n8n-webhook-hmac",
  "n8n-db-password",
  "nextcloud-admin-password",
  "nextcloud-n8n-app-password",
  "odoo-n8n-api-key",
  "origin-tls-cert",
  "origin-tls-key",
]) {
  if (!script.includes(id)) fail(`verify-secrets.sh missing ${id}`);
}

if (!script.includes("never secret values") && !script.includes("never secret")) {
  fail("script header must state values are not printed");
}
if (!script.includes("projects get-iam-policy")) {
  fail("must inspect project-level secretAccessor bindings");
}
if (!script.includes("--impersonate-service-account")) {
  fail("must try access as the VM service account");
}
if (!script.includes("wc -c")) {
  fail("access check must report length, not payload");
}

const forbiddenTls = "client" + "_" + "auth";
const forbiddenCa = "Private" + "CA";
if (script.includes(forbiddenTls) || script.includes(forbiddenCa)) {
  fail("T2 markers in verify-secrets.sh");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("verify-secrets policy tests passed");
