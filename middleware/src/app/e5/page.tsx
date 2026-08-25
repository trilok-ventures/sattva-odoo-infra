import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { LANDING, SCREENS } from "@/lib/screen-graph";
import { lotsFor } from "@/lib/internal-fetch";
import { isEmployee } from "@/lib/persona";

function shortHash(hash: string): string {
  return hash.length > 8 ? `${hash.slice(0, 4)}…` : hash;
}

export default async function E5Page() {
  const persona = await readPersonaFromCookie();

  if (persona === "buyer" || persona === "supplier") {
    redirect(LANDING[persona]);
  }

  const lots = (await lotsFor(persona)) ?? [];

  return (
    <Chrome persona={persona} title="E5 · Lot verification board">
      <h1>E5 · Lot verification board</h1>
      <p className="caption">
        GREEN metrics only — moisture, mesh pass, COA hash. PDFs live on vault.; request access is audit-logged.
      </p>
      <table>
        <thead>
          <tr>
            <th>Lot</th>
            <th>SKU</th>
            <th>Moisture %</th>
            <th>Mesh</th>
            <th>COA</th>
            <th>Hash</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
            <tr key={lot.id}>
              <td>{lot.id.toUpperCase()}</td>
              <td>{lot.sku}</td>
              <td>{lot.moisture_pct}%</td>
              <td>{lot.mesh_pass ? "pass" : "fail"}</td>
              <td>{lot.coa_pass ? "pass" : "fail"}</td>
              <td>
                <code>{shortHash(lot.coa_sha256)}</code>
              </td>
              <td>
                {persona !== "it" && lot.buyer_order ? (
                  <Link href={SCREENS.B2}>Buyer GREEN view →</Link>
                ) : (
                  <Link href={SCREENS.P3}>CAPA →</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isEmployee(persona) ? (
        <p style={{ marginTop: 16 }}>
          <button type="button" className="card" style={{ cursor: "default" }}>
            Request access (employees · vault.)
          </button>
        </p>
      ) : null}
    </Chrome>
  );
}
