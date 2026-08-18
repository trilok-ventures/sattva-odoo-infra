#!/usr/bin/env node
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (!files.length) throw new Error("usage: validate-workflows.mjs <workflow.json...>");

for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (text.includes('saveDataSuccessExecution":"all"') || text.includes('saveDataSuccessExecution": "all"')) {
    throw new Error(`${file}: saveDataSuccessExecution all is forbidden`);
  }
  if (text.includes('saveDataErrorExecution":"all"') || text.includes('saveDataErrorExecution": "all"')) {
    throw new Error(`${file}: saveDataErrorExecution all is forbidden`);
  }
  const wf = JSON.parse(text);
  if (typeof wf.id !== "string" || !wf.id) {
    throw new Error(`${file}: top-level id string required`);
  }
  if (wf.settings?.saveDataSuccessExecution !== "none") {
    throw new Error(`${file}: settings.saveDataSuccessExecution must be none`);
  }
  if (wf.settings?.saveDataErrorExecution !== "none") {
    throw new Error(`${file}: settings.saveDataErrorExecution must be none`);
  }
  if (!Array.isArray(wf.nodes) || wf.nodes.length === 0) {
    throw new Error(`${file}: nodes required`);
  }
  if (text.includes("odooN8nFabric.apiKey")) {
    throw new Error(`${file}: httpHeaderAuth must use credential value, not apiKey`);
  }
  for (const node of wf.nodes) {
    if (!node.id || !node.type || !node.name) {
      throw new Error(`${file}: node missing id/type/name`);
    }
    if (node.credentials?.httpHeaderAuth) {
      if (
        node.parameters?.authentication !== "genericCredentialType" ||
        node.parameters?.genericAuthType !== "httpHeaderAuth"
      ) {
        throw new Error(`${file}: ${node.name} must bind httpHeaderAuth`);
      }
    }
  }
  if (wf.nodes.some((node) => node.type === "n8n-nodes-base.webhook")) {
    const code = wf.nodes
      .filter((node) => node.type === "n8n-nodes-base.code")
      .map((node) => node.parameters?.jsCode || "")
      .join("\n");
    if (
      !code.includes("x-sattva-webhook-hmac") ||
      !code.includes("N8N_WEBHOOK_HMAC") ||
      !code.includes("body ??")
    ) {
      throw new Error(`${file}: webhook envelope and HMAC check required`);
    }
  }
  if (
    wf.name === "wf.supplier.folder" ||
    wf.name === "wf.buyer.onboard.folder"
  ) {
    const bodies = wf.nodes
      .map((node) => node.parameters?.jsonBody || "")
      .join("\n");
    const code = wf.nodes
      .map((node) => node.parameters?.jsCode || "")
      .join("\n");
    if (!bodies.includes('search_read",[[[')) {
      throw new Error(`${file}: search_read domain must be one positional argument`);
    }
    if (
      !code.includes("prefix_path") ||
      !code.includes("status === 405") ||
      !code.includes("status === 409")
    ) {
      throw new Error(`${file}: idempotent parent MKCOL walk required`);
    }
  }
  if (wf.name === "wf.coa.verify") {
    const code = wf.nodes
      .map((node) => node.parameters?.jsCode || "")
      .join("\n");
    if (
      code.includes("Boolean(") ||
      !code.includes("assertNoForbidden(child)") ||
      !code.includes("Number.isFinite") ||
      !code.includes("typeof b.mesh_pass !== 'boolean'") ||
      !code.includes("^[a-f0-9]{64}$")
    ) {
      throw new Error(`${file}: COA comparison must validate recursively and fail closed`);
    }
  }
  if (
    wf.name === "wf.lead.score" &&
    !text.includes("sattva.fabric.leadscore")
  ) {
    throw new Error(`${file}: lead score must use the narrow Odoo helper`);
  }
}
console.log("workflow validation passed");
