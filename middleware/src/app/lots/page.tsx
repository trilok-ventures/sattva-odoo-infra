import { getAdapter } from "@/lib/adapters";
import { fabricMode } from "@/lib/fabric";
import {
  coaCompareLabel,
  saleStatusLabel,
  truncateHash,
} from "@/lib/lot-status";
import { publicLots } from "@/lib/lot-public";
import { personaFromSearch } from "@/lib/persona";
import { PortalChrome } from "../portal-chrome";

export const dynamic = "force-dynamic";

export default async function LotsPage({
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
  if (persona === "supplier") {
    return (
      <>
        <PortalChrome persona={persona} path="/lots" />
        <main>
          <div className="forbidden">
            <h1>Forbidden</h1>
            <p>Suppliers do not read lot boards.</p>
          </div>
        </main>
      </>
    );
  }
  const lots = publicLots(await getAdapter().lots(persona));
  return (
    <>
      <PortalChrome persona={persona} path="/lots" />
      <main>
        <h1>B1 · Lots</h1>
        <p className="muted">
          GREEN metrics and officer release only. COA compare pass is not
          available-for-sale. No vault paths or PDF bytes.
        </p>
        {lots.length === 0 ? (
          <p className="muted">No lots for this persona.</p>
        ) : (
          <div className="cards">
            {lots.map((lot) => (
              <a
                key={lot.id}
                className="card"
                href={`/lots/${lot.id}?persona=${persona}`}
              >
                <p className="muted">
                  {lot.buyer_order ?? "Unassigned"} · {lot.sku}
                </p>
                <h2>{lot.id.toUpperCase()}</h2>
                <p>
                  <span className={`pill ${lot.state}`}>
                    {saleStatusLabel(lot.state)}
                  </span>{" "}
                  <span className="pill">{coaCompareLabel(lot.coa_pass)}</span>
                </p>
                <p className="muted">
                  COA on file: {lot.coa_present ? "yes" : "no"} · hash{" "}
                  <span className="hash">{truncateHash(lot.coa_sha256)}</span>
                </p>
              </a>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
