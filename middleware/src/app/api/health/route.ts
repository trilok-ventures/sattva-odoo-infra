import { fabricHealth } from "@/lib/adapters";
import { isHealthy } from "@/lib/fabric";
import { greenJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const fabric = await fabricHealth();
  return greenJson({
    ok: isHealthy(fabric.odoo) && isHealthy(fabric.n8n) && isHealthy(fabric.nextcloud),
    service: "sattva-middleware",
    fabric,
  });
}
