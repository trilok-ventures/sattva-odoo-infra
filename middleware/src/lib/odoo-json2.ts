type JsonRpcResult = {
  result?: unknown;
  error?: { message?: string; data?: { message?: string; arguments?: string[] } };
};

function json2Url(): string {
  if (process.env.ODOO_JSON2_URL) return process.env.ODOO_JSON2_URL;
  const base = process.env.ODOO_URL;
  if (!base) throw new Error("ODOO_URL unset");
  return `${base.replace(/\/$/, "")}/jsonrpc`;
}

export async function odooJson2(
  service: string,
  method: string,
  args: unknown[],
): Promise<unknown> {
  const res = await fetch(json2Url(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Date.now(),
    }),
  });
  const body = (await res.json()) as JsonRpcResult;
  if (body.error) {
    const message =
      body.error.data?.message || body.error.message || "Odoo JSON-2 error";
    throw new Error(message);
  }
  return body.result;
}

let cachedUid: number | null = null;

export async function odooUid(): Promise<number> {
  if (cachedUid != null) return cachedUid;
  const db = process.env.ODOO_DB || "sattva";
  const username = process.env.ODOO_USERNAME;
  const password = process.env.ODOO_API_KEY;
  if (!username || !password) throw new Error("ODOO_USERNAME/ODOO_API_KEY unset");
  const uid = await odooJson2("common", "authenticate", [db, username, password, {}]);
  if (typeof uid !== "number" || uid <= 0) throw new Error("Odoo authenticate failed");
  cachedUid = uid;
  return uid;
}

export async function executeKw(
  model: string,
  method: string,
  positional: unknown[],
  kwargs: Record<string, unknown> = {},
): Promise<unknown> {
  const db = process.env.ODOO_DB || "sattva";
  const password = process.env.ODOO_API_KEY;
  if (!password) throw new Error("ODOO_API_KEY unset");
  const uid = await odooUid();
  const args: unknown[] = [db, uid, password, model, method, positional];
  if (kwargs && Object.keys(kwargs).length) args.push(kwargs);
  return odooJson2("object", "execute_kw", args);
}
