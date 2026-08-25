export const COA_GREEN_ALLOWLIST = [
  "lot_id",
  "filename",
  "sha256",
  "moisture_pct",
  "mesh_pass",
  "spec_moisture_max",
  "spec_mesh_required",
  "salmonella_absent",
  "spec_salmonella_required",
  "tpc_cfu",
  "spec_tpc_max",
  "pyruvic_umol",
  "spec_pyruvic_required",
  "spec_pyruvic_min",
];

export const HF_GREEN_ALLOWLIST = [
  "sha256",
  "moisture_pct",
  "mesh_pass",
  "spec_moisture_max",
  "spec_mesh_required",
  "salmonella_absent",
  "spec_salmonella_required",
  "tpc_cfu",
  "spec_tpc_max",
  "pyruvic_umol",
  "spec_pyruvic_required",
  "spec_pyruvic_min",
];

export const RED_FORBIDDEN = [
  "bytes",
  "pdf",
  "path",
  "file_bytes",
  "nextcloud_folder_path",
  "vault_href",
];

const HF_ROUTER = "https://router.huggingface.co/hf-inference/models/";

function assertHfModel(model) {
  if (typeof model !== "string" || !model) {
    throw new Error("HF model required");
  }
  if (model.includes("..") || model.includes("\\") || model.includes("\0") || model.includes("://")) {
    throw new Error("HF model path forbidden");
  }
  return model.replace(/^\/+/, "");
}

const NUMBER_KEYS = [
  "moisture_pct",
  "spec_moisture_max",
  "tpc_cfu",
  "spec_tpc_max",
  "pyruvic_umol",
  "spec_pyruvic_min",
];

const BOOL_KEYS = [
  "mesh_pass",
  "spec_mesh_required",
  "salmonella_absent",
  "spec_salmonella_required",
  "spec_pyruvic_required",
];

function assertBasename(name) {
  if (typeof name !== "string" || !name) {
    throw new Error("filename must be a basename with no path");
  }
  if (name.includes("/") || name.includes("\\") || name.includes("..") || name.includes("\0")) {
    throw new Error("filename must be a basename with no path");
  }
}

function assertScalarMap(payload, allowed) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload required");
  }
  for (const key of Object.keys(payload)) {
    if (RED_FORBIDDEN.includes(key)) {
      throw new Error("RED COA key forbidden: " + key);
    }
    if (key === "ocr_source") continue;
    if (!allowed.includes(key)) {
      throw new Error("unknown COA key forbidden: " + key);
    }
    if (payload[key] != null && typeof payload[key] === "object") {
      throw new Error("nested objects forbidden");
    }
  }
}

function assertMetricTypes(payload) {
  if (typeof payload.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(payload.sha256)) {
    throw new Error("sha256 must be 64 hex characters");
  }
  for (const numKey of NUMBER_KEYS) {
    if (typeof payload[numKey] !== "number" || !Number.isFinite(payload[numKey])) {
      throw new Error(numKey + " must be a number");
    }
  }
  for (const boolKey of BOOL_KEYS) {
    if (typeof payload[boolKey] !== "boolean") {
      throw new Error(boolKey + " must be boolean");
    }
  }
}

function copyAllowlist(payload, keys) {
  const out = {};
  for (const key of keys) {
    out[key] = key === "sha256" ? String(payload.sha256).toLowerCase() : payload[key];
  }
  return out;
}

export function assertGreenCoa(payload) {
  assertScalarMap(payload, COA_GREEN_ALLOWLIST);
  if (typeof payload.lot_id !== "number" || !Number.isInteger(payload.lot_id) || payload.lot_id < 1) {
    throw new Error("lot_id must be a positive integer");
  }
  assertBasename(payload.filename);
  assertMetricTypes(payload);
  return payload;
}

export function persistFields(classified) {
  const row = { ...classified };
  delete row.ocr_source;
  assertGreenCoa(row);
  return copyAllowlist(row, COA_GREEN_ALLOWLIST);
}

export function toHfInputs(payload) {
  const persist = persistFields(payload);
  return copyAllowlist(persist, HF_GREEN_ALLOWLIST);
}

function parseHfGreen(body) {
  let candidate = body;
  if (Array.isArray(body) && body[0] && typeof body[0].generated_text === "string") {
    candidate = JSON.parse(body[0].generated_text);
  } else if (body && typeof body.generated_text === "string") {
    candidate = JSON.parse(body.generated_text);
  }
  assertScalarMap(candidate, HF_GREEN_ALLOWLIST);
  assertMetricTypes(candidate);
  return copyAllowlist(candidate, HF_GREEN_ALLOWLIST);
}

export async function classifyWithOptionalHf(payload, opts = {}) {
  const persist = persistFields(payload);
  const inputs = toHfInputs(payload);
  const token = opts.token;
  const model = opts.model;
  const fetchImpl = opts.fetchImpl;
  if (typeof token !== "string" || !token || typeof model !== "string" || !model) {
    return { ...persist, ocr_source: "local" };
  }
  const fetchFn = fetchImpl || globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("fetch is required for Hugging Face GREEN inference");
  }
  const res = await fetchFn(HF_ROUTER + assertHfModel(model), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs }),
  });
  if (!res || typeof res.ok !== "boolean" || !res.ok) {
    throw new Error("hf green inference failed");
  }
  const body = await res.json();
  const green = parseHfGreen(body);
  return { ...persist, ...green, ocr_source: "hf" };
}
