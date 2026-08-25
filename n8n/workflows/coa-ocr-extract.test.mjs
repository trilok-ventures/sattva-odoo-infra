import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { persistFields } from "./coa-ocr-green.mjs";
import {
  MAX_SIDECAR_BYTES,
  assertSidecarBasename,
  assertSidecarHref,
  assertSidecarTrigger,
  parseSidecarBytes,
  pdfBasenameFromSidecar,
} from "./coa-ocr-extract.mjs";

const okGreen = {
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

assert.equal(pdfBasenameFromSidecar("coa.pdf.green.json"), "coa.pdf");
assert.doesNotThrow(() => assertSidecarBasename("coa.pdf.green.json"));
assert.throws(() => assertSidecarBasename("coa.pdf"), /green\.json/);
assert.throws(() => assertSidecarBasename("../coa.pdf.green.json"), /basename/);
assert.throws(() => assertSidecarBasename(".green.json"), /basename/);
assert.throws(() => assertSidecarBasename("/Suppliers/x/coa.pdf.green.json"), /basename/);

assert.doesNotThrow(() =>
  assertSidecarTrigger({ lot_id: 12, sidecar_basename: "coa.pdf.green.json" }),
);
assert.throws(() => assertSidecarTrigger({ lot_id: 12 }), /sidecar_basename/);
assert.throws(
  () =>
    assertSidecarTrigger({
      lot_id: 12,
      sidecar_basename: "coa.pdf.green.json",
      path: "/Suppliers/x/",
    }),
  /unknown/,
);
assert.throws(
  () =>
    assertSidecarTrigger({
      lot_id: 12,
      sidecar_basename: "coa.pdf.green.json",
      vault_href: "/Suppliers/x/coa.pdf.green.json",
    }),
  /unknown/,
);

const folder = "/Suppliers/Synthetic_Lot_Mill/Certificates/";
assert.doesNotThrow(() =>
  assertSidecarHref(`${folder}coa.pdf.green.json`, folder, "coa.pdf.green.json"),
);
assert.throws(
  () => assertSidecarHref(`${folder}coa.pdf`, folder, "coa.pdf.green.json"),
  /green\.json/,
);
assert.throws(
  () =>
    assertSidecarHref(
      "/Clients/x/Orders/SO/coa.pdf.green.json",
      folder,
      "coa.pdf.green.json",
    ),
  /vault_href|Suppliers/,
);

const parsed = parseSidecarBytes(Buffer.from(JSON.stringify(okGreen)), {
  lot_id: 12,
  sidecar_basename: "coa.pdf.green.json",
});
assert.deepEqual(parsed, persistFields(okGreen));
assert.equal("path" in parsed, false);
assert.equal("pdf" in parsed, false);

assert.throws(
  () => parseSidecarBytes(Buffer.from("%PDF-1.4 leftover"), { lot_id: 12, sidecar_basename: "coa.pdf.green.json" }),
  /RED PDF payload forbidden/,
);
assert.throws(
  () =>
    parseSidecarBytes(Buffer.from(JSON.stringify({ ...okGreen, path: "/x" })), {
      lot_id: 12,
      sidecar_basename: "coa.pdf.green.json",
    }),
  /RED COA key forbidden/,
);
assert.throws(
  () =>
    parseSidecarBytes(Buffer.from(JSON.stringify({ ...okGreen, lot_id: 99 })), {
      lot_id: 12,
      sidecar_basename: "coa.pdf.green.json",
    }),
  /lot_id mismatch/,
);
assert.throws(
  () =>
    parseSidecarBytes(Buffer.from(JSON.stringify({ ...okGreen, filename: "other.pdf" })), {
      lot_id: 12,
      sidecar_basename: "coa.pdf.green.json",
    }),
  /filename mismatch/,
);
assert.throws(
  () => parseSidecarBytes(Buffer.alloc(MAX_SIDECAR_BYTES + 1, 0x20), { lot_id: 12, sidecar_basename: "coa.pdf.green.json" }),
  /sidecar too large/,
);

const wf = JSON.parse(readFileSync(new URL("./wf.coa.ocr.sidecar.json", import.meta.url), "utf8"));
const wfText = JSON.stringify(wf);
const wfCode = wf.nodes.map((node) => node.parameters?.jsCode || "").join("\n");
assert.equal(wf.settings.saveDataSuccessExecution, "none");
assert.equal(wf.settings.saveDataErrorExecution, "none");
assert.equal(wf.nodes.find((node) => node.type === "n8n-nodes-base.webhook")?.parameters?.responseMode, "onReceived");
assert.equal(wfText.includes("action_release"), false);
assert.equal(/PROPFIND/i.test(wfText), false);
assert.match(wfText, /resolve_coa_sidecar/);
assert.match(wfText, /apply_coa_green/);
assert.match(wfCode, /RED PDF payload forbidden/);
assert.match(wfCode, /\.green\.json/);
assert.match(wfCode, /lot_id mismatch/);
assert.match(wfCode, /sidecar_basename mismatch/);
assert.match(wfCode, /content-length/);
const getNode = wf.nodes.find((node) => node.parameters?.method === "GET");
assert.ok(getNode, "sidecar workflow must GET the GREEN sidecar");
assert.match(String(getNode.parameters.url), /vault_href/);
assert.equal(String(getNode.parameters.url).includes(".pdf"), false);
assert.equal(getNode.parameters.options?.response?.response?.responseFormat, "text");

console.log("coa-ocr-extract tests passed");
