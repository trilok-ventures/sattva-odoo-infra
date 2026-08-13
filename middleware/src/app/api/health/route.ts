import { NextResponse } from "next/server";

// Health endpoint for CI/uptime checks. Returns no fabric internals.
export async function GET() {
  return NextResponse.json({ ok: true, service: "sattva-middleware" });
}
