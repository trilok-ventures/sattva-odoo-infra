import { createHash } from "node:crypto";

export const INBOUND_LEAD_ALLOWLIST = [
  "contact_name",
  "work_email",
  "company_name",
  "product_family_code",
  "fcl_band",
  "content_topic",
];

export const PRODUCT_FAMILY_CODES = ["ONION", "GARLIC", "CHILLI", "OTHER"];
export const FCL_BANDS = ["1", "2_5", "6_plus"];
export const CONTENT_TOPICS = ["sfcr", "coa_spec", "steam_sterilization"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertInboundLead(payload) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload required");
  }
  for (const key of Object.keys(payload)) {
    if (!INBOUND_LEAD_ALLOWLIST.includes(key)) {
      throw new Error(`unknown inbound lead key forbidden: ${key}`);
    }
    if (payload[key] != null && typeof payload[key] === "object") {
      throw new Error("nested objects forbidden");
    }
  }
  for (const key of INBOUND_LEAD_ALLOWLIST) {
    if (!(key in payload)) throw new Error(`missing ${key}`);
    if (typeof payload[key] !== "string" || !payload[key].trim()) {
      throw new Error(`${key} must be a non-empty string`);
    }
  }
  const email = payload.work_email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120) {
    throw new Error("work_email must be a short email");
  }
  if (!PRODUCT_FAMILY_CODES.includes(payload.product_family_code)) {
    throw new Error("unknown product_family_code");
  }
  if (!FCL_BANDS.includes(payload.fcl_band)) {
    throw new Error("unknown fcl_band");
  }
  if (!CONTENT_TOPICS.includes(payload.content_topic)) {
    throw new Error("unknown content_topic");
  }
}

export function normalizeInboundLead(payload) {
  assertInboundLead(payload);
  return {
    contact_name: payload.contact_name.trim().slice(0, 120),
    work_email: payload.work_email.trim().toLowerCase(),
    company_name: payload.company_name.trim().slice(0, 120),
    product_family_code: payload.product_family_code,
    fcl_band: payload.fcl_band,
    content_topic: payload.content_topic,
  };
}

export function hashWorkEmail(email) {
  return createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex");
}
