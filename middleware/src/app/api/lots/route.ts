import { getAdapter } from "@/lib/adapters";
import { forbid, greenJson, readPersona } from "@/lib/http";
import { publicLots } from "@/lib/lot-public";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  if (auth.persona === "supplier") {
    return forbid("Suppliers do not read lot boards.");
  }
  const lots = publicLots(await getAdapter().lots(auth.persona));
  return greenJson({ lots });
}
