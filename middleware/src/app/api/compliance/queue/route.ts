import { getAdapter } from "@/lib/adapters";
import { forbid, greenJson, readPersona } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  if (auth.persona !== "compliance" && auth.persona !== "sales") {
    return forbid("Compliance queue is employee-only.");
  }
  const rows = await getAdapter().complianceQueue(auth.persona);
  return greenJson({ rows });
}
