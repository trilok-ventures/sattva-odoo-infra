import Link from "next/link";
import { headers } from "next/headers";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { StatusPill } from "../components/StatusPill";
import { SCREENS } from "@/lib/screen-graph";
import type { QueueRow } from "@/lib/adapters/types";
import type { Persona } from "@/lib/persona";

async function fetchQueue(persona: Persona): Promise<QueueRow[]> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3010";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/compliance/queue`, {
    headers: { "x-sattva-persona": persona },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`queue ${res.status}`);
  const body = await res.json();
  return body.rows;
}

function dossierHref(partner: string): string {
  return partner.includes("Example Foods") ? SCREENS.E3 : SCREENS.E3;
}

export default async function E2Page() {
  const persona = await readPersonaFromCookie();
  const rows = await fetchQueue(persona);

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
