import { cookies } from "next/headers";
import { LANDING, nextInFlow } from "@/lib/screen-graph";
import { isEmployee, parsePersona, type Persona } from "@/lib/persona";

type Flow = keyof typeof import("@/lib/screen-graph").FLOWS;

export async function StubScreen({
  title,
  path,
  flow,
}: {
  title: string;
  path: string;
  flow?: Flow;
}) {
  const cookieStore = await cookies();
  const persona = parsePersona(cookieStore.get("sattva_persona")?.value ?? null) ?? "sales";
  const next = flow ? nextInFlow(flow, path) : null;
  const landing = LANDING[persona];

  return (
    <main>
      <h1>{title}</h1>
      {next ? (
        <p>
          <a href={next}>Continue</a>
        </p>
      ) : null}
      <p>
        <a href={landing}>Home</a>
      </p>
    </main>
  );
}

export async function readPersonaFromCookie(): Promise<Persona> {
  const cookieStore = await cookies();
  return parsePersona(cookieStore.get("sattva_persona")?.value ?? null) ?? "sales";
}

export function employeeLanding(persona: Persona): string {
  return isEmployee(persona) ? LANDING[persona] : "/e1";
}
