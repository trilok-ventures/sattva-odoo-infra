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
  const onHome = path === "/";
  const onLots = path === "/lots" || path.startsWith("/lots/");
  return (
    <header className="top">
      <strong>Sattva Portal</strong>
      <nav className="primary" aria-label="Portal pages">
        <Link href={`/?persona=${persona}`} className={onHome ? "on" : undefined}>
          Home
        </Link>
        <Link
          href={`/lots?persona=${persona}`}
          className={onLots ? "on" : undefined}
        >
          Lots
        </Link>
      </nav>
      <nav className="persona" aria-label="View as persona">
        <span className="nav-label">View as</span>
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
