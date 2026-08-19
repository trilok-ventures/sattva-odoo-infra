# Middleware Product Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Next.js BFF as clickable product screens in Figma order (S1→S2→homes, then E/B/P flows), using existing mock APIs, with no SwiftUI/iOS app.

**Architecture:** Apply the Figma multi-screen rule (scaffold navigation and sample data first, then fill screens). A `screen-graph.ts` is the ordered product map. Mock persona is a cookie copied onto `x-sattva-persona` for `/api`. Pages are App Router server components that fetch existing BFF routes. No second SoR.

**Tech Stack:** Next.js 15.1 App Router, React 19, TypeScript 5.7, existing `middleware/scripts/contract-check.mjs`.

## Global Constraints

- Product host is `app.trilokventures.org` (`middleware/`). Never retarget root `vercel.json` mocks project.
- Personas only: `sales` | `compliance` | `finance` | `it` | `logistics` | `buyer` | `supplier` (header `x-sattva-persona`; Keycloak groups `sales.exec` etc. map in UI copy only).
- Closed screens: S1–S4, E1–E7, B1–B3, P1–P3. Do not add Map as a production route.
- `confirm_anyway` is always false. No Confirm anyway control.
- RED keys in `middleware/src/lib/red-keys.json` never appear in client JSON (no `path`, `vault_path`, `nextcloud_folder_path`, `bytes`, `pdf`).
- Upload is metadata-only `{filename, sha256}`; optional `upload_url` only for `upload.trilokventures.org` or loopback. No multipart to the BFF.
- PCP stays `pending` until compliance writes Odoo; upload/CAPA must not set `approved`.
- `FABRIC_MODE=live` rejects `x-sattva-persona` (existing `http.ts`). Do not weaken.
- Buyer chrome never shows `vault.` or `n8n.` or manufacturer legal identity.
- `it` never sees P00042 / SO-1042. Unpaid invoices KPI only for `finance`. Health only for `it`.
- Fictional samples: Example Foods Pvt Ltd, Northshore Foods Inc, P00042, SO-1042. Caption Mock · not SoR.
- No `NEXT_PUBLIC_` fabric URLs. No SwiftUI / native iOS (UX §11).
- Tests: extend `middleware/scripts/contract-check.mjs`; `cd middleware && npm test`. HTTP asserts skip if port 3010 is down (existing pattern); source asserts always run.
- Tokens: `--nav #143528`, `--forest #1f4d3a`, `--sand #f7f4ef`. Typeface Inter from `fonts.googleapis.com` or system `ui-sans-serif` fallback.

## File map

- Create: `middleware/src/lib/screen-graph.ts` — ordered routes, landings, flows
- Create: `middleware/src/middleware.ts` — cookie → persona header (mock only)
- Create: `middleware/src/app/globals.css`
- Create: `middleware/src/app/components/Chrome.tsx`, `GateDialog.tsx`, `StatusPill.tsx`, `MockCaption.tsx`
- Create: `middleware/src/app/s2/page.tsx`, `s3/page.tsx`, `s4/page.tsx`
- Create: `middleware/src/app/e1/page.tsx` … `e7/page.tsx`
- Create: `middleware/src/app/b1/page.tsx`, `b2/[id]/page.tsx`, `b3/page.tsx`
- Create: `middleware/src/app/p1/page.tsx`, `p2/page.tsx`, `p2/receipt/page.tsx`, `p3/page.tsx`
- Modify: `middleware/src/app/page.tsx` (S1), `layout.tsx`
- Modify: `middleware/src/lib/adapters/types.ts`, `mock.ts` — invoices, buyer orders, supplier pack, CAPA (Tasks 5–7)
- Modify: `middleware/scripts/contract-check.mjs`
- Create: `middleware/src/app/api/invoices/route.ts` (Task 5)

---

### Task 1: Ordered screen graph and stub App Router

**Files:**
- Create: `middleware/src/lib/screen-graph.ts`
- Create: `middleware/src/middleware.ts`
- Modify: `middleware/src/app/page.tsx`
- Create: stub `page.tsx` for every screen id in the graph (title + next-link only)
- Modify: `middleware/scripts/contract-check.mjs`

