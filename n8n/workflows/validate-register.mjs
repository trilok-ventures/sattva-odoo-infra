#!/usr/bin/env node
import { readFileSync } from "node:fs";

const REQUIRED = [
  "id",
  "caller",
  "callee",
  "hostname",
  "ingress",
  "tls_rung",
  "access_policy",
  "data_class",
  "sor",
  "phase",
];
const ALLOWED_IDS = new Set([
  "svc.portal.odoo",
  "svc.portal.n8n",
  "svc.n8n.fabric",
  "svc.n8n.vault",
  "svc.upload.origin",
  "svc.leadscore.green",
  "svc.catalogue.green",
  "svc.notify.cache",
  "svc.kc.oidc",
]);
const FORBIDDEN_IDS = new Set(["svc.portal.nc"]);

const register = JSON.parse(readFileSync(new URL("./service-register.json", import.meta.url)));
const ids = new Set();
for (const row of register.services) {
  for (const key of REQUIRED) {
    if (!row[key] || String(row[key]).trim() === "") {
      throw new Error(`missing ${key} on ${row.id || "?"}`);
    }
  }
  if (FORBIDDEN_IDS.has(row.id)) throw new Error("svc.portal.nc is forbidden");
  if (!ALLOWED_IDS.has(row.id)) throw new Error(`unknown id ${row.id}`);
  if (ids.has(row.id)) throw new Error(`duplicate ${row.id}`);
  ids.add(row.id);
  if (row.id === "svc.portal.odoo" && /nextcloud|webdav/i.test(JSON.stringify(row))) {
    throw new Error("BFF Odoo row must not mention Nextcloud");
  }
  if (row.id === "svc.upload.origin" && /vercel/i.test(row.hostname)) {
    throw new Error("upload origin must not be Vercel");
  }
  if (row.id === "svc.leadscore.green") {
    if (!String(row.callee).includes("leadscore.mjs")) {
      throw new Error("svc.leadscore.green callee must be local leadscore.mjs until HF plan");
    }
    if (/huggingface\.co/i.test(row.callee)) {
      throw new Error("svc.leadscore.green must not call huggingface.co in this plan");
    }
  }
  if (row.id === "svc.portal.n8n" && !/AMBER metadata/i.test(row.data_class)) {
    throw new Error("svc.portal.n8n data_class must be AMBER metadata");
  }
  if (row.id === "svc.kc.oidc" && String(row.phase) !== "3") {
    throw new Error("svc.kc.oidc phase must be 3");
  }
}
for (const id of ALLOWED_IDS) {
  if (!ids.has(id)) throw new Error(`missing ${id}`);
}
console.log("service-register validation passed");
