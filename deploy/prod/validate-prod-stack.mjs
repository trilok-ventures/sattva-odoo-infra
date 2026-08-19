#!/usr/bin/env node
/**
 * Policy checks for the Phase 3a Compose-on-VM stack.
 * Does not start containers. Fails if T2 mTLS, host-published app ports,
 * or Keycloak/upload vhosts sneak in.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));
const compose = readFileSync(join(ROOT, "docker-compose.prod.yml"), "utf8");
const caddy = readFileSync(join(ROOT, "Caddyfile"), "utf8");
const envExample = readFileSync(join(ROOT, ".env.example"), "utf8");
const errors = [];

function fail(msg) {
  errors.push(msg);
}

const forbiddenTls = "client" + "_" + "auth";
const forbiddenCa = "Private" + "CA";
const forbiddenMesh = "cloud.google.com/service" + "-" + "mesh";
if (
  compose.includes(forbiddenTls) ||
  caddy.includes(forbiddenTls) ||
  (compose + caddy).includes(forbiddenCa) ||
  (compose + caddy).includes(forbiddenMesh)
) {
  fail("T2 origin-certificate or mesh markers found in prod compose or Caddyfile");
}

if (!/^n8n-worker:/m.test(compose) && !/^\s+n8n-worker:/m.test(compose)) {
  fail("n8n-worker service missing");
}

const workerBlock = compose.split(/\n  n8n-worker:\n/)[1]?.split(/\n  [a-z]/)[0] || "";
if (/^\s+ports:/m.test(workerBlock)) {
  fail("n8n-worker must not publish host ports");
}

for (const svc of ["db", "web", "redis", "n8n", "nextcloud"]) {
  const re = new RegExp(`\\n  ${svc}:\\n([\\s\\S]*?)(?=\\n  [a-z]|\\nnetworks:)`);
  const block = compose.match(re)?.[1] || "";
  if (/^\s+ports:/m.test(block)) {
    fail(`${svc} must not publish host ports (Caddy is the only ingress)`);
  }
}

const caddyBlock = compose.match(/\n  caddy:\n([\s\S]*?)(?=\nnetworks:)/)?.[1] || "";
if (!/^\s+ports:/m.test(caddyBlock) || !caddyBlock.includes('"80:80"') || !caddyBlock.includes('"443:443"')) {
  fail("caddy must publish host 80/443");
}
if (!compose.includes("DB_TYPE: postgresdb")) {
  fail("n8n must use Postgres for queue mode");
}
if (!/db:[\s\S]*N8N_DB_PASSWORD:/.test(compose)) {
  fail("postgres init must receive N8N_DB_PASSWORD");
}
if (!compose.includes('command: ["worker"]')) {
  fail("n8n-worker must run command [\"worker\"]");
}
if (!compose.includes("../../n8n/workflows:/workflows:ro")) {
  fail("n8n editor must mount committed workflows for git import");
}

const backup = readFileSync(join(ROOT, "../gcp/backup-to-gcs.sh"), "utf8");
if (/nextcloud-data|occ files:scan|tar .*nextcloud/i.test(backup)) {
  fail("backup-to-gcs.sh must not copy Nextcloud RED to the non-WORM bucket");
}

for (const host of [
  "sattva.trilokventures.org",
  "vault.trilokventures.org",
  "n8n.trilokventures.org",
]) {
  if (!caddy.includes(host)) fail(`Caddyfile missing ${host}`);
}

if (!caddy.includes("/web/database")) {
  fail("Caddyfile must block /web/database");
}

if (/upload\.trilokventures\.org/.test(caddy) && !caddy.includes("# upload.")) {
  fail("upload. vhost must stay out of this Phase 3a Caddyfile");
}

if (/auth\.trilokventures\.org/.test(caddy)) {
  fail("Keycloak auth. vhost is out of this Phase 3a slice");
}

if (/NEXT_PUBLIC_/.test(envExample + compose)) {
  fail("NEXT_PUBLIC_ fabric URLs are forbidden");
}

if (/sattva_db_secure_pass|ArchAdmin925/.test(envExample + compose + caddy)) {
  fail("literal local/dev secret leaked into prod files");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("prod compose/Caddy policy checks passed");
