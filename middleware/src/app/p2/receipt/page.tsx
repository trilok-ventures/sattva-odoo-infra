import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "../../components/Chrome";
import { readPersonaFromCookie } from "../../components/StubScreen";
import { LANDING, SCREENS } from "@/lib/screen-graph";

type Props = {
  searchParams: Promise<{ filename?: string; sha256?: string }>;
};

export default async function P2ReceiptPage({ searchParams }: Props) {
  const persona = await readPersonaFromCookie();

  if (persona !== "supplier") {
    redirect(LANDING[persona]);
  }

  const params = await searchParams;
  const filename = params.filename ?? "";
  const sha256 = params.sha256 ?? "";

  return (
    <Chrome persona={persona} title="P2R · Upload receipt">
      <h1>P2R · Upload receipt</h1>
      <p className="caption">GREEN metadata receipt — vault path is never returned to the browser.</p>
      <dl style={{ marginTop: 16 }}>
        <dt className="caption">Filename</dt>
        <dd style={{ margin: "4px 0 12px" }}>
          <code>{filename || "—"}</code>
        </dd>
        <dt className="caption">SHA-256</dt>
        <dd style={{ margin: "4px 0 12px", wordBreak: "break-all" }}>
          <code>{sha256 || "—"}</code>
        </dd>
      </dl>
      <p className="caption">Path never shown.</p>
      <p className="caption">PCP stays pending.</p>
      <p style={{ marginTop: 16 }}>
        <Link href={SCREENS.P1}>← P1 supplier home</Link>
      </p>
    </Chrome>
  );
}
