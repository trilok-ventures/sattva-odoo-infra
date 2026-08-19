import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { LANDING, SCREENS } from "@/lib/screen-graph";

export default async function P3Page() {
  const persona = await readPersonaFromCookie();

  if (persona !== "supplier") {
    redirect(LANDING[persona]);
  }

  return (
    <Chrome persona={persona} title="P3 · CAPA">
      <h1>P3 · CAPA</h1>
      <p className="caption">CAPA-12 — corrective action for lot deviations.</p>
      <form action={SCREENS.P1} method="get" style={{ maxWidth: 480, marginTop: 16 }}>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span className="caption">CAPA response</span>
          <textarea
            name="capa"
            rows={6}
            placeholder="Describe root cause and corrective actions…"
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </label>
        <p className="caption" style={{ marginBottom: 12 }}>
          Submitting does not set approved — compliance reviews in Odoo.
        </p>
        <button type="submit" className="btn">
          Submit CAPA
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        <Link href={SCREENS.P1}>← P1 home</Link>
      </p>
    </Chrome>
  );
}
