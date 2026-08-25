import type { LotGreen } from "./adapters/types";
import { stripRedKeys } from "./classification";

const LOT_PUBLIC_KEYS = [
  "id",
  "sku",
  "state",
  "officer_released",
  "coa_present",
  "coa_pass",
  "coa_sha256",
  "moisture_pct",
  "mesh_pass",
  "salmonella_absent",
  "tpc_cfu",
  "pyruvic_umol",
  "buyer_order",
] as const;

export function publicLots(lots: LotGreen[]): LotGreen[] {
  return lots.map((lot) => {
    const row: Record<string, unknown> = {};
    for (const key of LOT_PUBLIC_KEYS) {
      row[key] = lot[key];
    }
    return stripRedKeys(row) as LotGreen;
  });
}
