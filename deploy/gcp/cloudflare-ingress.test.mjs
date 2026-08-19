#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));
const fixture = readFileSync(join(ROOT, "cloudflare-ips-v4.fixture"), "utf8");
const parsed = fixture
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => /^[0-9]/.test(line));
if (parsed.length < 10) {
  console.error("fixture should list many Cloudflare IPv4 CIDRs");
  process.exit(1);
}
if (!parsed.includes("173.245.48.0/20")) {
  console.error("fixture missing well-known Cloudflare range");
  process.exit(1);
}

const script = readFileSync(join(ROOT, "cloudflare-ingress.sh"), "utf8");
if (!script.includes("35.235.240.0/20")) {
  console.error("IAP source range missing");
  process.exit(1);
}
if (!script.includes("allow-cloudflare-http") || !script.includes("tcp:80,tcp:443")) {
  console.error("Cloudflare HTTP rule missing");
  process.exit(1);
}
const forbiddenTls = "client" + "_" + "auth";
const forbiddenCa = "Private" + "CA";
if (script.includes(forbiddenTls) || script.includes(forbiddenCa)) {
  console.error("T2 markers in ingress script");
  process.exit(1);
}
if (!script.includes("deny-public-ssh") || !script.includes("--action=DENY")) {
  console.error("public SSH deny rule missing");
  process.exit(1);
}
if (!script.includes("www.cloudflare.com/ips-v4")) {
  console.error("script must fetch the live Cloudflare IPv4 list");
  process.exit(1);
}

console.log("cloudflare ingress policy tests passed");
