"use client";

import { useRouter } from "next/navigation";
import type { Persona } from "@/lib/persona";

const MOCK_PERSONAS: { persona: Persona; label: string }[] = [
  { persona: "sales", label: "sales.exec" },
  { persona: "compliance", label: "compliance.reviewer" },
  { persona: "finance", label: "finance.ap" },
  { persona: "logistics", label: "logistics.coord" },
  { persona: "it", label: "it.admin" },
  { persona: "buyer", label: "buyer.northshore" },
  { persona: "supplier", label: "supplier.example" },
];

export function SignInButtons() {
  const router = useRouter();

  async function signIn(persona: Persona) {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ persona }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { next?: string };
    router.push(data.next ?? "/s2");
  }

  return (
    <main>
      <h1>S1 · Sign in</h1>
      <p>Phase 1 mock header · design only until Keycloak</p>
      <p>
        <button type="button" onClick={() => signIn("sales")}>
          Sign in as sales.exec
        </button>
      </p>
      <ul>
        {MOCK_PERSONAS.map(({ persona, label }) => (
          <li key={persona}>
            <button type="button" onClick={() => signIn(persona)}>
              {label}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
