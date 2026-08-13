import type {
  ConfirmResult,
  Dashboard,
  DocumentReceipt,
  FabricAdapter,
  LotGreen,
  PurchaseOrder,
  QueueRow,
} from "./types";
import type { Persona } from "../persona";

const ORDERS: PurchaseOrder[] = [
  {
    id: "p00042",
    name: "P00042",
    partner_display: "Example Foods Pvt Ltd",
    gate: "review",
    state: "draft",
  },
  {
    id: "p00041",
    name: "P00041",
    partner_display: "Approved mill (demo)",
    gate: "approved",
    state: "draft",
  },
];

const QUEUE: QueueRow[] = [
  {
    partner_display: "Example Foods Pvt Ltd",
    status: "review",
    evidence_label: "Pest log expired",
    age_days: 2,
  },
  {
    partner_display: "Uncertified dehydrator (demo)",
    status: "pending",
    evidence_label: "No GFSI · audit required",
    age_days: 5,
  },
];

const LOTS: LotGreen[] = [
  {
    id: "l-882",
    sku: "ONION-FLAKE-A",
    moisture_pct: 4.8,
    mesh_pass: true,
    coa_pass: true,
    coa_sha256: "8f3a9c1e2b4d6a7081928374655eed00",
    buyer_order: "SO-1042",
  },
];

export const mockAdapter: FabricAdapter = {
  async dashboard(persona: Persona): Promise<Dashboard> {
    const base: Dashboard = {
      pending_pcp_reviews: 4,
      po_confirms_blocked: 2,
      lots_in_quarantine: 3,
      activity: [
        { at: "14:02", label: "P00042 blocked — supplier not approved", dest: "e4" },
        { at: "13:40", label: "Example Foods → review", dest: "e3" },
        { at: "11:15", label: "Lot L-882 COA pass (GREEN)", dest: "e5" },
      ],
    };
    if (persona === "finance") base.unpaid_invoices = 6;
    if (persona === "it") base.n8n_failures = 0;
    return base;
  },

  async complianceQueue(): Promise<QueueRow[]> {
    return QUEUE;
  },

  async purchaseOrders(): Promise<PurchaseOrder[]> {
    return ORDERS;
  },

  async confirmOrder(_persona: Persona, id: string): Promise<ConfirmResult> {
    const po = ORDERS.find((row) => row.id === id || row.name.toLowerCase() === id.toLowerCase());
    if (!po) {
      return {
        ok: false,
        title: "Compliance Gate Blocked",
        message: "Purchase order not found.",
        confirm_anyway: false,
      };
    }
    if (po.gate !== "approved") {
      return {
        ok: false,
        title: "Compliance Gate Blocked",
        message: `PO ${po.name} cannot be confirmed — ${po.partner_display} is ${po.gate}. Missing: current pest-control log. There is no Confirm anyway.`,
        confirm_anyway: false,
      };
    }
    return { ok: true, state: "purchase" };
  },

  async lots(persona: Persona): Promise<LotGreen[]> {
    if (persona === "buyer") {
      return LOTS.filter((lot) => lot.buyer_order === "SO-1042");
    }
    return LOTS;
  },

  async storeDocument(
    _persona: Persona,
    filename: string,
    sha256: string,
  ): Promise<DocumentReceipt> {
    return { sha256, filename };
  },
};
