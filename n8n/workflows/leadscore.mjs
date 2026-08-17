export const LEAD_SCORE_ALLOWLIST = [
  "hashed_partner_id",
  "stage_rank",
  "days_in_stage",
  "product_family_code",
  "order_count",
];

export function assertGreenPayload(payload) {
  if (payload == null || typeof payload !== "object") throw new Error("payload required");
  for (const key of Object.keys(payload)) {
    if (!LEAD_SCORE_ALLOWLIST.includes(key)) {
      throw new Error(`RED/AMBER key forbidden in lead score: ${key}`);
    }
  }
  for (const key of LEAD_SCORE_ALLOWLIST) {
    if (!(key in payload)) throw new Error(`missing ${key}`);
  }
}

export function scoreLead(features) {
  assertGreenPayload(features);
  const stage = Number(features.stage_rank) || 0;
  const recency = Math.max(0, 10 - (Number(features.days_in_stage) || 0)) / 10;
  const orders = Math.min(Number(features.order_count) || 0, 3) / 3;
  const score = Math.min(1, (stage / 3) * 0.5 + recency * 0.3 + orders * 0.2);
  return { score: Math.round(score * 100) / 100, qualified: score >= 0.7 };
}
