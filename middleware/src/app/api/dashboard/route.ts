import { getAdapter } from "@/lib/adapters";
import { greenJson, readPersona } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  const data = await getAdapter().dashboard(auth.persona);
  return greenJson({ persona: auth.persona, ...data });
}
