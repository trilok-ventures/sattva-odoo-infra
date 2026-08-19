import type { Persona } from "./persona";

export const SCREENS = {
  S1: "/",
  S2: "/s2",
  S3: "/s3",
  S4: "/s4",
  E1: "/e1",
  E2: "/e2",
  E3: "/e3",
  E4: "/e4",
  E5: "/e5",
  E6: "/e6",
  E7: "/e7",
  B1: "/b1",
  B2: "/b2/SO-1042",
  B3: "/b3",
  P1: "/p1",
  P2: "/p2",
  P2R: "/p2/receipt",
  P3: "/p3",
} as const;

export type ScreenId = keyof typeof SCREENS;

export const LANDING: Record<Persona, string> = {
  sales: SCREENS.E1,
  compliance: SCREENS.E2,
  finance: SCREENS.E6,
  logistics: SCREENS.E5,
  it: SCREENS.E7,
  buyer: SCREENS.B1,
  supplier: SCREENS.P1,
};

/** Ordered click paths from spec §3. Paths only. */
export const FLOWS: Record<"employee" | "buyer" | "seller", string[]> = {
  employee: [
    SCREENS.S1,
    SCREENS.S2,
    SCREENS.E1,
    SCREENS.E4,
    SCREENS.E3,
    SCREENS.S4,
    SCREENS.S1,
    SCREENS.S2,
    SCREENS.E2,
    SCREENS.E3,
  ],
  buyer: [SCREENS.S1, SCREENS.S2, SCREENS.B1, SCREENS.B2, SCREENS.B3],
  seller: [SCREENS.S1, SCREENS.S2, SCREENS.P1, SCREENS.P2, SCREENS.P2R, SCREENS.P1],
};

export function nextInFlow(flow: keyof typeof FLOWS, currentPath: string): string | null {
  const steps = FLOWS[flow];
  const i = steps.lastIndexOf(currentPath);
  if (i < 0 || i === steps.length - 1) return null;
  return steps[i + 1];
}

export const COOKIE = "sattva_persona";
