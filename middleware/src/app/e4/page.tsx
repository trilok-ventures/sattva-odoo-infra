import { headers } from "next/headers";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import type { PurchaseOrder } from "@/lib/adapters/types";
import type { Persona } from "@/lib/persona";
import { PoGateClient } from "./PoGateClient";

async function fetchOrders(persona: Persona): Promise<PurchaseOrder[]> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3010";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/purchase/orders`, {
    headers: { "x-sattva-persona": persona },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`orders ${res.status}`);
  const body = await res.json();
  return body.orders;
}

export default async function E4Page() {
  const persona = await readPersonaFromCookie();
  const orders = await fetchOrders(persona);

  return (
    <Chrome persona={persona} title="E4 · PO gate console">
      <h1>E4 · PO gate console</h1>
      <p className="caption">
        Confirm calls Odoo <code>button_confirm</code>. The gate is never bypassable.
      </p>
      <PoGateClient initialOrders={orders} />
    </Chrome>
  );
}
