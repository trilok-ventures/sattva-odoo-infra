export type Persona =
  | "sales"
  | "compliance"
  | "finance"
  | "it"
  | "buyer"
  | "supplier";

const ALL: Persona[] = [
  "sales",
  "compliance",
  "finance",
  "it",
  "buyer",
  "supplier",
];

export function parsePersona(raw: string | null): Persona | null {
  if (!raw) return null;
  return (ALL as string[]).includes(raw) ? (raw as Persona) : null;
}

export function isEmployee(p: Persona): boolean {
  return p === "sales" || p === "compliance" || p === "finance" || p === "it";
}
