#!/usr/bin/env node
/**
 * Dry-run (default) or POST Path B Access apps.
 * Never logs CF_API_TOKEN. Always sends allow_authenticate_via_warp: false.
 *
 *   CF_ACCESS_IT_EMAILS=archneo@trilokventures.org node deploy/gcp/create-access-apps.mjs
 *   CF_API_TOKEN=… CF_ACCOUNT_ID=… node deploy/gcp/create-access-apps.mjs --apply
 */
import { buildAccessApps } from "./access-apps.mjs";

const apply = process.argv.includes("--apply");
const apps = buildAccessApps();

function summarize(app) {
  return {
    name: app.name,
    domain: app.domain,
    destinations: app.destinations.map((d) => d.uri),
    allow_authenticate_via_warp: app.allow_authenticate_via_warp,
    policies: app.policies.map((p) => p.decision),
  };
}

console.log(JSON.stringify(apps.map(summarize), null, 2));

if (!apply) {
  console.log("dry-run; pass --apply with CF_API_TOKEN and CF_ACCOUNT_ID to POST");
  process.exit(0);
}

const token = process.env.CF_API_TOKEN;
const accountId = process.env.CF_ACCOUNT_ID;
if (!token || !accountId) {
  console.error("CF_API_TOKEN and CF_ACCOUNT_ID are required for --apply");
  process.exit(1);
}

const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps`;

for (const app of apps) {
  const res = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(app),
  });
  const body = await res.json();
  if (!body.success) {
    const msg = (body.errors || []).map((e) => e.message).join("; ") || res.status;
    console.error(`failed to create ${app.name}: ${msg}`);
    process.exit(1);
  }
  console.log(`created ${app.name} id=${body.result?.id || "unknown"}`);
}
