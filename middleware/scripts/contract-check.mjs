#!/usr/bin/env node
/**
 * GREEN contract check: RED keys must never appear in BFF JSON.
 * HTTP checks run when SATTVA_BFF_URL is set (or default localhost:3010 if up).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RED = new Set(
  JSON.parse(readFileSync(join(root, "src/lib/red-keys.json"), "utf8")).map((k) =>
    String(k).toLowerCase(),
  ),
);

let failed = 0;

function walk(value, trail, hits) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${trail}[${i}]`, hits));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const next = `${trail}.${key}`;
      if (RED.has(key.toLowerCase())) hits.push(next);
      walk(child, next, hits);
    }
  }
}

function assert(name, cond, detail) {
  if (cond) {
    console.log("OK", name);
    return;
  }
  failed += 1;
  console.error("FAIL", name, detail || "");
}

function strip(value) {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (RED.has(key.toLowerCase())) continue;
      out[key] = strip(child);
    }
    return out;
  }
  return value;
}

const dirty = {
  moisture_pct: 4.8,
  path: "/Suppliers/Example/COA.pdf",
  checksum_sha256: "deadbeef",
  password: "secret",
  coa_sha256: "abc",
};
const clean = strip(dirty);
assert("strip drops path", clean.path === undefined);
assert("strip drops password", clean.password === undefined);
assert("strip drops checksum_sha256", clean.checksum_sha256 === undefined);
assert("strip keeps GREEN moisture", clean.moisture_pct === 4.8);
assert("strip keeps GREEN coa_sha256", clean.coa_sha256 === "abc");

const hits = [];
walk(clean, "$", hits);
assert("clean object has no RED keys", hits.length === 0, hits.join(","));

const graphSrc = readFileSync(join(root, "src/lib/screen-graph.ts"), "utf8");
assert("graph has S1 path /", graphSrc.includes('S1: "/"') || graphSrc.includes("S1: '/'"));
assert("employee flow starts S1", graphSrc.includes("employee:") && graphSrc.includes('"/e4"'));
assert("buyer flow has /b3", graphSrc.includes('"/b3"'));
assert("seller flow has /p2/receipt", graphSrc.includes('"/p2/receipt"'));
assert("no /map production route", !graphSrc.includes('"/map"'));
assert("nextInFlow uses indexOf", graphSrc.includes("steps.indexOf"));
assert("nextInFlow does not use lastIndexOf", !graphSrc.includes("lastIndexOf"));

const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
assert("nav token", css.includes("#143528"));
assert("sand token", css.includes("#f7f4ef"));
assert("forest token", css.includes("#1f4d3a"));

const chromeSrc = readFileSync(join(root, "src/app/components/Chrome.tsx"), "utf8");
const buyerNavMatch = chromeSrc.match(/BUYER_NAV\s*=\s*\[([\s\S]*?)\];/);
assert(
  "buyer nav excludes vault",
  buyerNavMatch && !buyerNavMatch[1].includes("vault"),
  "BUYER_NAV must not reference vault",
);
assert(
  "buyer nav excludes n8n",
  buyerNavMatch && !buyerNavMatch[1].includes("n8n"),
  "BUYER_NAV must not reference n8n",
);

const httpSrc = readFileSync(join(root, "src/lib/http.ts"), "utf8");
assert(
  "live mode refuses persona header",
  httpSrc.includes('mode === "live"') && httpSrc.includes("Keycloak session required"),
);

const rootVercel = JSON.parse(readFileSync(join(root, "../vercel.json"), "utf8"));
assert(
  "root vercel.json still publishes mocks only",
  rootVercel.outputDirectory === "docs/superpowers/mocks",
);

assert(
  "e4 page source has no Confirm anyway",
  !readFileSync(join(root, "src/app/e4/page.tsx"), "utf8").includes("Confirm anyway"),
);

const e2 = readFileSync(join(root, "src/app/e2/page.tsx"), "utf8");
assert(
  "e2 handles forbidden queue without throw",
  !e2.includes("throw new Error") && e2.includes("!res.ok"),
);
assert(
  "gate dialog has no anyway",
  !readFileSync(join(root, "src/app/components/GateDialog.tsx"), "utf8").includes("anyway"),
);

const e3 = readFileSync(join(root, "src/app/e3/page.tsx"), "utf8");
assert(
  "e3 hides P00042 for it persona",
  /persona\s*!==\s*["']it["']\s*\?[\s\S]*P00042/.test(e3),
);

const s3 = readFileSync(join(root, "src/app/s3/page.tsx"), "utf8");
assert("s3 uses activities API", s3.includes("/api/activities"));
assert("s3 not a second SoR table", !s3.includes("localStorage"));

for (const f of ["b1/page.tsx", "b2/[id]/page.tsx", "b3/page.tsx"]) {
  const t = readFileSync(join(root, "src/app", f), "utf8");
  assert("buyer chrome no vault " + f, !t.includes("vault."));
  assert("buyer chrome no n8n " + f, !t.includes("n8n."));
}

const base = process.env.SATTVA_BFF_URL || "http://127.0.0.1:3010";

async function httpJson(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const res = await fetch(base + path, { ...opts, headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { _raw: text };
  }
  return { res, body };
}

try {
  const health = await httpJson("/api/health");
  assert("health 200", health.res.status === 200, String(health.res.status));
  assert("health mock mode", health.body.fabric?.mode === "mock", JSON.stringify(health.body.fabric));
  const healthText = JSON.stringify(health.body);
  assert("health has no fabric hostnames", !healthText.includes("trilokventures.org"));
  assert("health has no urls", !healthText.includes("http"));

  const dash = await httpJson("/api/dashboard", { headers: { "x-sattva-persona": "sales" } });
  assert("dashboard 200", dash.res.status === 200);
  const dashHits = [];
  walk(dash.body, "$", dashHits);
  assert("dashboard GREEN", dashHits.length === 0, dashHits.join(","));
  assert("sales has no unpaid_invoices", dash.body.unpaid_invoices === undefined);

  const fin = await httpJson("/api/dashboard", { headers: { "x-sattva-persona": "finance" } });
  assert("finance sees invoices kpi", typeof fin.body.unpaid_invoices === "number");

  const blocked = await httpJson("/api/purchase/orders/p00042/confirm", {
    method: "POST",
    headers: { "x-sattva-persona": "sales" },
  });
  assert("confirm pending is 409", blocked.res.status === 409, String(blocked.res.status));
  assert("title gate", blocked.body.title === "Compliance Gate Blocked");
  assert("no confirm anyway flag", blocked.body.confirm_anyway === false);

  const ok = await httpJson("/api/purchase/orders/p00041/confirm", {
    method: "POST",
    headers: { "x-sattva-persona": "sales" },
  });
  assert("approved confirm 200", ok.res.status === 200, String(ok.res.status));
  assert("state purchase", ok.body.state === "purchase");

  const buyerConfirm = await httpJson("/api/purchase/orders/p00041/confirm", {
    method: "POST",
    headers: { "x-sattva-persona": "buyer" },
  });
  assert("buyer cannot confirm", buyerConfirm.res.status === 403, String(buyerConfirm.res.status));

  const buyerLots = await httpJson("/api/lots", { headers: { "x-sattva-persona": "buyer" } });
  const lotHits = [];
  walk(buyerLots.body, "$", lotHits);
  assert("buyer lots GREEN", lotHits.length === 0, lotHits.join(","));
  assert("buyer sees SO-1042 lot", Array.isArray(buyerLots.body.lots) && buyerLots.body.lots.length === 1);

  const badDoc = await httpJson("/api/documents", {
    method: "POST",
    headers: { "x-sattva-persona": "supplier", "content-type": "application/json" },
    body: JSON.stringify({
      filename: "coa.pdf",
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      path: "/Suppliers/Other/secret.pdf",
    }),
  });
  assert("upload rejects client path", badDoc.res.status === 400);

  for (const extraKey of [
    "bytes",
    "pdf",
    "path",
    "file_bytes",
    "nextcloud_folder_path",
    "unexpected",
  ]) {
    const extraMetadata = await httpJson("/api/documents", {
      method: "POST",
      headers: { "x-sattva-persona": "supplier", "content-type": "application/json" },
      body: JSON.stringify({
        filename: "coa.pdf",
        sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        [extraKey]: extraKey === "path" ? "" : "forbidden",
      }),
    });
    assert(
      `upload rejects extra key ${extraKey}`,
      extraMetadata.res.status >= 400 && extraMetadata.res.status < 500,
      String(extraMetadata.res.status),
    );
  }

  const traversal = await httpJson("/api/documents", {
    method: "POST",
    headers: { "x-sattva-persona": "supplier", "content-type": "application/json" },
    body: JSON.stringify({
      filename: "../secret.pdf",
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }),
  });
  assert("upload rejects traversal filename", traversal.res.status === 400);

  const goodDoc = await httpJson("/api/documents", {
    method: "POST",
    headers: { "x-sattva-persona": "supplier", "content-type": "application/json" },
    body: JSON.stringify({
      filename: "coa.pdf",
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }),
  });
  assert("upload receipt 200", goodDoc.res.status === 200, String(goodDoc.res.status));
  assert("upload returns sha256", goodDoc.body.sha256?.length === 64);
  assert("upload has no path", goodDoc.body.path === undefined);
  const minted = goodDoc.body.upload_url;
  assert(
    "upload_url omitted or origin",
    minted === undefined ||
      (/8091|upload\.trilokventures\.org/.test(minted) &&
        !minted.includes("vercel") &&
        !minted.includes("app.trilokventures.org")),
  );
  assert("health has no nextcloud key", health.body.fabric?.nextcloud === undefined);

  const buyerDoc = await httpJson("/api/documents", {
    method: "POST",
    headers: { "x-sattva-persona": "buyer", "content-type": "application/json" },
    body: JSON.stringify({
      filename: "kyc.pdf",
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }),
  });
  assert("buyer may mint metadata receipt", buyerDoc.res.status === 200);

  if (process.env.UPLOAD_ORIGIN_PUBLIC_URL) {
    assert("local origin mint present", typeof goodDoc.body.upload_url === "string");
    assert("local origin mint host", goodDoc.body.upload_url.startsWith(process.env.UPLOAD_ORIGIN_PUBLIC_URL));
  }

  const live = await fetch(base + "/api/dashboard");
  assert("mock allows missing persona", live.status === 200);

  const bogus = await httpJson("/api/dashboard", { headers: { "x-sattva-persona": "admin" } });
  assert("unknown persona 400", bogus.res.status === 400);

  const act = await httpJson("/api/activities", { headers: { "x-sattva-persona": "sales" } });
  assert("activities 200", act.res.status === 200, String(act.res.status));
  const actHits = [];
  walk(act.body, "$", actHits);
  assert("activities GREEN", actHits.length === 0, actHits.join(","));
  assert("activities are SATTVA prefixed", act.body.activities?.[0]?.summary?.startsWith("SATTVA:"));
  const buyerAct = await httpJson("/api/activities", { headers: { "x-sattva-persona": "buyer" } });
  assert("buyer activities empty", Array.isArray(buyerAct.body.activities) && buyerAct.body.activities.length === 0);

  const cat = await httpJson("/api/catalogue", { headers: { "x-sattva-persona": "buyer" } });
  assert("catalogue 200", cat.res.status === 200);
  const catHits = [];
  walk(cat.body, "$", catHits);
  assert("catalogue GREEN", catHits.length === 0, catHits.join(","));
  assert("catalogue has onion flake", cat.body.cards?.some((c) => c.crop === "onion" && c.format === "flake"));
  assert("catalogue has no price key", cat.body.cards?.every((c) => c.price === undefined && c.list_price === undefined));

  const logi = await httpJson("/api/dashboard", { headers: { "x-sattva-persona": "logistics" } });
  assert("logistics persona 200", logi.res.status === 200, String(logi.res.status));

  assert(
    "invoices 403 sales",
    (await httpJson("/api/invoices", { headers: { "x-sattva-persona": "sales" } })).res.status === 403,
  );
  assert(
    "invoices 200 finance",
    (await httpJson("/api/invoices", { headers: { "x-sattva-persona": "finance" } })).res.status === 200,
  );

  const itLots = await httpJson("/api/lots", { headers: { "x-sattva-persona": "it" } });
  assert("it lots 200", itLots.res.status === 200, String(itLots.res.status));
  assert(
    "it lots omit SO-1042 buyer_order",
    Array.isArray(itLots.body.lots) && itLots.body.lots.every((lot) => lot.buyer_order !== "SO-1042"),
    JSON.stringify(itLots.body.lots),
  );
  const itLotsText = JSON.stringify(itLots.body);
  assert("it lots body has no SO-1042", !itLotsText.includes("SO-1042"), itLotsText);
} catch (err) {
  if (err && (err.code === "ECONNREFUSED" || String(err.cause || err).includes("ECONNREFUSED"))) {
    console.log("SKIP HTTP (BFF not listening on", base + ")");
  } else {
    failed += 1;
    console.error("FAIL HTTP", err);
  }
}

if (failed) {
  console.error(failed, "check(s) failed");
  process.exit(1);
}
console.log("contract-check passed");
