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
  if (/"button_confirm"|"action_confirm"/.test(text)) {
    throw new Error(`${file}: n8n must not call button_confirm or action_confirm`);
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
    wf.name === "wf.buyer.onboard.folder" ||
    wf.name === "wf.order.folder"
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
  if (wf.name === "wf.order.folder" && !text.includes("set_order_path")) {
    throw new Error(`${file}: order folder must persist via sattva.fabric.vault.set_order_path`);
  }
  if (wf.name === "wf.coa.verify") {
    if (wf.connections && wf.connections["Nextcloud COA webhook"]) {
      throw new Error(`${file}: Nextcloud COA webhook must not connect to the GREEN persist path`);
    }
    if (
      text.includes("action_release") ||
      text.includes("stock.lot") ||
      text.includes("button_confirm")
    ) {
      throw new Error(`${file}: COA workflow must not release lots, touch stock.lot, or confirm orders`);
    }
    const code = wf.nodes
      .map((node) => node.parameters?.jsCode || "")
      .join("\n");
    if (
      code.includes("Boolean(") ||
      !code.includes("COA_GREEN_ALLOWLIST") ||
      !code.includes("unknown COA key forbidden") ||
      !code.includes("Number.isFinite") ||
      !code.includes("typeof b.mesh_pass !== 'boolean'") ||
      !code.includes("typeof b.salmonella_absent !== 'boolean'") ||
      !code.includes("typeof b.tpc_cfu !== 'number'") ||
      !code.includes("typeof b.pyruvic_umol !== 'number'") ||
      !code.includes("^[a-f0-9]{64}$") ||
      !code.includes("!b.spec_mesh_required || b.mesh_pass") ||
      !code.includes("!b.spec_salmonella_required || b.salmonella_absent") ||
      !code.includes("b.tpc_cfu <= b.spec_tpc_max") ||
      !code.includes("!b.spec_pyruvic_required || b.pyruvic_umol >= b.spec_pyruvic_min")
    ) {
      throw new Error(`${file}: COA comparison must allowlist keys, validate, and treat mesh as implication`);
    }
    if (!text.includes("sattva.fabric.lot") || !text.includes("apply_coa_green")) {
      throw new Error(`${file}: COA compare must persist via sattva.fabric.lot.apply_coa_green`);
    }
    if (
      !text.includes("JSON.stringify($json.filename)") ||
      !text.includes("JSON.stringify($json.sha256)")
    ) {
      throw new Error(`${file}: persist body must JSON.stringify filename and sha256`);
    }
  }
  if (
    wf.name === "wf.lead.score" &&
    !text.includes("sattva.fabric.leadscore")
  ) {
    throw new Error(`${file}: lead score must use the narrow Odoo helper`);
  }
  if (wf.name === "wf.lead.inbound") {
    const code = wf.nodes
      .map((node) => node.parameters?.jsCode || "")
      .join("\n");
    if (
      !code.includes("INBOUND_LEAD_ALLOWLIST") ||
      !code.includes("unknown inbound lead key forbidden") ||
      !code.includes("hashed_partner_id") ||
      !text.includes("sattva.fabric.lead.ingest") ||
      !text.includes("create_inbound") ||
      !text.includes("sattva.fabric.leadscore") ||
      !text.includes("JSON.stringify($json.work_email)") ||
      /keycloak/i.test(text)
    ) {
      throw new Error(`${file}: inbound lead must HMAC-allowlist, create_inbound, score GREEN, and skip Keycloak`);
    }
  }
}
console.log("workflow validation passed");