**Interfaces:**
- Consumes: `Persona` from `middleware/src/lib/persona.ts`
- Produces: `SCREENS`, `LANDING`, `FLOWS`, `nextInFlow()`, `personaFromGroupLabel()`

- [ ] **Step 1: Write failing source asserts in contract-check.mjs**

Add after the existing strip asserts (before HTTP):

```javascript
import { readFileSync as readSrc } from "node:fs";
const graphSrc = readFileSync(join(root, "src/lib/screen-graph.ts"), "utf8");
assert("graph has S1 path /", graphSrc.includes('S1: "/"') || graphSrc.includes("S1: '/'"));
assert("employee flow starts S1", graphSrc.includes("employee:") && graphSrc.includes('"/e4"'));
assert("buyer flow has /b3", graphSrc.includes('"/b3"'));
assert("seller flow has /p2/receipt", graphSrc.includes('"/p2/receipt"'));
assert("no /map production route", !graphSrc.includes('"/map"'));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd middleware && npm test`  
Expected: FAIL `no such file` or FAIL graph asserts (file missing).

- [ ] **Step 3: Implement screen-graph.ts**

```typescript
import type { Persona } from "./persona";

export const SCREENS = {
  S1: "/",
  S2: "/s2",
  S3: "/s3",
  S4: "/s4",
  E1: "/e1",
  E2: "/e2",
  E3: "/e3",
  E4: "/e4",
  E5: "/e5",
  E6: "/e6",
  E7: "/e7",
  B1: "/b1",
  B2: "/b2/SO-1042",
  B3: "/b3",
  P1: "/p1",
  P2: "/p2",
  P2R: "/p2/receipt",
  P3: "/p3",
} as const;

export type ScreenId = keyof typeof SCREENS;

export const LANDING: Record<Persona, string> = {
  sales: SCREENS.E1,
  compliance: SCREENS.E2,
  finance: SCREENS.E6,
  logistics: SCREENS.E5,
  it: SCREENS.E7,
  buyer: SCREENS.B1,
  supplier: SCREENS.P1,
};

/** Ordered click paths from spec §3. Paths only. */
export const FLOWS: Record<"employee" | "buyer" | "seller", string[]> = {
  employee: [SCREENS.S1, SCREENS.S2, SCREENS.E1, SCREENS.E4, SCREENS.E3, SCREENS.S4, SCREENS.S1, SCREENS.S2, SCREENS.E2, SCREENS.E3],
  buyer: [SCREENS.S1, SCREENS.S2, SCREENS.B1, SCREENS.B2, SCREENS.B3],
  seller: [SCREENS.S1, SCREENS.S2, SCREENS.P1, SCREENS.P2, SCREENS.P2R, SCREENS.P1],
};

export function nextInFlow(flow: keyof typeof FLOWS, currentPath: string): string | null {
  const steps = FLOWS[flow];
  const i = steps.lastIndexOf(currentPath);
  if (i < 0 || i === steps.length - 1) return null;
  return steps[i + 1];
}

export const COOKIE = "sattva_persona";
```

- [ ] **Step 4: Next.js middleware copies mock cookie to API header**

`middleware/src/middleware.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parsePersona } from "@/lib/persona";
import { COOKIE } from "@/lib/screen-graph";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (process.env.FABRIC_MODE === "live") return res;
  if (!req.nextUrl.pathname.startsWith("/api")) return res;
  if (req.nextUrl.pathname === "/api/health") return res;
  if (req.headers.get("x-sattva-persona")) return res;
  const cookie = req.cookies.get(COOKIE)?.value ?? null;
  const persona = parsePersona(cookie);
  if (!persona) return res;
  const headers = new Headers(req.headers);
  headers.set("x-sattva-persona", persona);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/api/:path*"] };
```

- [ ] **Step 5: S1 page + stub pages**

S1 (`page.tsx`) posts to a tiny route or uses a server action to set cookie. Prefer a Route Handler `POST /api/session` that only works in mock:

Create `middleware/src/app/api/session/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { fabricMode } from "@/lib/fabric";
import { parsePersona } from "@/lib/persona";
import { COOKIE, LANDING } from "@/lib/screen-graph";
import { greenJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (fabricMode() === "live") {
    return greenJson({ error: "unauthorized", message: "Keycloak session required in live mode." }, 401);
  }
  const body = (await req.json().catch(() => ({}))) as { persona?: string };
  const persona = parsePersona(body.persona ?? "sales");
  if (!persona) return greenJson({ error: "unknown_persona" }, 400);
  const res = NextResponse.json({ ok: true, next: "/s2", landing: LANDING[persona] });
  res.cookies.set(COOKIE, persona, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, next: "/" });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
```

