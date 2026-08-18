import assert from "node:assert/strict";
import { assertGreenPayload, scoreLead } from "./leadscore.mjs";

assert.throws(() => assertGreenPayload({ email: "a@b.c", stage_rank: 1 }));
assert.throws(() => assertGreenPayload({ hashed_partner_id: "x", notes: "call me" }));
const ok = {
  hashed_partner_id: "cafebabedeadbeef",
  stage_rank: 2,
  days_in_stage: 3,
  product_family_code: "ONION",
  order_count: 0,
};
assert.doesNotThrow(() => assertGreenPayload(ok));
const low = scoreLead({ ...ok, stage_rank: 0, days_in_stage: 0, order_count: 0 });
assert.equal(low.qualified, false);
const high = scoreLead({ ...ok, stage_rank: 3, days_in_stage: 1, order_count: 2 });
assert.equal(high.qualified, true);
assert.ok(high.score >= 0.7);
console.log("leadscore tests passed");
