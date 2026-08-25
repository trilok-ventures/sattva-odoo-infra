import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "../../components/Chrome";
import { readPersonaFromCookie } from "../../components/StubScreen";
import { LANDING, SCREENS } from "@/lib/screen-graph";
import { catalogueFor, lotsFor } from "@/lib/internal-fetch";

const ORDER_ID = "SO-1042";

const TIMELINE = [
  "Contract signed",
  "Production",
  "Shipment",
  "CFIA clear",
  "Delivered window",
] as const;

function shortHash(hash: string): string {
  return hash.length > 8 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash;
}

export default async function B2Page({ params }: { params: Promise<{ id: string }> }) {
  const persona = await readPersonaFromCookie();

  if (persona !== "buyer") {
    redirect(LANDING[persona]);
  }

  const { id } = await params;

  if (id !== ORDER_ID) {
    return (
      <Chrome persona={persona} title="B2 · Order detail">
        <h1>B2 · Order detail</h1>
        <div className="card">
          <p>Order {id} was not found.</p>
          <Link href={SCREENS.B1}>← Back to B1 orders</Link>
        </div>
      </Chrome>
    );
  }

  const [lots, cards] = await Promise.all([lotsFor(persona), catalogueFor(persona)]);
  const lotRows = lots ?? [];
  const lot = lotRows.find((row) => row.buyer_order === ORDER_ID);
  const onionCard = cards.find((card) => card.crop === "onion" && card.format === "flake");
  const millLabel = onionCard?.supplier_display ?? "Approved mill (demo)";

  return (
    <Chrome persona={persona} title={`B2 · Order detail ${ORDER_ID}`}>
      <h1>B2 · Order detail {ORDER_ID}</h1>
      <div
        style={{
          display: "grid",
          gap: 8,
          marginBottom: 16,
          padding: 16,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 12,
        }}
      >
        {TIMELINE.map((label, index) => (
          <div key={label}>
            {index > 0 ? "→ " : ""}
            {label}
            {label === "Production" ? ` · ${millLabel}` : ""}
          </div>
        ))}
      </div>
      {lot ? (
        <div className="card">
          <p>
            COA GREEN: moisture {lot.moisture_pct}% · mesh {lot.mesh_pass ? "pass" : "fail"} · hash{" "}
            <code>{shortHash(lot.coa_sha256)}</code>
          </p>
        </div>
      ) : null}
      <p className="caption">No vault path, no PDF bytes, no other buyers&apos; orders.</p>
      <p style={{ marginTop: 16 }}>
        <Link href={SCREENS.B1}>← B1 orders</Link>
        {" · "}
        <Link href={SCREENS.B3}>B3 Quotes &amp; contracts →</Link>
      </p>
    </Chrome>
  );
}
