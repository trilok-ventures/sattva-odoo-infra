import { getAdapter } from "@/lib/adapters";
import { forbid, greenJson, readPersona } from "@/lib/http";
import { isEmployee } from "@/lib/persona";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  if (!isEmployee(auth.persona)) {
    return forbid("Ops dashboard is employee-only.");
  }
  const data = await getAdapter().dashboard(auth.persona);
  return greenJson({ persona: auth.persona, ...data });
}
