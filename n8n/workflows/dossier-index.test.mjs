import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertDossierEntries,
  assertDossierTrigger,
  hashBytes,
  inferDocKind,
  parsePropfind,
} from "./dossier-index.mjs";

const orderPath = "/Clients/Synthetic_Dossier_Buyer/Orders/SO_DOSSIER/";
const sha = createHash("sha256").update("pdf-bytes").digest("hex");

assert.throws(() => assertDossierTrigger({}));
assert.throws(() => assertDossierTrigger({ sale_order_id: 0 }));
assert.throws(() => assertDossierTrigger({ sale_order_id: 1, path: orderPath }));
assert.doesNotThrow(() => assertDossierTrigger({ sale_order_id: 7 }));
assert.doesNotThrow(() =>
  assertDossierTrigger({ sale_order_id: 7, lot_id: 3 }),
);

const ok = {
  filename: "coa.pdf",
  sha256: sha,
  vault_href: `${orderPath}coa.pdf`,
};
assert.throws(() => assertDossierEntries([{ ...ok, extra: true }], orderPath));
assert.throws(() =>
  assertDossierEntries([{ ...ok, content: "JVBERi0=" }], orderPath),
);
assert.throws(() =>
  assertDossierEntries([{ ...ok, filename: "../coa.pdf" }], orderPath),
);
assert.throws(() =>
  assertDossierEntries(
    [{ ...ok, vault_href: "/Suppliers/Mill/Certificates/coa.pdf" }],
    orderPath,
  ),
);
assert.doesNotThrow(() => assertDossierEntries([ok], orderPath));

assert.equal(inferDocKind("coa.pdf"), "coa");
assert.equal(inferDocKind("packing_list.pdf"), "packing");
assert.equal(inferDocKind("bill_of_lading.pdf"), "bl");
assert.equal(inferDocKind("notes.pdf"), "other");
assert.equal(hashBytes(Buffer.from("pdf-bytes")), sha);

const xml = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/files/admin${orderPath}</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/admin${orderPath}coa.pdf</d:href>
    <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/admin/Clients/Other/Orders/X/secret.pdf</d:href>
    <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
  </d:response>
</d:multistatus>`;
const listed = parsePropfind(xml, orderPath);
assert.deepEqual(listed, [
  { filename: "coa.pdf", vault_href: `${orderPath}coa.pdf` },
]);

const wf = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "wf.dossier.index.json"),
  "utf8",
);
for (const forbidden of [
  "button_confirm",
  "action_confirm",
  "action_release",
  "action_reject",
  "N8N_LEAD_INBOUND_HMAC",
  "NEXT_PUBLIC_",
  "huggingface",
]) {
  assert.equal(wf.includes(forbidden), false, forbidden);
}
assert.ok(wf.includes("N8N_WEBHOOK_HMAC"));
assert.ok(wf.includes("createHash"));
assert.ok(wf.includes("sattva.fabric.dossier"));
assert.ok(wf.includes("apply_index"));
assert.ok(wf.includes('"saveDataSuccessExecution": "none"'));
assert.ok(wf.includes('"responseMode": "onReceived"'));
console.log("dossier index tests passed");
