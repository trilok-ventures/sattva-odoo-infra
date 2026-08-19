import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { LANDING, SCREENS } from "@/lib/screen-graph";
import type { LotGreen } from "@/lib/adapters/types";
import type { Persona } from "@/lib/persona";

const ORDER_ID = "SO-1042";
const BUYER_NAME = "Northshore Foods Inc";

async function fetchLots(persona: Persona): Promise<LotGreen[]> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3010";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/lots`, {
    headers: { "x-sattva-persona": persona },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`lots ${res.status}`);
  const body = await res.json();
  return body.lots;
}

export default async function B1Page() {
  const persona = await readPersonaFromCookie();

  if (persona !== "buyer") {
    redirect(LANDING[persona]);
  }

  const lots = await fetchLots(persona);
  const lot = lots.find((row) => row.buyer_order === ORDER_ID);

  return (
    <Chrome persona={persona} title="B1 · Orders">
      <h1>B1 · Orders</h1>
      <p className="caption">
        {BUYER_NAME} — own orders. GREEN status only.
      </p>
      <Link className="card" href={`/b2/${ORDER_ID}`} style={{ display: "block", textDecoration: "none" }}>
        <div style={{ fontWeight: 600 }}>
          {ORDER_ID} · dehydrated onion 500 kg
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
          Lot {lot ? lot.id.toUpperCase() : "L-882"} ·{" "}
          <span className="pill pill-approved">GREEN</span>
        </div>
        <p className="caption" style={{ margin: "8px 0 0" }}>
          Expected window 12–18 Sep
        </p>
        <span className="caption">Open B2 detail →</span>
      </Link>
      <p style={{ marginTop: 16 }}>
        <Link href={SCREENS.B3}>B3 Quotes &amp; contracts →</Link>
      </p>
    </Chrome>
  );
}
