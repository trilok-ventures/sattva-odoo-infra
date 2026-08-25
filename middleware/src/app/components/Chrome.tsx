import Link from "next/link";
import type { ReactNode } from "react";
import { SCREENS } from "@/lib/screen-graph";
import { isEmployee, type Persona } from "@/lib/persona";
import { MockCaption } from "./MockCaption";

export const PERSONA_LABELS: Record<Persona, string> = {
  sales: "sales.exec",
  compliance: "compliance.reviewer",
  finance: "finance.ap",
  logistics: "logistics.coord",
  it: "it.admin",
  buyer: "buyer.northshore",
  supplier: "supplier.example",
};

const EMPLOYEE_NAV = [
  { label: "E1", href: SCREENS.E1 },
  { label: "E4", href: SCREENS.E4 },
  { label: "E3", href: SCREENS.E3 },
  { label: "E5", href: SCREENS.E5 },
  { label: "S3", href: SCREENS.S3 },
  { label: "S4", href: SCREENS.S4 },
];

export const BUYER_NAV = [
  { label: "B1", href: SCREENS.B1 },
  { label: "B2", href: SCREENS.B2 },
  { label: "B3", href: SCREENS.B3 },
  { label: "S4", href: SCREENS.S4 },
];

const SUPPLIER_NAV = [
  { label: "P1", href: SCREENS.P1 },
  { label: "P2", href: SCREENS.P2 },
  { label: "P3", href: SCREENS.P3 },
  { label: "S4", href: SCREENS.S4 },
];

function navForPersona(persona: Persona) {
  if (isEmployee(persona)) return EMPLOYEE_NAV;
  if (persona === "buyer") return BUYER_NAV;
  return SUPPLIER_NAV;
}

export function Chrome({
  persona,
  title,
  host = "app.",
  children,
}: {
  persona: Persona;
  title: string;
  host?: string;
  children: ReactNode;
}) {
  const nav = navForPersona(persona);

  return (
    <>
      <header className="topbar">
        <strong>Sattva Middleware</strong>
        <span>
          {host} · GREEN edge
        </span>
        <span>{PERSONA_LABELS[persona]}</span>
        <span style={{ marginLeft: "auto" }}>America/Toronto</span>
        <span className="caption" style={{ color: "#c5ddd0" }}>
          {title}
        </span>
      </header>
      <div className="layout">
        <nav className="side" aria-label="Screen navigation">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="pad">
          <MockCaption />
          {children}
        </main>
      </div>
    </>
  );
}
