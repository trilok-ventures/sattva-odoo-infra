import { createHash } from "node:crypto";

export const DOSSIER_TRIGGER_ALLOWLIST = ["sale_order_id", "lot_id"];
export const DOSSIER_ENTRY_ALLOWLIST = [
  "filename",
  "sha256",
  "vault_href",
  "doc_kind",
];
export const DOC_KINDS = ["coa", "bl", "packing", "other"];
export const MAX_ENTRIES = 20;

const SHA256_RE = /^[a-f0-9]{64}$/i;

function assertObject(payload, label) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${label} required`);
  }
}

function assertBasename(filename) {
  if (typeof filename !== "string" || !filename) {
    throw new Error("filename must be a basename with no path");
  }
  if (
    filename !== filename.split("/").pop() ||
    filename.includes("\\") ||
    filename.includes("..") ||
    filename.includes("\0")
  ) {
    throw new Error("filename must be a basename with no path");
  }
}

export function inferDocKind(filename) {
  const lower = String(filename || "").toLowerCase();
  if (lower.includes("coa")) return "coa";
  if (lower.includes("packing") || lower.includes("packlist")) return "packing";
  if (
    lower.includes("lading") ||
    /(^|_|-)(bl|bol)(\.|_|-|$)/.test(lower)
  ) {
    return "bl";
  }
  return "other";
}

export function hashBytes(buf) {
  if (!Buffer.isBuffer(buf)) throw new Error("file bytes required");
  return createHash("sha256").update(buf).digest("hex");
}

export function assertDossierTrigger(payload) {
  assertObject(payload, "payload");
  for (const key of Object.keys(payload)) {
    if (!DOSSIER_TRIGGER_ALLOWLIST.includes(key)) {
      throw new Error(`unknown dossier trigger key forbidden: ${key}`);
    }
  }
  if (
    typeof payload.sale_order_id !== "number" ||
    !Number.isInteger(payload.sale_order_id) ||
    payload.sale_order_id < 1
  ) {
    throw new Error("sale_order_id must be a positive integer");
  }
  if ("lot_id" in payload) {
    if (
      typeof payload.lot_id !== "number" ||
      !Number.isInteger(payload.lot_id) ||
      payload.lot_id < 1
    ) {
      throw new Error("lot_id must be a positive integer");
    }
  }
}

function assertHref(href, orderPath, filename) {
  if (typeof orderPath !== "string" || !orderPath.endsWith("/")) {
    throw new Error("order path must be under /Clients/");
  }
  if (href !== `${orderPath}${filename}`) {
    throw new Error("vault_href must stay under the order folder");
  }
}

export function assertDossierEntries(entries, orderPath) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("entries required");
  }
  if (entries.length > MAX_ENTRIES) {
    throw new Error("too many dossier entries");
  }
  if (typeof orderPath !== "string" || !orderPath.startsWith("/Clients/")) {
    throw new Error("order path must be under /Clients/");
  }
  for (const entry of entries) {
    assertObject(entry, "entry");
    for (const key of Object.keys(entry)) {
      if (!DOSSIER_ENTRY_ALLOWLIST.includes(key)) {
        throw new Error(`unknown dossier entry key forbidden: ${key}`);
      }
      if (entry[key] != null && typeof entry[key] === "object") {
        throw new Error("nested objects forbidden");
      }
    }
    assertBasename(entry.filename);
    if (typeof entry.sha256 !== "string" || !SHA256_RE.test(entry.sha256)) {
      throw new Error("sha256 must be 64 hex characters");
    }
    assertHref(entry.vault_href, orderPath, entry.filename);
    if ("doc_kind" in entry && !DOC_KINDS.includes(entry.doc_kind)) {
      throw new Error("unknown doc_kind");
    }
  }
}

export function parsePropfind(xml, orderPath) {
  if (typeof xml !== "string" || !xml) throw new Error("PROPFIND body required");
  if (typeof orderPath !== "string" || !orderPath.startsWith("/Clients/")) {
    throw new Error("order path must be under /Clients/");
  }
  const listed = [];
  const blocks = xml.split(/<d:response[\s>]/i).slice(1);
  for (const block of blocks) {
    if (/<d:collection\s*\/>/i.test(block) || /<d:collection>/i.test(block)) {
      continue;
    }
    const hrefMatch = block.match(/<d:href>([^<]+)<\/d:href>/i);
    if (!hrefMatch) continue;
    const href = decodeURIComponent(hrefMatch[1]);
    const marker = orderPath;
    const idx = href.indexOf(marker);
    if (idx < 0) continue;
    const rel = href.slice(idx + marker.length);
    if (!rel || rel.endsWith("/")) continue;
    const filename = rel.split("/").pop();
    try {
      assertBasename(filename);
    } catch {
      continue;
    }
    listed.push({ filename, vault_href: `${orderPath}${filename}` });
    if (listed.length >= MAX_ENTRIES) break;
  }
  return listed;
}
