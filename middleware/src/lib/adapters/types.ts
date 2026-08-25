import type { Persona } from "../persona";

export type GateStatus = "pending" | "review" | "approved" | "blocked";

export type PurchaseOrder = {
  id: string;
  name: string;
  partner_display: string;
  gate: GateStatus;
  state: string;
};

export type LotGreen = {
  id: string;
  sku: string;
  moisture_pct: number;
  mesh_pass: boolean;
  coa_pass: boolean;
  coa_sha256: string;
  buyer_order?: string;
};

export type QueueRow = {
  partner_display: string;
  status: GateStatus;
  evidence_label: string;
  age_days: number;
};

export type Dashboard = {
  pending_pcp_reviews: number;
  po_confirms_blocked: number;
  lots_in_quarantine: number;
  unpaid_invoices?: number;
  n8n_failures?: number;
  activity: Array<{ at: string; label: string; dest: string }>;
};

export type ConfirmResult =
  | { ok: true; state: "purchase" }
  | {
      ok: false;
      title: "Compliance Gate Blocked";
      message: string;
      confirm_anyway: false;
    };

export type DocumentReceipt = { sha256: string; filename: string; upload_url?: string };

export type NotifyRole =
  | "sales.exec"
  | "compliance.officer"
  | "finance.manager"
  | "logistics.exec"
  | "it.admin";

export type ActivityRow = {
  id: string;
  at: string;
  summary: string;
  dest: string;
  role: NotifyRole;
};

export type CatalogueCard = {
  sku: string;
  crop: string;
  format: string;
  mesh_label: string;
  supplier_display: string;
};

export type InvoiceRow = {
  id: string;
  partner_display: string;
  amount_label: string;
  state: "draft" | "posted";
};

export interface FabricAdapter {
  dashboard(persona: Persona): Promise<Dashboard>;
  complianceQueue(persona: Persona): Promise<QueueRow[]>;
  purchaseOrders(persona: Persona): Promise<PurchaseOrder[]>;
  confirmOrder(persona: Persona, id: string): Promise<ConfirmResult>;
  lots(persona: Persona): Promise<LotGreen[]>;
  invoices(persona: Persona): Promise<InvoiceRow[]>;
  storeDocument(persona: Persona, filename: string, sha256: string): Promise<DocumentReceipt>;
  activities(persona: Persona): Promise<ActivityRow[]>;
  catalogue(persona: Persona): Promise<CatalogueCard[]>;
}
