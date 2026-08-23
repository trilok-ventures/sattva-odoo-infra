#!/usr/bin/env node
/**
 * Policy checks for the TRAINING counterparty seed.
 * Does not start containers and does not print secrets.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));
const errors = [];
const fail = (msg) => errors.push(msg);

const seed = readFileSync(join(ROOT, "seed-training-counterparties.sh"), "utf8");
const orch = readFileSync(join(ROOT, "init-sor.sh"), "utf8");
const spec = readFileSync(
  join(ROOT, "../../docs/superpowers/specs/2026-08-23-sattva-training-counterparties.md"),
  "utf8",
);

for (const name of [
  "Riverbank Organic Farm",
  "Example Foods",
  "P00042",
  "SO-1042",
]) {
  if (!seed.includes(name)) fail(`seed must refuse leftover name ${name}`);
}

if (!seed.includes("TRAINING Onion Packhouse") || !seed.includes("TRAINING Canadian Buyer")) {
  fail("seed must use the labeled TRAINING partner names");
}
if (!seed.includes("planned_pcp=pending") || !seed.includes('supplier_pcp_status != "pending"')) {
  fail("seed must keep supplier PCP pending");
}
if (seed.includes('"approved"') || seed.includes("supplier_pcp_status = 'approved'")) {
  fail("seed must not write PCP approved");
}
if (seed.includes("haccp_certified") && /haccp_certified.*=.*True/.test(seed)) {
  fail("seed must not set HACCP true");
}
if (!seed.includes("buyer_kyc_status") || !seed.includes("refusing to keep non-pending KYC")) {
  fail("seed must keep buyer KYC pending");
}
if (seed.includes("set_partner_path") && seed.includes("env[\"sattva.fabric.vault\"]")) {
  fail("seed must not call set_partner_path; n8n writes vault paths");
}
if (seed.includes("button_confirm") && !seed.includes("cr.rollback()")) {
  fail("PCP probe must roll back so no PO is kept");
}
if (!seed.includes("wf.supplier.folder") || !seed.includes("nextcloud_folder_path")) {
  fail("seed must wait for n8n folder cron, not impersonate set_partner_path");
}
if (seed.includes("n8n execute")) {
  fail("n8n execute collides with the running editor; wait for the 5-minute poll");
}
if (seed.includes("coa-verify") || seed.includes("create_po_intent")) {
  fail("seed must not call COA verify or create_po_intent");
}
if (orch.includes("seed-training-counterparties")) {
  fail("init-sor must not auto-seed TRAINING counterparties");
}
if (!spec.includes("pending") || !spec.includes("n8n is the only folder writer")) {
  fail("training spec must keep pending PCP and n8n MKCOL");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Training counterparty policy checks passed");
