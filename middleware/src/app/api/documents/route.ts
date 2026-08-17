import { getAdapter } from "@/lib/adapters";
import { forbid, greenJson, readPersona } from "@/lib/http";

export const dynamic = "force-dynamic";

type Body = { filename?: unknown; sha256?: unknown };

const ALLOWED_KEYS = new Set(["filename", "sha256"]);

export async function POST(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  if (auth.persona !== "supplier" && auth.persona !== "buyer") {
    return forbid("Only buyer and supplier personas may mint an origin upload URL.");
  }
  let body: Body;
  try {
    const parsed = (await req.json()) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      Object.keys(parsed).some((key) => !ALLOWED_KEYS.has(key))
    ) {
      return greenJson({ error: "unexpected_document_metadata" }, 400);
    }
    body = parsed as Body;
  } catch {
    return greenJson({ error: "invalid_json" }, 400);
  }
  const rawName = typeof body.filename === "string" ? body.filename : "";
  if (/[\\/]/.test(rawName) || rawName.includes("..")) {
    return greenJson({ error: "invalid_filename", message: "Filename must not contain a path." }, 400);
  }
  const filename = rawName.slice(0, 255);
  const sha256 = typeof body.sha256 === "string" ? body.sha256.slice(0, 64) : "";
  if (!filename || !/^[a-f0-9]{64}$/i.test(sha256)) {
    return greenJson({ error: "filename_and_sha256_required" }, 400);
  }
  const receipt = await getAdapter().storeDocument(auth.persona, filename, sha256.toLowerCase());
  return greenJson(receipt);
}
