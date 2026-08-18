export type FabricMode = "mock" | "live";

export type Reach = "mock" | "unset" | "up" | "down";

export function fabricMode(): FabricMode {
  return process.env.FABRIC_MODE === "live" ? "live" : "mock";
}

export function odooConfigured(): boolean {
  return Boolean(process.env.ODOO_URL && process.env.ODOO_API_KEY);
}

export function n8nConfigured(): boolean {
  return Boolean(process.env.N8N_BASE_URL);
}

export function isHealthy(reach: Reach): boolean {
  return reach === "mock" || reach === "up";
}

export async function pingJson(url: string, timeoutMs = 4000): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
