import { coaPresent, officerReleased } from "./lot-status";
import type { LotGreen, LotState } from "./adapters/types";

const PORTAL_KEYS = [
  "id",
  "sku",
  "state",
  "coa_pass",
  "coa_sha256",
  "moisture_pct",
  "mesh_pass",
  "salmonella_absent",
  "tpc_cfu",
  "pyruvic_umol",
  "buyer_order",
] as const;

export function parseLotState(value: unknown): LotState | null {
  switch (value) {
    case "quarantine":
    case "available":
    case "rejected":
      return value;
    default:
      return null;
  }
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function mapPortalLot(row: Record<string, unknown>): LotGreen | null {
  const state = parseLotState(row.state);
  if (!state || typeof row.id !== "string" || row.id.length === 0) {
    return null;
  }
  const sha = typeof row.coa_sha256 === "string" ? row.coa_sha256 : "";
  const buyer =
    typeof row.buyer_order === "string" && row.buyer_order ? row.buyer_order : undefined;
  const mapped: LotGreen = {
    id: row.id,
    sku: typeof row.sku === "string" ? row.sku : "",
    state,
    officer_released: officerReleased(state),
    coa_present: coaPresent(sha),
    coa_pass: row.coa_pass === true,
    coa_sha256: sha,
    moisture_pct: asNumber(row.moisture_pct),
    mesh_pass: row.mesh_pass === true,
    salmonella_absent: row.salmonella_absent === true,
    tpc_cfu: asNumber(row.tpc_cfu),
    pyruvic_umol: asNumber(row.pyruvic_umol),
    ...(buyer ? { buyer_order: buyer } : {}),
  };
  for (const key of Object.keys(mapped)) {
    if (
      key !== "officer_released" &&
      key !== "coa_present" &&
      !(PORTAL_KEYS as readonly string[]).includes(key)
    ) {
      return null;
    }
  }
  return mapped;
}
