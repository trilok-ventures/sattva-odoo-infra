import type {
  ActivityRow,
  CatalogueCard,
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

const ACTIVITIES: ActivityRow[] = [
  {
    id: "a1",
    at: "14:02",
    summary: "SATTVA: Lead qualified for pitch",
    dest: "e1",
    role: "sales.exec",
  },
  {
    id: "a2",
    at: "14:10",
    summary: "SATTVA: Draft delivery pack ready",
    dest: "e6",
    role: "logistics.exec",
  },
];

const CATALOGUE: CatalogueCard[] = [
  { sku: "ONION-FLAKE-A", crop: "onion", format: "flake", mesh_label: "3-5 mm", supplier_display: "Approved mill (demo)" },
  { sku: "GARLIC-POWDER-B", crop: "garlic", format: "powder", mesh_label: "80-100 mesh", supplier_display: "Approved mill (demo)" },
  { sku: "CHILLI-FLAKE-C", crop: "chilli", format: "flake", mesh_label: "3-5 mm", supplier_display: "Approved mill (demo)" },
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

function allowedUploadOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return undefined;
    }
    const loopback =
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      (url.protocol === "http:" || url.protocol === "https:");
    const production =
      url.protocol === "https:" &&
      url.hostname === "upload.trilokventures.org" &&
      url.port === "";
    return loopback || production ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

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
    const origin = allowedUploadOrigin(process.env.UPLOAD_ORIGIN_PUBLIC_URL);
    return {
      sha256,
      filename,
      ...(origin ? { upload_url: `${origin}/u/mock-token` } : {}),
    };
  },

  async activities(persona: Persona): Promise<ActivityRow[]> {
    if (persona === "buyer" || persona === "supplier") return [];
    if (persona === "sales") return ACTIVITIES.filter((row) => row.role === "sales.exec");
    if (persona === "logistics") return ACTIVITIES.filter((row) => row.role === "logistics.exec");
    if (persona === "compliance") return ACTIVITIES.filter((row) => row.role === "compliance.officer");
    if (persona === "finance") return ACTIVITIES.filter((row) => row.role === "finance.manager");
    if (persona === "it") return ACTIVITIES.filter((row) => row.role === "it.admin");
    return [];
  },

  async catalogue(_persona: Persona): Promise<CatalogueCard[]> {
    return CATALOGUE;
  },
};
