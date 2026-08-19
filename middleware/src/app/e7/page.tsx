import Link from "next/link";
import { headers } from "next/headers";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { LANDING } from "@/lib/screen-graph";
import type { Reach } from "@/lib/fabric";

type HealthBody = {
  ok: boolean;
  service: string;
  fabric: {
    mode: "mock" | "live";
    odoo: Reach;
    n8n: Reach;
  };
};

async function fetchHealth(): Promise<HealthBody | null> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3010";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/health`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

function reachLabel(reach: Reach): string {
  return reach;
}

export default async function E7Page() {
  const persona = await readPersonaFromCookie();

  if (persona !== "it") {
    return (
      <Chrome persona={persona} title="E7 · Health">
        <h1>E7 · Health</h1>
        <div className="card">
          <p>Health dashboard is for it.admin only.</p>
          <Link href={LANDING[persona]}>Return to home →</Link>
        </div>
      </Chrome>
    );
  }

  const health = await fetchHealth();

  return (
    <Chrome persona={persona} title="E7 · Health">
      <h1>E7 · Health</h1>
      <p className="caption">
        IT only. n8n queue, webhook failures, reachability. No business records.
      </p>
      <ul className="caption">
        <li>THIS PRODUCT — BFF edge (GREEN JSON only)</li>
        <li>Odoo SoR — operational records</li>
        <li>upload origin (Phase 3) — RED file mint</li>
      </ul>
      {health ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          <div className="card">
            <div className="caption">fabric.odoo</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{reachLabel(health.fabric.odoo)}</div>
          </div>
          <div className="card">
            <div className="caption">fabric.n8n</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{reachLabel(health.fabric.n8n)}</div>
          </div>
          <div className="card">
            <div className="caption">Overall</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{health.ok ? "ok" : "degraded"}</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <p>Health probe unavailable.</p>
        </div>
      )}
    </Chrome>
  );
}
