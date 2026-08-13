import { getAdapter } from "@/lib/adapters";
import { forbid, greenJson, readPersona } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  if (auth.persona !== "sales" && auth.persona !== "finance" && auth.persona !== "compliance") {
    return forbid("Purchase orders are not visible to this persona.");
  }
  const orders = await getAdapter().purchaseOrders(auth.persona);
  return greenJson({ orders });
}
