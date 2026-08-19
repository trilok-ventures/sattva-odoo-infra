import Link from "next/link";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { LANDING } from "@/lib/screen-graph";
import { invoicesFor } from "@/lib/internal-fetch";

export default async function E6Page() {
  const persona = await readPersonaFromCookie();
  const invoices = await invoicesFor(persona);

  if (persona !== "finance" || invoices === null) {
    return (
      <Chrome persona={persona} title="E6 · Invoice console">
        <h1>E6 · Invoice console</h1>
        <div className="card">
          <p>Invoice console is for finance.ap only.</p>
          <Link href={LANDING[persona]}>Return to home →</Link>
        </div>
      </Chrome>
    );
  }

  return (
    <Chrome persona={persona} title="E6 · Invoice console">
      <h1>E6 · Invoice console</h1>
      <p className="caption">AMBER amounts. Finance only. Not shown to buyers.</p>
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Partner</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{row.partner_display}</td>
              <td>{row.amount_label}</td>
              <td>{row.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Chrome>
  );
}
