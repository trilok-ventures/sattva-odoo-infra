import { fabricMode } from "@/lib/fabric";
import { personaFromSearch } from "@/lib/persona";
import { PortalChrome } from "./portal-chrome";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  if (fabricMode() === "live") {
    return (
      <main>
        <h1>Unauthorized</h1>
        <p>Keycloak session required in live mode.</p>
      </main>
    );
  }
  const persona = personaFromSearch((await searchParams).persona);
  return (
    <>
      <PortalChrome persona={persona} path="/" />
      <main>
        <h1>Sattva Middleware Portal</h1>
        <p className="muted">
          Operations BFF (GREEN edge). Fabric calls stay on the server. Default
          FABRIC_MODE=mock. Live mode returns 401 until Keycloak. HTML twin
          stays on a separate Vercel project:
          https://sattva-odoo-infra.vercel.app/
        </p>
        <p>
          Health: <a href="/api/health">/api/health</a>
        </p>
        <p>
          Buyer GREEN lots:{" "}
          <a href={`/lots?persona=${persona === "supplier" ? "buyer" : persona}`}>
            B1 lots
          </a>
        </p>
      </main>
    </>
  );
}