S1 lists seven mock persona buttons labelled “Phase 1 mock header · design only until Keycloak”. Primary CTA: Sign in as sales.exec. No password field.

Each stub page: `<h1>E4 · PO gate</h1>` plus `<a href={next}>Continue</a>` using `nextInFlow` where applicable, plus a link to `LANDING` for the persona.

Create stub pages at: `/s2`, `/s3`, `/s4`, `/e1`–`/e7`, `/b1`, `/b2/[id]`, `/b3`, `/p1`, `/p2`, `/p2/receipt`, `/p3`.

S2: three cards linking to `/e1`, `/b1`, `/p1` (employee uses current cookie landing if set, else `/e1`).

- [ ] **Step 6: Run tests**

`cd middleware && npm test`  
Expected: graph asserts OK; HTTP skip or pass.

- [ ] **Step 7: Commit**

```bash
git add middleware/src/lib/screen-graph.ts middleware/src/middleware.ts middleware/src/app middleware/scripts/contract-check.mjs middleware/src/app/api/session
git commit -m "feat: order BFF screens to match Figma product flows"
```

---

### Task 2: Product chrome and tokens

**Files:**
- Create: `middleware/src/app/globals.css`
- Create: `middleware/src/app/components/Chrome.tsx`
- Create: `middleware/src/app/components/MockCaption.tsx`
- Create: `middleware/src/app/components/StatusPill.tsx`
- Modify: `middleware/src/app/layout.tsx`

**Interfaces:**
- Consumes: `SCREENS`, `LANDING`, `COOKIE` from screen-graph; `Persona`
- Produces: `<Chrome persona title host="app.">{children}</Chrome>`

- [ ] **Step 1: Failing assert**

```javascript
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
assert("nav token", css.includes("#143528"));
assert("sand token", css.includes("#f7f4ef"));
assert("forest token", css.includes("#1f4d3a"));
```

- [ ] **Step 2: Run npm test — expect FAIL missing globals.css**

- [ ] **Step 3: Implement CSS + Chrome**

`globals.css`:

```css
:root {
  --nav: #143528;
  --forest: #1f4d3a;
  --sand: #f7f4ef;
  --ink: #1a1a1a;
  --muted: #5c5a56;
  --line: #e4dfd4;
  --surface: #fffcf7;
  --ok: #1f4d3a;
  --amber: #b45309;
  --rose: #9f1239;
}
html, body { margin: 0; background: var(--sand); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
a { color: var(--forest); }
.topbar { display: flex; gap: 12px; align-items: center; background: var(--nav); color: #fff; padding: 12px 16px; }
.pill { border-radius: 999px; padding: 2px 10px; font-size: 12px; }
.pill-pending { background: #fde68a; }
.pill-review { background: #fdba74; }
.pill-approved { background: #bbf7d0; }
.pill-blocked { background: #fecaca; }
.caption { color: var(--muted); font-size: 12px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
.layout { display: grid; grid-template-columns: 200px 1fr; min-height: 100vh; }
nav.side { padding: 16px; border-right: 1px solid var(--line); }
main.pad { padding: 24px; }
```

Chrome: topbar “Sattva Middleware” + `app. · GREEN edge` + persona + America/Toronto. Employee side nav: E1, E4, E3, E5, S3, S4 (no vault/n8n hostnames). Buyer/supplier nav: only their B*/P* links plus S4. Caption “Mock · not SoR”. Wrap stub pages.

Buyer/supplier Chrome must not render the strings `vault.` or `n8n.`.

- [ ] **Step 4: contract-check source assert Chrome has no vault for buyer file** — grep `Chrome.tsx` that buyer nav array does not include vault.

- [ ] **Step 5: npm test then commit**

```bash
git commit -m "feat: add Sattva portal chrome and forest/sand tokens"
```

---

### Task 3: E1 ops dashboard and E4 PO gate

