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
  "svc.lead.inbound",
  "svc.dossier.index",
  "svc.coa.ocr.green",
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
  if (row.id === "svc.coa.ocr.green") {
    const blob = JSON.stringify(row);
    if (!/GREEN/i.test(blob)) {
      throw new Error("svc.coa.ocr.green must be GREEN-only (no source PDF to Hugging Face)");
    }
    if (!blob.includes("apply_coa_green") || !blob.includes("coa-ocr")) {
      throw new Error("svc.coa.ocr.green must persist via apply_coa_green after POST /webhook/coa-ocr");
    }
    if (!/never PDFs/i.test(blob) || !/keeps the PDF/i.test(blob)) {
      throw new Error("svc.coa.ocr.green must keep the source PDF in Nextcloud and never send PDFs to HF");
    }
    if (!/No WebDAV GET/i.test(row.access_policy)) {
      throw new Error("svc.coa.ocr.green must forbid WebDAV GET of CoA PDFs");
    }
    if (/action_release/.test(blob) || /PROPFIND/.test(blob)) {
      throw new Error("svc.coa.ocr.green must not list vault files or release lots");
    }
  }
  if (row.id === "svc.dossier.index") {
    const blob = JSON.stringify(row);
    if (!/apply_index/i.test(blob) || /button_confirm|action_release/i.test(blob)) {
      throw new Error("svc.dossier.index must persist via apply_index and must not confirm or release");
    }
    if (/vercel|huggingface/i.test(blob)) {
      throw new Error("svc.dossier.index must not send vault bytes to Vercel or HF");
    }
  }
  if (row.id === "svc.lead.inbound") {
    const blob = JSON.stringify(row);
    if (!blob.includes("N8N_LEAD_INBOUND_HMAC")) {
      throw new Error("svc.lead.inbound must use dedicated N8N_LEAD_INBOUND_HMAC");
    }
    if (!blob.includes("/webhook/lead-inbound")) {
      throw new Error("svc.lead.inbound ingress must be /webhook/lead-inbound");
    }
  }
}
for (const id of ALLOWED_IDS) {
  if (!ids.has(id)) throw new Error(`missing ${id}`);
}
console.log("service-register validation passed");
