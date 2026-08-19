import Link from "next/link";
import { Chrome, PERSONA_LABELS } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { StatusPill } from "../components/StatusPill";
import { SCREENS } from "@/lib/screen-graph";
import { isEmployee } from "@/lib/persona";

const CERTS = [
  { name: "HACCP", expiry: "2026-12-31" },
  { name: "BRC", expiry: "2027-06-15" },
];

export default async function E3Page() {
  const persona = await readPersonaFromCookie();

  return (
    <Chrome persona={persona} title="E3 · Supplier dossier — Example Foods Pvt Ltd">
      <h1>E3 · Supplier dossier — Example Foods Pvt Ltd</h1>
      <p>
        <StatusPill status="review" />
        <span className="caption" style={{ marginLeft: 8 }}>
          risk medium · FSSC 22000
        </span>
      </p>
      <p className="caption">
        Certification names and expiry only — no vault paths. Sales cannot approve suppliers.
      </p>
      <table>
        <thead>
          <tr>
            <th>Certification</th>
            <th>Expiry</th>
          </tr>
        </thead>
        <tbody>
          {CERTS.map((cert) => (
            <tr key={cert.name}>
              <td>{cert.name}</td>
              <td>{cert.expiry}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <Link href={SCREENS.E2}>← E2 queue</Link>
        {isEmployee(persona) ? (
          <Link href={SCREENS.P1}>Peek supplier</Link>
        ) : null}
        <Link href={SCREENS.E4}>Related PO P00042 →</Link>
        {persona === "compliance" ? (
          <Link href={SCREENS.E2}>Approve in Odoo</Link>
        ) : null}
      </div>
      {persona === "sales" ? (
        <p className="caption">Sales cannot approve. Sign in as compliance.reviewer to write Odoo.</p>
      ) : null}
      <p className="caption" style={{ marginTop: 8 }}>
        Persona: {PERSONA_LABELS[persona]}
      </p>
    </Chrome>
  );
}
