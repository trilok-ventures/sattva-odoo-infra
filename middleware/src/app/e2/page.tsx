import Link from "next/link";
import { headers } from "next/headers";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { StatusPill } from "../components/StatusPill";
import { LANDING, SCREENS } from "@/lib/screen-graph";
import type { QueueRow } from "@/lib/adapters/types";
import type { Persona } from "@/lib/persona";

async function fetchQueue(persona: Persona): Promise<QueueRow[] | null> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3010";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/compliance/queue`, {
    headers: { "x-sattva-persona": persona },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.rows;
}

function dossierHref(partner: string): string {
  return partner.includes("Example Foods") ? SCREENS.E3 : SCREENS.E3;
}

export default async function E2Page() {
  const persona = await readPersonaFromCookie();
  const rows = await fetchQueue(persona);

  if (rows === null) {
    return (
      <Chrome persona={persona} title="E2 · Compliance review queue">
        <h1>E2 · Compliance review queue</h1>
        <div className="card">
          <p>Compliance queue is for sales.exec (read) and compliance.officer.</p>
          <Link href={LANDING[persona]}>Return to home →</Link>
        </div>
      </Chrome>
    );
  }

  return (
    <Chrome persona={persona} title="E2 · Compliance review queue">
      <h1>E2 · Compliance review queue</h1>
      <p className="caption">
        <code>compliance.officer</code> approves in Odoo. Sales may open dossiers read-only.
      </p>
      <table>
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Status</th>
            <th>Evidence</th>
            <th>Age</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.partner_display}>
              <td>
                <Link href={dossierHref(row.partner_display)}>{row.partner_display}</Link>
              </td>
              <td><StatusPill status={row.status} /></td>
              <td>{row.evidence_label}</td>
              <td>{row.age_days}d</td>
              <td>
                <Link href={SCREENS.E3}>Open E3 →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Chrome>
  );
}
