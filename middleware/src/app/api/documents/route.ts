import { getAdapter } from "@/lib/adapters";
import { forbid, greenJson, readPersona } from "@/lib/http";

export const dynamic = "force-dynamic";

type Body = { filename?: string; sha256?: string; path?: string };

export async function POST(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  if (auth.persona !== "supplier" && auth.persona !== "buyer") {
    return forbid("Only buyer and supplier personas may mint an origin upload URL.");
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return greenJson({ error: "invalid_json" }, 400);
  }
  if (body.path) {
    return greenJson(
      { error: "storage_path_not_accepted", message: "Client must not send a storage path." },
      400,
    );
  }
  const rawName = body.filename || "";
  if (/[\\/]/.test(rawName) || rawName.includes("..")) {
    return greenJson({ error: "invalid_filename", message: "Filename must not contain a path." }, 400);
  }
  const filename = rawName.slice(0, 255);
  const sha256 = (body.sha256 || "").slice(0, 64);
  if (!filename || !/^[a-f0-9]{64}$/i.test(sha256)) {
    return greenJson({ error: "filename_and_sha256_required" }, 400);
  }
  const receipt = await getAdapter().storeDocument(auth.persona, filename, sha256.toLowerCase());
  return greenJson(receipt);
}
