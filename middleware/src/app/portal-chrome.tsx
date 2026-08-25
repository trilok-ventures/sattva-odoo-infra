import Link from "next/link";
import type { Persona } from "@/lib/persona";

const PERSONAS: Persona[] = [
  "buyer",
  "sales",
  "compliance",
  "finance",
  "it",
  "logistics",
  "supplier",
];

export function PortalChrome({
  persona,
  path,
}: {
  persona: Persona;
  path: string;
}) {
  return (
    <header className="top">
      <strong>Sattva Portal</strong>
      <Link href={`/?persona=${persona}`}>Home</Link>
      <Link href={`/lots?persona=${persona}`}>Lots</Link>
      <nav className="persona" aria-label="Mock persona">
        {PERSONAS.map((item) => (
          <Link
            key={item}
            href={`${path}?persona=${item}`}
            className={item === persona ? "on" : undefined}
          >
            {item}
          </Link>
        ))}
      </nav>
    </header>
  );
}
