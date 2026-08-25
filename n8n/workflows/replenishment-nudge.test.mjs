import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertReplenishmentTrigger,
  normalizeReplenishmentTrigger,
} from "./replenishment-nudge.mjs";

assert.doesNotThrow(() => assertReplenishmentTrigger({}));
assert.doesNotThrow(() => assertReplenishmentTrigger({ partner_id: 7 }));
assert.doesNotThrow(() => assertReplenishmentTrigger({ partner_id: false }));
assert.throws(() => assertReplenishmentTrigger(null));
assert.throws(() => assertReplenishmentTrigger([]));
assert.throws(() => assertReplenishmentTrigger({ partner_id: 0 }));
assert.throws(() => assertReplenishmentTrigger({ partner_id: 1.5 }));
assert.throws(() => assertReplenishmentTrigger({ partner_id: "7" }));
assert.throws(() => assertReplenishmentTrigger({ partner_id: 7, email: "x@y.z" }));
assert.throws(() => assertReplenishmentTrigger({ name: "Buyer" }));
assert.throws(() =>
  assertReplenishmentTrigger({ partner_id: { nested: true } }),
);

assert.deepEqual(normalizeReplenishmentTrigger({}), { partner_id: false });
assert.deepEqual(normalizeReplenishmentTrigger({ partner_id: 9 }), {
  partner_id: 9,
});

const wf = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "wf.replenishment.nudge.json"),
  "utf8",
);
assert.ok(wf.includes("REPLENISHMENT_ALLOWLIST"));
assert.ok(wf.includes("unknown replenishment key forbidden"));
assert.ok(wf.includes("scan_replenishment_nudges"));
assert.ok(wf.includes("sattva.fabric.notify"));
assert.ok(wf.includes("N8N_WEBHOOK_HMAC"));
assert.ok(wf.includes("x-sattva-webhook-hmac"));
assert.equal(wf.includes("action_confirm"), false);
assert.equal(wf.includes("button_confirm"), false);
assert.equal(wf.includes("action_release"), false);
assert.equal(wf.includes("stock.quant"), false);
assert.equal(wf.includes("stock.lot"), false);
assert.equal(/keycloak/i.test(wf), false);
assert.ok(wf.includes('"saveDataSuccessExecution": "none"'));
assert.ok(wf.includes("odooN8nFabric.value"));

console.log("replenishment-nudge tests passed");
