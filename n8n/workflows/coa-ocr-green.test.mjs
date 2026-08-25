import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertGreenCoa,
  classifyWithOptionalHf,
  COA_GREEN_ALLOWLIST,
  HF_GREEN_ALLOWLIST,
  persistFields,
  RED_FORBIDDEN,
  toHfInputs,
} from "./coa-ocr-green.mjs";

const ok = {
  lot_id: 12,
  filename: "coa.pdf",
  sha256: "a".repeat(64),
  moisture_pct: 4.8,
  mesh_pass: true,
  spec_moisture_max: 6,
  spec_mesh_required: true,
  salmonella_absent: true,
  spec_salmonella_required: true,
  tpc_cfu: 1000,
  spec_tpc_max: 100000,
  pyruvic_umol: 42,
  spec_pyruvic_required: true,
  spec_pyruvic_min: 20,
};

assert.doesNotThrow(() => assertGreenCoa(ok));
assert.throws(() => assertGreenCoa({ ...ok, path: "/Suppliers/x/coa.pdf" }), /RED COA key forbidden/);
assert.throws(() => assertGreenCoa({ ...ok, pdf: "bytes" }), /RED COA key forbidden/);
assert.throws(() => assertGreenCoa({ ...ok, file_bytes: "xx" }), /RED COA key forbidden/);
assert.throws(() => assertGreenCoa({ ...ok, nextcloud_folder_path: "/x" }), /RED COA key forbidden/);
assert.throws(() => assertGreenCoa({ ...ok, vault_href: "/x" }), /RED COA key forbidden/);
assert.throws(() => assertGreenCoa({ ...ok, filename: "../coa.pdf" }), /basename/);

const hf = toHfInputs({ ...ok, sha256: "B".repeat(64) });
assert.equal(hf.sha256, "b".repeat(64));
assert.equal("path" in hf, false);
assert.equal("pdf" in hf, false);
assert.equal("file_bytes" in hf, false);
assert.equal("lot_id" in hf, false);
assert.equal("filename" in hf, false);
assert.deepEqual(Object.keys(hf).sort(), [...HF_GREEN_ALLOWLIST].sort());

const local = await classifyWithOptionalHf(ok, {});
assert.equal(local.ocr_source, "local");
assert.deepEqual(persistFields(local).lot_id, 12);
assert.equal("ocr_source" in persistFields(local), false);

let seenUrl = "";
let seenBody = "";
const hfOut = await classifyWithOptionalHf(ok, {
  token: "hf_test",
  model: "Trilok-Ventures/coa-green-extract",
  fetchImpl: async (url, init) => {
    seenUrl = String(url);
    seenBody = String(init.body);
    return {
      ok: true,
      json: async () => ({ ...toHfInputs(ok), moisture_pct: 4.2 }),
    };
  },
});
assert.equal(hfOut.ocr_source, "hf");
assert.equal(hfOut.moisture_pct, 4.2);
assert.equal(hfOut.lot_id, 12);
assert.equal(hfOut.filename, "coa.pdf");
assert.match(seenUrl, /^https:\/\/router\.huggingface\.co\/hf-inference\/models\/Trilok-Ventures\/coa-green-extract$/);
assert.equal(seenUrl.includes("%2F"), false);
assert.equal(seenBody.includes("/Suppliers"), false);
assert.equal(seenBody.includes("file_bytes"), false);
assert.equal(seenBody.includes("coa.pdf"), false);
assert.equal("filename" in JSON.parse(seenBody).inputs, false);
assert.equal("lot_id" in JSON.parse(seenBody).inputs, false);

await assert.rejects(
  () =>
    classifyWithOptionalHf(ok, {
      token: "hf_test",
      model: "Trilok-Ventures/coa-green-extract",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ ...toHfInputs(ok), path: "/secret" }),
      }),
    }),
  /RED COA key forbidden/,
);

const wf = JSON.parse(readFileSync(new URL("./wf.coa.ocr.json", import.meta.url), "utf8"));
const wfText = JSON.stringify(wf);
const wfCode = wf.nodes.map((node) => node.parameters?.jsCode || "").join("\n");
assert.equal(wf.settings.saveDataSuccessExecution, "none");
assert.equal(wf.settings.saveDataErrorExecution, "none");
assert.equal(wfText.includes("action_release"), false);
assert.equal(/webdav/i.test(wfText), false);
assert.equal(/PROPFIND/i.test(wfText), false);
assert.match(wfText, /apply_coa_green/);
assert.match(wfCode, /RED binary payload forbidden/);
for (const key of RED_FORBIDDEN) {
  assert.equal(wfCode.includes(key), true, "workflow DLP must reject " + key);
}
const allowMatch = wfCode.match(/const COA_GREEN_ALLOWLIST = \[([^\]]+)\]/);
assert.ok(allowMatch, "workflow must declare COA_GREEN_ALLOWLIST");
const wfKeys = allowMatch[1]
  .split(",")
  .map((part) => part.replace(/['"]/g, "").trim())
  .filter(Boolean);
assert.deepEqual(wfKeys, COA_GREEN_ALLOWLIST);

console.log("coa-ocr-green tests passed");
