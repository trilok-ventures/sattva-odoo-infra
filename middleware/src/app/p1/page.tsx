import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "../components/Chrome";
import { StatusPill } from "../components/StatusPill";
import { readPersonaFromCookie } from "../components/StubScreen";
import { isEmployee } from "@/lib/persona";
import { LANDING, SCREENS } from "@/lib/screen-graph";

export default async function P1Page() {
  const persona = await readPersonaFromCookie();

  if (persona !== "supplier" && !isEmployee(persona)) {
    redirect(LANDING[persona]);
  }

  return (
    <Chrome persona={persona} title="P1 · Supplier home">
      <h1>P1 · Supplier home</h1>
      <p className="caption">Example Foods Pvt Ltd — PCP compliance status.</p>
      <p style={{ marginTop: 12 }}>
        PCP status: <StatusPill status="pending" />
      </p>
      <p className="caption" style={{ marginTop: 8 }}>
        You cannot self-approve. Compliance reviews uploads in Odoo.
      </p>
      <p style={{ marginTop: 16 }}>
        <strong>Next:</strong> upload your document pack.
      </p>
      <p style={{ marginTop: 12 }}>
        <Link className="card" href={SCREENS.P2} style={{ display: "inline-block", textDecoration: "none" }}>
          P2 · Upload documents →
        </Link>
      </p>
      <p style={{ marginTop: 12 }}>
        <Link href={SCREENS.P3}>P3 · CAPA response →</Link>
      </p>
    </Chrome>
  );
}
