import { NextResponse } from "next/server";
import { fabricMode } from "@/lib/fabric";
import { parsePersona } from "@/lib/persona";
import { COOKIE, LANDING } from "@/lib/screen-graph";
import { greenJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (fabricMode() === "live") {
    return greenJson(
      { error: "unauthorized", message: "Keycloak session required in live mode." },
      401,
    );
  }
  const body = (await req.json().catch(() => ({}))) as { persona?: string };
  const persona = parsePersona(body.persona ?? "sales");
  if (!persona) return greenJson({ error: "unknown_persona" }, 400);
  const res = NextResponse.json({ ok: true, next: "/s2", landing: LANDING[persona] });
  res.cookies.set(COOKIE, persona, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, next: "/" });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