**Files:**
- Modify: `middleware/src/app/e1/page.tsx`
- Modify: `middleware/src/app/e4/page.tsx`
- Create: `middleware/src/app/components/GateDialog.tsx`

**Interfaces:**
- Consumes: `GET /api/dashboard`, `GET /api/purchase/orders`, `POST /api/purchase/orders/:id/confirm`
- Produces: E1 KPI links to `/e2`, `/e4`, `/e5`; E4 confirm shows dialog with `confirm_anyway === false` and link to `/e3`

- [ ] **Step 1: HTTP asserts (run when server up)**

```javascript
assert("e4 page source has no Confirm anyway", !readFileSync(join(root, "src/app/e4/page.tsx"), "utf8").includes("Confirm anyway"));
assert("gate dialog has no anyway", !readFileSync(join(root, "src/app/components/GateDialog.tsx"), "utf8").includes("anyway"));
```

- [ ] **Step 2: FAIL then implement**

E1: fetch dashboard with cookie (server: `cookies()` + header). KPIs: Pending PCP → `/e2`, PO blocked → `/e4`, Lots → `/e5`. Hide `unpaid_invoices` unless persona finance. Hide n8n_failures unless it. Activity rows link dest.

E4: list POs. Confirm button POSTs. On 409 render GateDialog with `title`, `message`, link “View supplier compliance” → `/e3`. Never a bypass button. Approved PO P00041 can succeed (state purchase).

GateDialog props:

```typescript
export function GateDialog(props: {
  title: string;
  message: string;
  confirm_anyway: false;
  onClose: () => void;
  dossierHref: string;
})
```

- [ ] **Step 3: npm test + commit**

```bash
git commit -m "feat: wire E1 dashboard and E4 compliance gate dialog"
```

---

### Task 4: E2 queue, E3 dossier, S3 notifications, S4 profile

**Files:**
- Modify: `e2/page.tsx`, `e3/page.tsx`, `s3/page.tsx`, `s4/page.tsx`

**Interfaces:**
- Consumes: `GET /api/compliance/queue`, `GET /api/activities`
- Produces: E2 row Example Foods → `/e3`; S3 lists activities (employees only); S4 shows persona + Sign out DELETE `/api/session`

- [ ] **Step 1: Assert S3 page reads /api/activities not a local inbox store**

```javascript
const s3 = readFileSync(join(root, "src/app/s3/page.tsx"), "utf8");
assert("s3 uses activities API", s3.includes("/api/activities"));
assert("s3 not a second SoR table", !s3.includes("localStorage"));
```

- [ ] **Step 2: Implement**

E2 table: partner_display, status, evidence_label, age_days. Example Foods links `/e3`.

E3: Example Foods Pvt Ltd, status review, cert **names + expiry only** (hardcode GREEN labels: HACCP, BRC — no paths). Sales: no Approve button. Compliance: copy “Approve in Odoo” (link text only; do not POST a new SoR). Peek supplier: employees only, not a vault URL.

S3: fetch activities; empty for buyer/supplier (redirect landing). Rows link dest `/e4` `/e3` `/e5` `/e6` by dest field.

S4: persona, “no self-service role edit”, Sign out → `/`.

- [ ] **Step 3: npm test + commit**

```bash
git commit -m "feat: add compliance queue, dossier, notifications, profile"
```

---

### Task 5: E5 lots, E6 invoices, E7 health

**Files:**
- Modify: `types.ts`, `mock.ts`, `e5/page.tsx`, `e6/page.tsx`, `e7/page.tsx`
- Create: `middleware/src/app/api/invoices/route.ts`

**Interfaces:**
- Consumes: `GET /api/lots`, `GET /api/health`
- Produces: `invoices(persona): InvoiceRow[]` on FabricAdapter; finance-only route

```typescript
export type InvoiceRow = {
  id: string;
  partner_display: string;
  amount_label: string;
  state: "draft" | "posted";
};
```

Mock: INV-2218 Northshore Foods Inc USD 12,400 posted; INV-2220 Harbor Co-op USD 3,100 draft.

`GET /api/invoices`: 403 unless `finance`.

E5: GREEN moisture/mesh/hash from lots. Button “Request access (employees · vault.)” is copy only — must not fetch PDF via `/api`. No download.

