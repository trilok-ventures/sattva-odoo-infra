import Link from "next/link";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { LANDING } from "@/lib/screen-graph";
import { purchaseOrdersFor } from "@/lib/internal-fetch";
import { PoGateClient } from "./PoGateClient";

export default async function E4Page() {
  const persona = await readPersonaFromCookie();
  const orders = await purchaseOrdersFor(persona);

  if (orders === null) {
    return (
      <Chrome persona={persona} title="E4 · PO gate console">
        <h1>E4 · PO gate console</h1>
        <div className="card">
          <p>PO gate console is for sales.exec, finance.ap, and compliance.reviewer.</p>
          <Link href={LANDING[persona]}>Return to home →</Link>
        </div>
      </Chrome>
    );
  }

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
