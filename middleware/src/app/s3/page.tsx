import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { LANDING } from "@/lib/screen-graph";
import type { ActivityRow } from "@/lib/adapters/types";
import type { Persona } from "@/lib/persona";

async function fetchActivities(persona: Persona): Promise<ActivityRow[]> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3010";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/activities`, {
    headers: { "x-sattva-persona": persona },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`activities ${res.status}`);
  const body = await res.json();
  return body.activities;
}

function activityHref(dest: string): string {
  return dest.startsWith("/") ? dest : `/${dest}`;
}

export default async function S3Page() {
  const persona = await readPersonaFromCookie();

  if (persona === "buyer" || persona === "supplier") {
    redirect(LANDING[persona]);
  }

  const activities = await fetchActivities(persona);

  return (
    <Chrome persona={persona} title="S3 · Notifications">
      <h1>S3 · Notifications</h1>
      <p className="caption">GREEN/AMBER events from Odoo activity view — not a second inbox store.</p>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Event</th>
            <th>Open</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((row) => (
            <tr key={row.id}>
              <td>{row.at} ET</td>
              <td>{row.summary}</td>
              <td>
                <Link href={activityHref(row.dest)}>{row.dest.toUpperCase()} →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Chrome>
  );
}
