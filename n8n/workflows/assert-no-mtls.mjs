#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_NAME =
  /(^|[._-])(mtls|privateca|istio|linkerd)([._-]|$)|(^|[/._-])cas([._-]|$)/i;
const FORBIDDEN_TEXT =
  /client_auth|PrivateCA|cloud\.google\.com\/service-mesh/i;
const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SCAN_DIRS = ["deploy", "middleware", "n8n", "addons", ".github"];
const SCAN_FILES = ["docker-compose.yml", "Caddyfile"];

export const SCANNER_PATH = fileURLToPath(import.meta.url);

function isScannerFile(p) {
  return p === SCANNER_PATH;
}

function walk(dir, hits) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, hits);
    else inspect(p, name, hits);
  }
}

export function inspect(p, name, hits) {
  if (FORBIDDEN_NAME.test(name) && !isScannerFile(p)) {
    hits.push(`filename ${p}`);
  }
  if (
    p.endsWith(".md") ||
    p.endsWith(".yml") ||
    p.endsWith(".yaml") ||
    p.endsWith(".tf") ||
    p.endsWith("Caddyfile") ||
    p.endsWith(".mjs")
  ) {
    const text = readFileSync(p, "utf8");
    if (FORBIDDEN_TEXT.test(text) && !isScannerFile(p)) {
      hits.push(`content ${p}`);
    }
  }
}

export function runScan(root = ROOT) {
  const hits = [];
  for (const dir of SCAN_DIRS) walk(join(root, dir), hits);
  for (const file of SCAN_FILES) {
    const path = join(root, file);
    if (file === "Caddyfile") {
      try {
        inspect(path, file, hits);
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
    } else {
      inspect(path, file, hits);
    }
  }
  return hits;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const hits = runScan();
  if (hits.length) {
    console.error(hits.join("\n"));
    process.exit(1);
  }
  console.log("no T2 mTLS implementation files in this change set policy path");
}
