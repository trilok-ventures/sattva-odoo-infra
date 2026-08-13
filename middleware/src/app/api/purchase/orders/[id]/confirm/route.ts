import { getAdapter } from "@/lib/adapters";
import { forbid, greenJson, readPersona } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  if (auth.persona !== "sales") {
    return forbid("Only sales may request Odoo confirm. The gate still runs in Odoo.");
  }
  const { id } = await ctx.params;
  const result = await getAdapter().confirmOrder(auth.persona, id);
  if (!result.ok) {
    return greenJson(result, 409);
  }
  return greenJson(result);
}
