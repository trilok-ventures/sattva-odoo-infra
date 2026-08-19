import { getAdapter } from "@/lib/adapters";
import { forbid, greenJson, readPersona } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  if (auth.persona !== "finance") {
    return forbid("Invoices are finance-only.");
  }
  const invoices = await getAdapter().invoices(auth.persona);
  return greenJson({ invoices });
}
