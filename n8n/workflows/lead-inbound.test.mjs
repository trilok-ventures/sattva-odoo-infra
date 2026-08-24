import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { scoreLead } from "./leadscore.mjs";
import {
  assertInboundLead,
  hashWorkEmail,
  normalizeInboundLead,
} from "./lead-inbound.mjs";

const ok = {
  contact_name: "Alex Rivera",
  work_email: "alex@example.com",
  company_name: "Riverbank Foods",
  product_family_code: "ONION",
  fcl_band: "2_5",
  content_topic: "sfcr",
};

assert.throws(() => assertInboundLead({ ...ok, notes: "call me" }));
assert.throws(() => assertInboundLead({ ...ok, email: ok.work_email }));
assert.throws(() => assertInboundLead({ ...ok, work_email: "not-an-email" }));
assert.throws(() => assertInboundLead({ ...ok, product_family_code: "BEEF" }));
assert.throws(() => assertInboundLead({ ...ok, fcl_band: "99" }));
assert.throws(() =>
  assertInboundLead({ ...ok, extra: { nested: true }, content_topic: "sfcr" }),
);
assert.doesNotThrow(() => assertInboundLead(ok));
const normalized = normalizeInboundLead({ ...ok, work_email: "Alex@Example.COM " });
assert.equal(normalized.work_email, "alex@example.com");
const digest = hashWorkEmail(normalized.work_email);
assert.equal(
  digest,
  createHash("sha256").update("alex@example.com").digest("hex"),
);
const scored = scoreLead({
  hashed_partner_id: digest,
  stage_rank: 1,
  days_in_stage: 0,
  product_family_code: normalized.product_family_code,
  order_count: 0,
});
assert.equal(scored.qualified, false);
assert.ok("email" in { email: normalized.work_email });
assert.equal(
  Object.prototype.hasOwnProperty.call(
    {
      hashed_partner_id: digest,
      stage_rank: 1,
      days_in_stage: 0,
      product_family_code: "ONION",
      order_count: 0,
    },
    "work_email",
  ),
  false,
);

const htmlPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../docs/superpowers/mocks/inbound-lead.html",
);
const html = readFileSync(htmlPath, "utf8");
for (const forbidden of [
  "NEXT_PUBLIC_",
  "n8n.trilokventures.org",
  "sattva.trilokventures.org",
  "huggingface",
  "auth.trilokventures.org",
  "N8N_WEBHOOK_HMAC",
]) {
  assert.equal(html.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
}
assert.ok(/does not create Keycloak users/i.test(html));
assert.ok(html.includes("sattva_lead_webhook"));
assert.ok(html.includes("sattva_lead_hmac"));
assert.ok(html.includes("product_family_code"));
console.log("inbound lead tests passed");
