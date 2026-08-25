import { mapPortalLot } from "../lot-from-odoo";
import { portalListLots } from "../odoo-json2";
import type { Persona } from "../persona";
import { mockAdapter } from "./mock";
import type { FabricAdapter, LotGreen } from "./types";

function buyerPartnerId(): number | false {
  const raw = process.env.ODOO_BUYER_PARTNER_ID;
  if (!raw) return false;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : false;
}

async function lotsFromOdoo(persona: Persona): Promise<LotGreen[]> {
  if (persona === "supplier") return [];
  const scoped = persona === "buyer" ? buyerPartnerId() : false;
  if (persona === "buyer" && scoped === false) {
    return [];
  }
  const rows = await portalListLots(scoped);
  return rows
    .map((row) => mapPortalLot(row))
    .filter((lot): lot is LotGreen => lot !== null);
}

export const odooLotsAdapter: FabricAdapter = {
  ...mockAdapter,
  lots: lotsFromOdoo,
};
