import { NextResponse } from "next/server";

// Keycloak OIDC authorization-code + PKCE entry point.
// Phase 2 scaffold: returns 501 until the Phase 3 plan wires the realm.
// The site must build and run with KEYCLOAK_ISSUER unset (mock mode).
export async function GET() {
  if (!process.env.KEYCLOAK_ISSUER) {
    return NextResponse.json(
      {
        error: "identity_not_configured",
        message:
          "KEYCLOAK_ISSUER is not set. This build is in development mock mode.",
      },
      { status: 501 },
    );
  }

  return NextResponse.json(
    { error: "not_implemented", message: "OIDC handoff lands with Phase 3." },
    { status: 501 },
  );
}
