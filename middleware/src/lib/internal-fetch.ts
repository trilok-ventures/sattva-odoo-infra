import { getAdapter } from "@/lib/adapters";
import { isEmployee, type Persona } from "@/lib/persona";
import type {
  ActivityRow,
  CatalogueCard,
  Dashboard,
  InvoiceRow,
  LotGreen,
  PurchaseOrder,
  QueueRow,
} from "@/lib/adapters/types";

/**
 * Server components must not self-fetch via `${proto}://${host}` built from the
 * inbound Host header — that header is client-controlled and a page rendered
 * behind a different edge/proxy name could be tricked into calling itself at
 * an attacker-chosen origin. Instead, call the adapter directly (persona is
 * already trusted from the session cookie) and apply the same persona rule the
 * matching /api/* route enforces. Returns null when the route's rule would
 * forbid the persona, so pages can render an access card instead of throwing.
 */

export async function dashboardFor(persona: Persona): Promise<Dashboard | null> {
  if (!isEmployee(persona)) return null;
  return getAdapter().dashboard(persona);
}

export async function purchaseOrdersFor(persona: Persona): Promise<PurchaseOrder[] | null> {
  if (persona !== "sales" && persona !== "finance" && persona !== "compliance") return null;
  return getAdapter().purchaseOrders(persona);
}

export async function complianceQueueFor(persona: Persona): Promise<QueueRow[] | null> {
  if (persona !== "compliance" && persona !== "sales") return null;
  return getAdapter().complianceQueue(persona);
}

export async function invoicesFor(persona: Persona): Promise<InvoiceRow[] | null> {
  if (persona !== "finance") return null;
  return getAdapter().invoices(persona);
}

export async function lotsFor(persona: Persona): Promise<LotGreen[] | null> {
  if (persona === "supplier") return null;
  return getAdapter().lots(persona);
}

export async function activitiesFor(persona: Persona): Promise<ActivityRow[]> {
  return getAdapter().activities(persona);
}

export async function catalogueFor(persona: Persona): Promise<CatalogueCard[]> {
  return getAdapter().catalogue(persona);
}
