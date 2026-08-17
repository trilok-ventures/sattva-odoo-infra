import { getAdapter } from "@/lib/adapters";
import { greenJson, readPersona } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  const activities = await getAdapter().activities(auth.persona);
  return greenJson({ activities });
}
