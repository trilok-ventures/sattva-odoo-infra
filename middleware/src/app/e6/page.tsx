import Link from "next/link";
import { headers } from "next/headers";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { LANDING } from "@/lib/screen-graph";
import type { InvoiceRow } from "@/lib/adapters/types";
import type { Persona } from "@/lib/persona";

async function fetchInvoices(persona: Persona): Promise<InvoiceRow[] | null> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3010";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/invoices`, {
    headers: { "x-sattva-persona": persona },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.invoices;
}

export default async function E6Page() {
  const persona = await readPersonaFromCookie();
  const invoices = await fetchInvoices(persona);

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
