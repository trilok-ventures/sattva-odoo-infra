import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (process.env.FABRIC_MODE !== "live") {
    return NextResponse.next();
  }
  const path = req.nextUrl.pathname;
  if (path === "/api/health" || path.startsWith("/api/health/")) {
    return NextResponse.next();
  }
  return NextResponse.json(
    {
      error: "unauthorized",
      message: "Keycloak session required in live mode.",
    },
    { status: 401 },
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
