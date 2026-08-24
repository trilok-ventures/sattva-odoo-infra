export function n8nWebhookHeaders(): HeadersInit {
  const hmac = process.env.N8N_WEBHOOK_HMAC;
  if (!hmac) throw new Error("N8N_WEBHOOK_HMAC unset");
  return {
    "content-type": "application/json",
    "x-sattva-webhook-hmac": hmac,
  };
}

export function n8nWebhookUrl(path: string): string {
  const base = process.env.N8N_BASE_URL;
  if (!base) throw new Error("N8N_BASE_URL unset");
  return `${base.replace(/\/$/, "")}/webhook/${path.replace(/^\//, "")}`;
}

export async function postN8nMetadata(
  path: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(n8nWebhookUrl(path), {
    method: "POST",
    headers: n8nWebhookHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`n8n webhook ${path} failed: ${res.status}`);
  }
}
