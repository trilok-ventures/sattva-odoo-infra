#!/usr/bin/env node
/**
 * Policy checks for Phase 3a T1 SoR init scripts.
 * Does not start containers and does not print secrets.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));
const errors = [];
const fail = (msg) => errors.push(msg);

const odoo = readFileSync(join(ROOT, "init-odoo-sor.sh"), "utf8");
const nc = readFileSync(join(ROOT, "seed-nextcloud-vault-trees.sh"), "utf8");
const n8n = readFileSync(join(ROOT, "init-n8n-fabric.sh"), "utf8");
const orch = readFileSync(join(ROOT, "init-sor.sh"), "utf8");
const purge = readFileSync(join(ROOT, "purge-odoo-demo.sh"), "utf8");
const reset = readFileSync(join(ROOT, "reset-odoo-empty.sh"), "utf8");
const fetchSecrets = readFileSync(join(ROOT, "fetch-secrets.sh"), "utf8");
const spec = readFileSync(
  join(ROOT, "../../docs/superpowers/specs/2026-08-23-phase3a-t1-sor-init.md"),
  "utf8",
);
const all = odoo + nc + n8n + orch;

for (const name of [
  "Riverbank Organic Farm",
  "Example Foods",
  "P00042",
  "SO-1042",
  "middleware.bff",
  "auth.trilokventures.org",
  "button_confirm",
]) {
  if (all.includes(name)) fail(`init scripts must not mention ${name}`);
}

if (!odoo.includes("supplier_rank") || !odoo.includes("warning_existing_counterparties")) {
  fail("Odoo init must detect existing counterparties, not create them");
}
if (odoo.includes("Partner.create") || odoo.includes('["res.partner"].create')) {
  fail("Odoo init must not create partners");
}
if (/-i[^\n]*website/.test(odoo) || /-i[^\n]*auth_oauth/.test(odoo)) {
  fail("Odoo init must not install website or auth_oauth");
}
if (odoo.includes("purchase.order") && odoo.includes(".create(")) {
  fail("Odoo init must not create purchase orders");
}
if (/\["account\.move"\]\.create/.test(odoo) || /account\.move["']\]\.create/.test(odoo)) {
  fail("Odoo init must not create account.move");
}
if (odoo.includes("button_draft") || odoo.includes("button_cancel")) {
  fail("Odoo init must not mutate account.move (count-only CAD skip is allowed)");
}
if (!odoo.includes("Sattva Brokers") || !odoo.includes("base.ca") || !odoo.includes("base.CAD")) {
  fail("Odoo init must set company Sattva Brokers / CA / CAD");
}
if (!odoo.includes("warning_skip_cad_posted_moves")) {
  fail("Odoo init must skip CAD when posted account.move rows exist");
}
if (!odoo.includes("Discovery") || !odoo.includes("Compliance Review") || !odoo.includes("Retention")) {
  fail("Odoo init must create fabric CRM stages");
}
if (odoo.includes('"active": True') || odoo.includes('"active": False')) {
  fail("crm.stage has no active field on Odoo 18; unlink unused leftovers");
}
if (!odoo.includes("n8n.fabric") || !odoo.includes("group_n8n_fabric_service")) {
  fail("Odoo init must create n8n.fabric with the fabric service group");
}
if (!odoo.includes('uid 2 as n8n.fabric') && !odoo.includes("reuse uid 2")) {
  fail("Odoo init must refuse uid 2 as n8n.fabric");
}
if (!odoo.includes("website") || !odoo.includes("auth_oauth")) {
  fail("Odoo init must refuse website/auth_oauth");
}
if (!odoo.includes("--with-ca-coa") || !odoo.includes("l10n_ca")) {
  fail("CA CoA must be an explicit flag, not default");
}
if (!/odoo -d sattva -i[\s\S]*--stop-after-init --no-http/.test(odoo)) {
  fail("extra module install inside the running web container must pass --no-http");
}

if (!nc.includes("PCP/Supplier_Audits") || !nc.includes("PCP/Retention_Logs")) {
  fail("Nextcloud seed must include the fabric §5.3 PCP trees");
}
if (!nc.includes("n8n.vault") || !nc.includes("admin")) {
  fail("Nextcloud seed must cover admin and n8n.vault");
}
if (!nc.includes("shareapi_allow_links") || !nc.includes("shareapi_allow_public_upload")) {
  fail("Nextcloud seed must disable public shares");
}
if (nc.includes("curl") || nc.includes("files:upload") || nc.includes("COA.pdf")) {
  fail("Nextcloud seed must not upload COA or other files");
}
if (!nc.includes("Nextcloud Manual.pdf") || !nc.includes("rm -f")) {
  fail("Nextcloud seed must remove known welcome files, not upload them");
}
if (!nc.includes("welcome_dirs") || !nc.includes("Documents") || !nc.includes("Photos") || !nc.includes("Templates")) {
  fail("Nextcloud seed must remove first-run Documents/Photos/Templates folders");
}
if (/rm -rf "\$\{root\}\/PCP"/.test(nc) || nc.includes('rm -rf "${root}/Suppliers"')) {
  fail("Nextcloud seed must not delete Sattva PCP/Suppliers/Clients trees");
}

if (!n8n.includes("import:workflow") || !n8n.includes("wf.coa.verify.json")) {
  fail("n8n init must import committed wf.*.json");
}
if (!n8n.includes("wf.coa.ocr.json") || !n8n.includes("wf-coa-ocr")) {
  fail("n8n init must import and activate GREEN COA OCR (wf.coa.ocr)");
}
if (!n8n.includes("odooN8nFabric") || !n8n.includes("nextcloudN8nVault")) {
  fail("n8n init must create the named credentials");
}
if (!n8n.includes("mktemp") || !n8n.includes("rm -f")) {
  fail("n8n init must shred rendered credential files");
}
if (n8n.includes("nextcloud-admin-password")) {
  fail("n8n must not copy the Nextcloud admin password");
}

if (!orch.includes("refusing Keycloak") || !orch.includes("--keycloak")) {
  fail("orchestrator must refuse Keycloak flags");
}
if (!orch.includes("init-odoo-sor.sh") || !orch.includes("seed-nextcloud-vault-trees.sh")) {
  fail("orchestrator must run Odoo then Nextcloud slices");
}
if (!orch.includes("FABRIC_MODE=live")) {
  fail("orchestrator must remind that BFF live stays off");
}
if (!orch.includes("--purge-odoo-demo") || !orch.includes("purge-odoo-demo.sh")) {
  fail("orchestrator must optionally run the furniture demo purge");
}
if (!orch.includes("--reset-odoo-empty") || !orch.includes("reset-odoo-empty.sh")) {
  fail("orchestrator must optionally recreate an empty sattva database");
}
if (orch.includes("seed-training-counterparties")) {
  fail("orchestrator must not auto-seed TRAINING counterparties");
}
if (!orch.includes("refusing both --reset-odoo-empty and --purge-odoo-demo")) {
  fail("orchestrator must not reset and purge in the same run");
}
if (!orch.includes("--apply is only valid with --reset-odoo-empty or --purge-odoo-demo")) {
  fail("orchestrator must not apply without reset or purge");
}

if (!reset.includes("--without-demo=all") || !reset.includes("sattva_compliance")) {
  fail("empty reset must reinstall the addon without demo");
}
if (!reset.includes("dropdb") || !reset.includes("createdb")) {
  fail("empty reset must drop and recreate only the sattva database");
}
if (!reset.includes("n8n") || !reset.includes("not n8n")) {
  fail("empty reset must keep the n8n database");
}
if (reset.includes("dropdb") && /dropdb[^\n]*n8n/.test(reset)) {
  fail("empty reset must not dropdb n8n");
}
if (!reset.includes("website") || !reset.includes("stock") || !reset.includes("l10n_us")) {
  fail("empty reset must list modules it refuses to reinstall");
}
if (!reset.includes("pg_dump") || !reset.includes("set-operator-admin-email") || !reset.includes("recreate-odoo-web")) {
  fail("empty reset must dump, rebind the operator, and recreate web");
}
if (reset.includes("Riverbank Organic Farm") || reset.includes("Example Foods")) {
  fail("empty reset must not seed synthetic counterparties");
}
if (reset.includes("init-odoo-sor.sh --with-sales")) {
  fail("empty reset already installs sale_management; do not re-install it on the bound web port");
}

if (!purge.includes("--apply") || !purge.includes("dry-run")) {
  fail("purge script must default to dry-run and require --apply");
}
if (!purge.includes("pg_dump") || !purge.includes("PURGE_ODOO_DEMO_BACKUP_ACK")) {
  fail("purge --apply must require a sattva pg_dump (or an explicit backup ack)");
}
for (const name of [
  "Riverbank Organic Farm",
  "Example Foods",
  "P00042",
  "SO-1042",
]) {
  if (!purge.includes(name)) fail(`purge script must refuse ${name}`);
}
for (const name of [
  "Azure Interior",
  "Acme Corporation",
  "Gemini Furniture",
  "Wood Corner",
  "Ready Mat",
  "Lumber Inc",
  "OpenWood",
  "The Jackson Group",
]) {
  if (!purge.includes(name)) fail(`purge script must match known Odoo demo name ${name}`);
}
if (!purge.includes("res_partner_") || !purge.includes("partner_demo") || !purge.includes("crm_case_")) {
  fail("purge script must select demo xmlids, not a wipe of all partners");
}
if (!purge.includes("n8n.fabric") || !purge.includes("partner_root") || !purge.includes("(1, 2)")) {
  fail("purge script must protect uid 2, n8n.fabric, and OdooBot");
}
if (purge.includes('child_of", company.partner_id') || purge.includes("child_of', company.partner_id")) {
  fail("purge must not select every child of the company partner");
}
if (!purge.includes("button_confirm") && purge.includes("button_cancel")) {
  // cancel is required; confirm must stay absent
} else if (purge.includes("button_confirm")) {
  fail("purge script must not confirm a PO");
}
if (!purge.includes("button_cancel")) {
  fail("purge script must cancel demo POs");
}

if (!spec.includes("Do not create synthetic") && !spec.includes("synthetic suppliers")) {
  fail("spec must forbid synthetic production counterparties");
}
if (!spec.includes("Keycloak")) {
  fail("spec must address Keycloak as blocked");
}
if (!fetchSecrets.includes("ODOO_N8N_UID") || !fetchSecrets.includes("Do not use 2")) {
  fail("fetch-secrets must keep ODOO_N8N_UID and refuse uid 2 as the fabric user");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("SoR init policy checks passed");
