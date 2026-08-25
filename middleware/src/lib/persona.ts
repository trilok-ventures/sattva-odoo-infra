export type Persona =
  | "sales"
  | "compliance"
  | "finance"
  | "it"
  | "logistics"
  | "buyer"
  | "supplier";

const ALL: Persona[] = [
  "sales",
  "compliance",
  "finance",
  "it",
  "logistics",
  "buyer",
  "supplier",
];

export function parsePersona(raw: string | null): Persona | null {
  if (!raw) return null;
  return (ALL as string[]).includes(raw) ? (raw as Persona) : null;
}

export function personaFromSearch(
  raw: string | string[] | undefined,
  fallback: Persona = "buyer",
): Persona {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return parsePersona(value ?? null) ?? fallback;
}

export function isEmployee(p: Persona): boolean {
  return (
    p === "sales" ||
    p === "compliance" ||
    p === "finance" ||
    p === "it" ||
    p === "logistics"
  );
}
