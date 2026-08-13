import { NextResponse } from "next/server";
import { assertNoRedKeys, stripRedKeys } from "./classification";
import { fabricMode } from "./fabric";
import { parsePersona, type Persona } from "./persona";

export function requestId(): string {
  return crypto.randomUUID();
}

export function readPersona(req: Request): { persona: Persona } | { error: NextResponse } {
  const mode = fabricMode();
  // Persona header is mock/dev only. Live mode requires Keycloak (Phase 3);
  // until then refuse so a spoofed header cannot look like production auth.
  if (mode === "live") {
    return {
      error: NextResponse.json(
        { error: "unauthorized", message: "Keycloak session required in live mode." },
        { status: 401 },
      ),
    };
  }
  const raw = req.headers.get("x-sattva-persona");
  const header = parsePersona(raw);
  if (raw && raw.trim() !== "" && !header) {
    return {
      error: NextResponse.json({ error: "unknown_persona", message: "Invalid x-sattva-persona." }, { status: 400 }),
    };
  }
  return { persona: header ?? "sales" };
}

export function greenJson(body: unknown, status = 200): NextResponse {
  const rid = requestId();
  const hits = assertNoRedKeys(body);
  if (hits.length) {
    console.error("classification_violation", { request_id: rid, hits });
  }
  return NextResponse.json(stripRedKeys(body), {
    status,
    headers: {
      "x-request-id": rid,
      "x-sattva-fabric-mode": fabricMode(),
      "cache-control": "no-store",
    },
  });
}

export function forbid(message: string): NextResponse {
  return greenJson({ error: "forbidden", message }, 403);
}
