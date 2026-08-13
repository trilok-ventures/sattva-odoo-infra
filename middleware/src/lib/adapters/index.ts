import {
  fabricMode,
  n8nConfigured,
  nextcloudConfigured,
  odooConfigured,
  pingJson,
} from "../fabric";
import type { Reach } from "../fabric";
import { mockAdapter } from "./mock";
import type { FabricAdapter } from "./types";

export function getAdapter(): FabricAdapter {
  // JSON-2 / WebDAV live adapters attach after Phase 1 Compose + GCP secrets.
  // Mock records match the HTML twin (Example Foods / P00042 / SO-1042).
  return mockAdapter;
}

export async function fabricHealth(): Promise<{
  mode: "mock" | "live";
  odoo: Reach;
  n8n: Reach;
  nextcloud: Reach;
}> {
  const mode = fabricMode();
  if (mode === "mock") {
    return { mode, odoo: "mock", n8n: "mock", nextcloud: "mock" };
  }
  return {
    mode,
    odoo: await reach(odooConfigured(), odooHealthUrl()),
    n8n: await reach(n8nConfigured(), n8nHealthUrl()),
    nextcloud: await reach(nextcloudConfigured(), nextcloudStatusUrl()),
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

function nextcloudStatusUrl(): string | null {
  const base = process.env.NEXTCLOUD_WEBDAV_URL;
  if (!base) return null;
  try {
    const u = new URL(base);
    return `${u.origin}/status.php`;
  } catch {
    return null;
  }
}