E7: show health.odoo / health.n8n as mock/up/down. Must not include `trilokventures.org` in JSON (existing health contract). Page copy may list host **roles** without secrets: “THIS PRODUCT”, “Odoo SoR”, “upload origin (Phase 3)”. Do not print P00042.

- [ ] **Step 1: contract-check**

```javascript
assert("invoices 403 sales", (await httpJson("/api/invoices", { headers: { "x-sattva-persona": "sales" } })).res.status === 403);
assert("invoices 200 finance", (await httpJson("/api/invoices", { headers: { "x-sattva-persona": "finance" } })).res.status === 200);
```

- [ ] **Step 2: implement + npm test + commit**

```bash
git commit -m "feat: add lots board, finance invoices, IT health screens"
```

---

### Task 6: Buyer B1–B3

**Files:**
- Modify: `b1/page.tsx`, `b2/[id]/page.tsx`, `b3/page.tsx`
- Optional mock: buyer order timeline on lots

**Interfaces:**
- Consumes: `GET /api/lots` (buyer), `GET /api/catalogue`
- Produces: B1 card SO-1042 → `/b2/SO-1042` → B3. No `vault.` `n8n.` in those three files.

- [ ] **Step 1:**

```javascript
for (const f of ["b1/page.tsx", "b2/[id]/page.tsx", "b3/page.tsx"]) {
  const t = readFileSync(join(root, "src/app", f), "utf8");
  assert("buyer chrome no vault " + f, !t.includes("vault."));
  assert("buyer chrome no n8n " + f, !t.includes("n8n."));
}
```

- [ ] **Step 2: Implement**

B1: SO-1042 dehydrated onion 500 kg, Northshore Foods Inc, GREEN lot status.  
B2: timeline labels (contract → production → shipment → CFIA → delivered), moisture 4.8%, mesh pass, sha256. Display mill as “approved mill (demo)” not legal Example Foods as manufacturer identity.  
B3: Q-1042 filename `organic-contract-1042.pdf` + sha256 `9f2c…a81b`. Accept is a button that does not call a new SoR (copy: “Accept writes to Odoo” disabled in mock or POST later — YAGNI: link back to B2).

- [ ] **Step 3: npm test + commit**

```bash
git commit -m "feat: add buyer order, lot detail, and quotes screens"
```

---

### Task 7: Supplier P1–P3 and D10 receipt

**Files:**
- Modify: `p1/page.tsx`, `p2/page.tsx`, `p2/receipt/page.tsx`, `p3/page.tsx`

**Interfaces:**
- Consumes: `POST /api/documents` `{filename, sha256}`
- Produces: receipt page query `?filename=&sha256=`; P1 status remains `pending`

- [ ] **Step 1:**

```javascript
const p1 = readFileSync(join(root, "src/app/p1/page.tsx"), "utf8");
assert("p1 default pending", p1.includes("pending"));
assert("p1 does not self-approve", !p1.includes('approved') || p1.includes("cannot self-approve") || p1.includes("You cannot self-approve"));
const p2 = readFileSync(join(root, "src/app/p2/page.tsx"), "utf8");
assert("p2 posts metadata", p2.includes("/api/documents"));
assert("p2 no multipart", !p2.includes("FormData") && !p2.includes("multipart"));
```

- [ ] **Step 2: Implement**

P1: StatusPill pending. Next: upload pack. Links `/p2` `/p3`.  
P2: filename input + sha256 input (64 hex) — metadata form, not file bytes. POST `/api/documents`. Redirect `/p2/receipt?filename=&sha256=`.  
Receipt: show filename + sha256, “Path never shown”, “PCP stays pending”. Link `/p1`.  
P3: CAPA-12 text, “does not set approved”, submit → `/p1`.

- [ ] **Step 3: npm test + commit**

```bash
git commit -m "feat: add supplier home, metadata upload receipt, and CAPA"
```

---

## Spec coverage

| Spec § | Task |
| --- | --- |
| Ordered click flows 3.1–3.3 | 1 |
| Chrome / tokens | 2 |
| E1 / E4 gate | 3 |
| E2 E3 S3 S4 | 4 |
| E5 E6 E7 | 5 |
| B1–B3 | 6 |
| P1–P3 D10 | 7 |
| No SwiftUI / no map route / two Vercel projects | 1 + constraints |
