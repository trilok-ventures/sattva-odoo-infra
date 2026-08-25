import { getAdapter } from "@/lib/adapters";
import { fabricMode } from "@/lib/fabric";
import {
  coaCompareLabel,
  saleStatusLabel,
  truncateHash,
} from "@/lib/lot-status";
import { publicLots } from "@/lib/lot-public";
import { personaFromSearch } from "@/lib/persona";
import { PortalChrome } from "../../portal-chrome";

export const dynamic = "force-dynamic";

export default async function LotDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
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
  const { id } = await params;
  if (persona === "supplier") {
    return (
      <>
        <PortalChrome persona={persona} path={`/lots/${id}`} />
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
  const lot = lots.find((row) => row.id === id);
  if (!lot) {
    return (
      <>
        <PortalChrome persona={persona} path={`/lots/${id}`} />
        <main>
          <h1>Lot not found</h1>
          <p className="muted">No GREEN lot {id} for this persona.</p>
          <p>
            <a href={`/lots?persona=${persona}`}>Back to lots</a>
          </p>
        </main>
      </>
    );
  }
  return (
    <>
      <PortalChrome persona={persona} path={`/lots/${id}`} />
      <main>
        <p className="muted">
          <a href={`/lots?persona=${persona}`}>B1 Lots</a> · B2 {lot.id.toUpperCase()}
        </p>
        <h1>
          {lot.buyer_order ?? "Lot"} · {lot.sku}
        </h1>
        <p>
          <span className={`pill ${lot.state}`}>{saleStatusLabel(lot.state)}</span>{" "}
          <span className="pill">{coaCompareLabel(lot.coa_pass)}</span>
        </p>
        <div className="banner">
          Officer release is independent of COA compare. A compare pass in
          quarantine is not available-for-sale.
        </div>
        <div className="metrics">
          <div>Moisture {lot.moisture_pct}%</div>
          <div>Mesh {lot.mesh_pass ? "pass" : "fail"}</div>
          <div>Salmonella {lot.salmonella_absent ? "absent" : "present"}</div>
          <div>TPC {lot.tpc_cfu} CFU/g</div>
          <div>Pyruvic {lot.pyruvic_umol} µmol/g</div>
          <div>COA on file {lot.coa_present ? "yes" : "no"}</div>
        </div>
        <p className="hash">GREEN hash {truncateHash(lot.coa_sha256)}</p>
        <p className="muted">
          No vault path, no PDF bytes, no download. Files stay in the vault.
        </p>
      </main>
    </>
  );
}
