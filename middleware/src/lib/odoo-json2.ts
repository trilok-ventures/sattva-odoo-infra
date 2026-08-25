const ALLOWED_MODEL = "sattva.fabric.portal";
const ALLOWED_METHOD = "list_lots";

type JsonRpcEnvelope = {
  result?: unknown;
  error?: { message?: string; data?: { message?: string } };
};

function json2Url(base: string): string {
  const trimmed = base.replace(/\/$/, "");
  return trimmed.endsWith("/jsonrpc") ? trimmed : `${trimmed}/jsonrpc`;
}

async function jsonRpc(url: string, service: string, method: string, args: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: 1,
    }),
  });
  if (!res.ok) {
    throw new Error("odoo json-2 http error");
  }
  const body = (await res.json()) as JsonRpcEnvelope;
  if (body.error) {
    throw new Error("odoo json-2 call failed");
  }
  return body.result;
}

export async function portalListLots(buyerPartnerId: number | false): Promise<Record<string, unknown>[]> {
  const base = process.env.ODOO_URL;
  const db = process.env.ODOO_DB;
  const username = process.env.ODOO_USERNAME;
  const apiKey = process.env.ODOO_API_KEY;
  if (!base || !db || !username || !apiKey) {
    throw new Error("odoo json-2 is not configured");
  }
  const url = json2Url(base);
  const uid = await jsonRpc(url, "common", "authenticate", [db, username, apiKey, {}]);
  if (typeof uid !== "number" || uid <= 0) {
    throw new Error("odoo json-2 authenticate failed");
  }
  const result = await jsonRpc(url, "object", "execute_kw", [
    db,
    uid,
    apiKey,
    ALLOWED_MODEL,
    ALLOWED_METHOD,
    [buyerPartnerId],
  ]);
  if (!Array.isArray(result)) {
    throw new Error("odoo list_lots returned a non-list");
  }
  return result.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row),
  );
}
