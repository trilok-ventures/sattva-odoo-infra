import { persistFields } from "./coa-ocr-green.mjs";

export const SIDECAR_SUFFIX = ".green.json";
export const MAX_SIDECAR_BYTES = 8192;
export const SIDECAR_TRIGGER_ALLOWLIST = ["lot_id", "sidecar_basename"];

function assertBasename(name) {
  if (typeof name !== "string" || !name) {
    throw new Error("filename must be a basename with no path");
  }
  if (name.includes("/") || name.includes("\\") || name.includes("..") || name.includes("\0")) {
    throw new Error("filename must be a basename with no path");
  }
}

export function pdfBasenameFromSidecar(sidecarBasename) {
  if (typeof sidecarBasename !== "string" || !sidecarBasename.endsWith(SIDECAR_SUFFIX)) {
    throw new Error("sidecar_basename must end with .green.json");
  }
  const stem = sidecarBasename.slice(0, -SIDECAR_SUFFIX.length);
  assertBasename(stem);
  return stem;
}

export function assertSidecarBasename(name) {
  assertBasename(name);
  if (!name.endsWith(SIDECAR_SUFFIX) || name.endsWith(".pdf")) {
    throw new Error("sidecar_basename must end with .green.json");
  }
  pdfBasenameFromSidecar(name);
  return name;
}

export function assertSidecarTrigger(payload) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload required");
  }
  for (const key of Object.keys(payload)) {
    if (!SIDECAR_TRIGGER_ALLOWLIST.includes(key)) {
      throw new Error("unknown sidecar trigger key forbidden: " + key);
    }
  }
  if (typeof payload.lot_id !== "number" || !Number.isInteger(payload.lot_id) || payload.lot_id < 1) {
    throw new Error("lot_id must be a positive integer");
  }
  if (!("sidecar_basename" in payload)) {
    throw new Error("sidecar_basename required");
  }
  assertSidecarBasename(payload.sidecar_basename);
}

export function assertSidecarHref(href, folderPath, sidecarBasename) {
  assertSidecarBasename(sidecarBasename);
  if (
    typeof folderPath !== "string" ||
    !folderPath.startsWith("/Suppliers/") ||
    !folderPath.includes("/Certificates/") ||
    !folderPath.endsWith("/") ||
    folderPath.includes("..")
  ) {
    throw new Error("sidecar folder must be under /Suppliers/{name}/Certificates/");
  }
  if (typeof href !== "string" || !href.endsWith(SIDECAR_SUFFIX) || href.endsWith(".pdf")) {
    throw new Error("vault_href must end with .green.json");
  }
  if (href !== folderPath + sidecarBasename) {
    throw new Error("vault_href must stay under the supplier Certificates folder");
  }
}

export function parseSidecarBytes(buf, trigger) {
  assertSidecarTrigger(trigger);
  if (!Buffer.isBuffer(buf)) {
    throw new Error("sidecar bytes required");
  }
  if (buf.length > MAX_SIDECAR_BYTES) {
    throw new Error("sidecar too large");
  }
  if (buf.length >= 4 && buf.subarray(0, 4).toString("latin1") === "%PDF") {
    throw new Error("RED PDF payload forbidden");
  }
  if (buf.includes(0)) {
    throw new Error("RED binary payload forbidden");
  }
  let payload;
  try {
    payload = JSON.parse(buf.toString("utf8"));
  } catch {
    throw new Error("sidecar must be GREEN JSON");
  }
  const persist = persistFields(payload);
  if (persist.lot_id !== trigger.lot_id) {
    throw new Error("lot_id mismatch");
  }
  if (persist.filename !== pdfBasenameFromSidecar(trigger.sidecar_basename)) {
    throw new Error("filename mismatch");
  }
  return persist;
}
