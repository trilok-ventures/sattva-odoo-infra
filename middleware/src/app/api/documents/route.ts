import { getAdapter } from "@/lib/adapters";
import { forbid, greenJson, readPersona } from "@/lib/http";

export const dynamic = "force-dynamic";

type Body = { filename?: string; sha256?: string; path?: string };

export async function POST(req: Request) {
  const auth = readPersona(req);
  if ("error" in auth) return auth.error;
  if (auth.persona !== "supplier") {
    return forbid("Only the supplier persona may upload through this BFF.");
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return greenJson({ error: "invalid_json" }, 400);
  }
  if (body.path) {
    return greenJson(
      { error: "vault_path_not_accepted", message: "The BFF chooses the Nextcloud prefix." },
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
