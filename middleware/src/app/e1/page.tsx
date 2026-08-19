import Link from "next/link";
import { headers } from "next/headers";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { SCREENS } from "@/lib/screen-graph";
import type { Dashboard } from "@/lib/adapters/types";
import type { Persona } from "@/lib/persona";

async function fetchDashboard(persona: Persona): Promise<Dashboard> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3010";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/dashboard`, {
    headers: { "x-sattva-persona": persona },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`dashboard ${res.status}`);
  return res.json();
}

function destHref(dest: string): string {
  return dest.startsWith("/") ? dest : `/${dest}`;
}

export default async function E1Page() {
  const persona = await readPersonaFromCookie();
  const data = await fetchDashboard(persona);

  return (
    <Chrome persona={persona} title="E1 · Ops dashboard">
      <h1>E1 · Ops dashboard</h1>
      <p className="caption">Today at a glance. KPI cards link to employee screens — no CRM state stored here.</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Link className="card" href={SCREENS.E2}>
          <div className="caption">Pending PCP reviews</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{data.pending_pcp_reviews}</div>
          <span className="caption">Open E2 queue →</span>
        </Link>
        <Link className="card" href={SCREENS.E4}>
          <div className="caption">PO confirms blocked</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{data.po_confirms_blocked}</div>
          <span className="caption">Open E4 gate →</span>
        </Link>
        <Link className="card" href={SCREENS.E5}>
          <div className="caption">Lots in quarantine</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{data.lots_in_quarantine}</div>
          <span className="caption">Open E5 board →</span>
        </Link>
        {persona === "finance" && data.unpaid_invoices !== undefined ? (
          <Link className="card" href={SCREENS.E6}>
            <div className="caption">Unpaid invoices</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{data.unpaid_invoices}</div>
            <span className="caption">Open E6 →</span>
          </Link>
        ) : null}
        {persona === "it" && data.n8n_failures !== undefined ? (
          <Link className="card" href={SCREENS.E7}>
            <div className="caption">n8n failures</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{data.n8n_failures}</div>
            <span className="caption">Open E7 health →</span>
          </Link>
        ) : null}
      </div>
      <h2>Fabric activity</h2>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Event</th>
            <th>Jump</th>
          </tr>
        </thead>
        <tbody>
          {data.activity.map((row) => (
            <tr key={`${row.at}-${row.label}`}>
              <td>{row.at} ET</td>
              <td>{row.label}</td>
              <td>
                <Link href={destHref(row.dest)}>{row.dest.toUpperCase()} →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Chrome>
  );
}
