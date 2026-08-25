import {
  fabricMode,
  n8nConfigured,
  odooConfigured,
  pingJson,
} from "../fabric";
import type { Reach } from "../fabric";
import { mockAdapter } from "./mock";
import { odooLotsAdapter } from "./odoo-lots";
import type { FabricAdapter } from "./types";

export function odooLotsConfigured(): boolean {
  return Boolean(
    process.env.ODOO_URL &&
      process.env.ODOO_DB &&
      process.env.ODOO_USERNAME &&
      process.env.ODOO_API_KEY,
  );
}

export function getAdapter(): FabricAdapter {
  // JSON-2 live lots attach when server-only Odoo vars are set. FABRIC_MODE=live
  // still 401s until Keycloak. No WebDAV from this BFF.
  if (odooLotsConfigured()) {
    return odooLotsAdapter;
  }
  return mockAdapter;
}

export async function fabricHealth(): Promise<{
  mode: "mock" | "live";
  odoo: Reach;
  n8n: Reach;
}> {
  const mode = fabricMode();
  if (mode === "mock") {
    return { mode, odoo: "mock", n8n: "mock" };
  }
  return {
    mode,
    odoo: await reach(odooConfigured(), odooHealthUrl()),
    n8n: await reach(n8nConfigured(), n8nHealthUrl()),
  };
}

async function reach(configured: boolean, url: string | null): Promise<Reach> {
  if (!configured || !url) return "unset";
  return (await pingJson(url)) ? "up" : "down";
}

function odooHealthUrl(): string | null {
  const base = process.env.ODOO_URL;
  return base ? `${base.replace(/\/$/, "")}/web/health` : null;
}

function n8nHealthUrl(): string | null {
  const base = process.env.N8N_BASE_URL;
  return base ? `${base.replace(/\/$/, "")}/healthz` : null;
}
