import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "../components/Chrome";
import { DocumentUploadForm } from "../components/DocumentUploadForm";
import { readPersonaFromCookie } from "../components/StubScreen";
import { LANDING, SCREENS } from "@/lib/screen-graph";

export default async function P2Page() {
  const persona = await readPersonaFromCookie();

  if (persona !== "supplier") {
    redirect(LANDING[persona]);
  }

  return (
    <Chrome persona={persona} title="P2 · Document upload">
      <h1>P2 · Document upload</h1>
      <p className="caption">
        Metadata only — filename and SHA-256. POST /api/documents with JSON (no file bytes on this form).
      </p>
      <DocumentUploadForm />
      <p style={{ marginTop: 16 }}>
        <Link href={SCREENS.P1}>← P1 home</Link>
      </p>
    </Chrome>
  );
}
