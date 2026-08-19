import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parsePersona } from "@/lib/persona";
import { COOKIE } from "@/lib/screen-graph";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (process.env.FABRIC_MODE === "live") return res;
  if (!req.nextUrl.pathname.startsWith("/api")) return res;
  if (req.nextUrl.pathname === "/api/health") return res;
  if (req.headers.get("x-sattva-persona")) return res;
  const cookie = req.cookies.get(COOKIE)?.value ?? null;
  const persona = parsePersona(cookie);
  if (!persona) return res;
  const headers = new Headers(req.headers);
  headers.set("x-sattva-persona", persona);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/api/:path*"] };
