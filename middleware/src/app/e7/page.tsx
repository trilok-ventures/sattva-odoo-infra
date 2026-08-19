import Link from "next/link";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { LANDING } from "@/lib/screen-graph";
import { fabricHealth } from "@/lib/adapters";
import { isHealthy, type Reach } from "@/lib/fabric";

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

  const fabric = await fabricHealth();
  const health = { ok: isHealthy(fabric.odoo) && isHealthy(fabric.n8n), fabric };

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
    </Chrome>
  );
}
