import { n8nConfigured } from "../fabric";
import { postN8nMetadata } from "../n8n-hmac";
import { executeKw } from "../odoo-json2";
import type { Persona } from "../persona";
import type {
  ActivityRow,
  CatalogueCard,
  ConfirmResult,
  Dashboard,
  DocumentReceipt,
  FabricAdapter,
  GateStatus,
  LotGreen,
  NotifyRole,
  PurchaseOrder,
  QueueRow,
} from "./types";

const GATES: GateStatus[] = ["pending", "review", "approved", "blocked"];

function asGate(value: unknown): GateStatus {
  return typeof value === "string" && (GATES as string[]).includes(value)
    ? (value as GateStatus)
    : "pending";
}

export const liveAdapter: FabricAdapter = {
  async dashboard(persona: Persona): Promise<Dashboard> {
    const pending = (await executeKw(
      "res.partner",
      "search_count",
      [[["supplier_pcp_status", "in", ["pending", "review"]], ["supplier_rank", ">", 0]]],
    )) as number;
    const blocked = (await executeKw(
      "purchase.order",
      "search_count",
      [[["state", "=", "draft"]]],
    )) as number;
    const quarantined = (await executeKw(
      "sattva.lot",
      "search_count",
      [[["state", "=", "quarantine"]]],
    )) as number;
    const base: Dashboard = {
      pending_pcp_reviews: Number(pending) || 0,
      po_confirms_blocked: Number(blocked) || 0,
      lots_in_quarantine: Number(quarantined) || 0,
      activity: [],
    };
    if (persona === "finance") {
      base.unpaid_invoices = 0;
    }
    if (persona === "it") {
      base.n8n_failures = 0;
    }
    return base;
  },

  async complianceQueue(): Promise<QueueRow[]> {
    const rows = (await executeKw(
      "res.partner",
      "search_read",
      [[["supplier_pcp_status", "in", ["pending", "review"]], ["supplier_rank", ">", 0]]],
      { fields: ["name", "supplier_pcp_status"], limit: 50 },
    )) as Array<{ name?: string; supplier_pcp_status?: string }>;
    return (rows || []).map((row) => ({
      partner_display: String(row.name || ""),
      status: asGate(row.supplier_pcp_status),
      evidence_label: "See vault (path withheld)",
      age_days: 0,
    }));
  },

  async purchaseOrders(): Promise<PurchaseOrder[]> {
    const rows = (await executeKw(
      "purchase.order",
      "search_read",
      [[["state", "in", ["draft", "sent", "to approve", "purchase"]]]],
      { fields: ["name", "partner_id", "state"], limit: 50 },
    )) as Array<{ id: number; name?: string; partner_id?: [number, string]; state?: string }>;
    const out: PurchaseOrder[] = [];
    for (const row of rows || []) {
      const partnerId = Array.isArray(row.partner_id) ? row.partner_id[0] : undefined;
      let gate: GateStatus = "pending";
      let partnerDisplay = Array.isArray(row.partner_id) ? String(row.partner_id[1] || "") : "";
      if (partnerId) {
        const partners = (await executeKw(
          "res.partner",
          "read",
          [[partnerId], ["name", "supplier_pcp_status"]],
        )) as Array<{ name?: string; supplier_pcp_status?: string }>;
        const partner = partners?.[0];
        if (partner) {
          gate = asGate(partner.supplier_pcp_status);
          partnerDisplay = String(partner.name || partnerDisplay);
        }
      }
      out.push({
        id: String(row.id),
        name: String(row.name || row.id),
        partner_display: partnerDisplay,
        gate,
        state: String(row.state || "draft"),
      });
    }
    return out;
  },

  async confirmOrder(_persona: Persona, id: string): Promise<ConfirmResult> {
    const domain = /^\d+$/.test(id)
      ? [["id", "=", Number(id)]]
      : [["name", "=ilike", id]];
    const ids = (await executeKw("purchase.order", "search", [domain], { limit: 1 })) as number[];
    if (!ids?.length) {
      return {
        ok: false,
        title: "Compliance Gate Blocked",
        message: "Purchase order not found.",
        confirm_anyway: false,
      };
    }
    try {
      await executeKw("purchase.order", "button_confirm", [ids]);
      const [row] = (await executeKw(
        "purchase.order",
        "read",
        [ids, ["state"]],
      )) as Array<{ state?: string }>;
      if (row?.state === "purchase" || row?.state === "done") {
        return { ok: true, state: "purchase" };
      }
      return { ok: true, state: "purchase" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Compliance Gate Blocked";
      return {
        ok: false,
        title: "Compliance Gate Blocked",
        message,
        confirm_anyway: false,
      };
    }
  },

  async lots(persona: Persona): Promise<LotGreen[]> {
    const domain = persona === "buyer" ? [["sale_order_id", "!=", false]] : [];
    const rows = (await executeKw(
      "sattva.lot",
      "search_read",
      [domain],
      {
        fields: [
          "sku",
          "moisture_pct",
          "mesh_pass",
          "coa_pass",
          "coa_sha256",
          "sale_order_id",
        ],
        limit: 50,
      },
    )) as Array<{
      id: number;
      sku?: string;
      moisture_pct?: number;
      mesh_pass?: boolean;
      coa_pass?: boolean;
      coa_sha256?: string;
      sale_order_id?: [number, string] | false;
    }>;
    return (rows || []).map((row) => ({
      id: String(row.id),
      sku: String(row.sku || ""),
      moisture_pct: Number(row.moisture_pct) || 0,
      mesh_pass: Boolean(row.mesh_pass),
      coa_pass: Boolean(row.coa_pass),
      coa_sha256: String(row.coa_sha256 || ""),
      buyer_order: Array.isArray(row.sale_order_id) ? String(row.sale_order_id[1] || "") : undefined,
    }));
  },

  async storeDocument(
    _persona: Persona,
    filename: string,
    sha256: string,
  ): Promise<DocumentReceipt> {
    if (n8nConfigured() && process.env.N8N_WEBHOOK_HMAC) {
      try {
        await postN8nMetadata("document-metadata", { filename, sha256 });
      } catch {
        // Receipt is still valid; n8n is pass-through only.
      }
    }
    return { sha256, filename };
  },

  async activities(persona: Persona): Promise<ActivityRow[]> {
    if (persona === "buyer" || persona === "supplier") return [];
    const role = roleForPersona(persona);
    const rows = (await executeKw(
      "mail.activity",
      "search_read",
      [[["summary", "=like", "SATTVA:%"]]],
      { fields: ["summary", "date_deadline"], limit: 20, order: "id desc" },
    )) as Array<{ id: number; summary?: string; date_deadline?: string }>;
    return (rows || []).map((row) => ({
      id: String(row.id),
      at: String(row.date_deadline || ""),
      summary: String(row.summary || ""),
      dest: "odoo",
      role,
    }));
  },

  async catalogue(): Promise<CatalogueCard[]> {
    const rows = (await executeKw(
      "product.product",
      "search_read",
      [[["sale_ok", "=", true], ["default_code", "!=", false]]],
      {
        fields: ["default_code", "sattva_crop", "sattva_format", "sattva_mesh_label"],
        limit: 50,
      },
    )) as Array<{
      default_code?: string;
      sattva_crop?: string;
      sattva_format?: string;
      sattva_mesh_label?: string;
    }>;
    return (rows || []).map((row) => ({
      sku: String(row.default_code || ""),
      crop: String(row.sattva_crop || ""),
      format: String(row.sattva_format || ""),
      mesh_label: String(row.sattva_mesh_label || ""),
      supplier_display: "",
    }));
  },
};

function roleForPersona(persona: Persona): NotifyRole {
  switch (persona) {
    case "sales":
      return "sales.exec";
    case "compliance":
      return "compliance.officer";
    case "finance":
      return "finance.manager";
    case "logistics":
      return "logistics.exec";
    case "it":
      return "it.admin";
    case "buyer":
    case "supplier":
      return "sales.exec";
    default: {
      const _never: never = persona;
      return _never;
    }
  }
}
