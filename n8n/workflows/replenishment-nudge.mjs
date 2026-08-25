export const REPLENISHMENT_ALLOWLIST = ["partner_id"];

export function assertReplenishmentTrigger(payload) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload required");
  }
  for (const key of Object.keys(payload)) {
    if (!REPLENISHMENT_ALLOWLIST.includes(key)) {
      throw new Error(`unknown replenishment key forbidden: ${key}`);
    }
    if (payload[key] != null && typeof payload[key] === "object") {
      throw new Error("nested objects forbidden");
    }
  }
  if (
    "partner_id" in payload &&
    payload.partner_id !== false &&
    (typeof payload.partner_id !== "number" ||
      !Number.isInteger(payload.partner_id) ||
      payload.partner_id < 1)
  ) {
    throw new Error("partner_id must be a positive integer or omitted");
  }
}

export function normalizeReplenishmentTrigger(payload) {
  assertReplenishmentTrigger(payload);
  return { partner_id: payload.partner_id ?? false };
}
