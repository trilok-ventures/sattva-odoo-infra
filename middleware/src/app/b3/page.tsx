import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { LANDING, SCREENS } from "@/lib/screen-graph";

const QUOTE_ID = "Q-1042";
const CONTRACT_FILENAME = "organic-contract-1042.pdf";
const CONTRACT_SHA256 = "9f2c4d8e1a7b3c5061928374655eea81b";

function shortHash(hash: string): string {
  return hash.length > 8 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash;
}

export default async function B3Page() {
  const persona = await readPersonaFromCookie();

  if (persona !== "buyer") {
    redirect(LANDING[persona]);
  }

  return (
    <Chrome persona={persona} title="B3 · Quotes & contracts">
      <h1>B3 · Quotes &amp; contracts</h1>
      <p className="caption">Own documents: filename + sha256 only.</p>
      <table>
        <thead>
          <tr>
            <th>Quote</th>
            <th>Document</th>
            <th>Hash</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{QUOTE_ID}</td>
            <td>
              <code>{CONTRACT_FILENAME}</code>
            </td>
            <td>
              <code>{shortHash(CONTRACT_SHA256)}</code>
            </td>
            <td>
              <button type="button" className="card" disabled style={{ cursor: "not-allowed", opacity: 0.7 }}>
                Accept writes to Odoo
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ marginTop: 16 }}>
        <Link href={SCREENS.B2}>← Back to B2 order detail</Link>
        {" · "}
        <Link href={SCREENS.B1}>B1 orders →</Link>
      </p>
    </Chrome>
  );
}
