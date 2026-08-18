import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspect, SCANNER_PATH } from "./assert-no-mtls.mjs";

const tmp = mkdtempSync(join(tmpdir(), "t2-absence-"));

const badNameFile = join(tmp, "with-mtls-config.yml");
writeFileSync(badNameFile, "clean yaml");
const hitsFilename = [];
inspect(badNameFile, "with-mtls-config.yml", hitsFilename);
assert.ok(
  hitsFilename.some((h) => h.startsWith("path")),
  "expected forbidden filename hit",
);

for (const relativePath of [
  "deploy/mtls/config.yml",
  "deploy/private" + "ca/x.tf",
]) {
  const badDirectoryFile = join(tmp, relativePath);
  mkdirSync(join(badDirectoryFile, ".."), { recursive: true });
  writeFileSync(badDirectoryFile, "clean");
  const directoryHits = [];
  inspect(badDirectoryFile, relativePath, directoryHits);
  assert.ok(
    directoryHits.some((hit) => hit.startsWith("path")),
    `expected forbidden directory hit for ${relativePath}`,
  );
}

const badContent = join(tmp, "ok-name.yml");
const forbiddenToken = "client" + "_" + "auth";
writeFileSync(badContent, `tls { ${forbiddenToken} trust_pool file.pem }`);
const hitsContent = [];
inspect(badContent, "ok-name.yml", hitsContent);
assert.ok(
  hitsContent.some((h) => h.startsWith("content")),
  "expected forbidden content hit",
);

const hitsExempt = [];
inspect(SCANNER_PATH, "assert-no-mtls.mjs", hitsExempt);
assert.equal(hitsExempt.length, 0, "scanner file must be exempt");

const scannerImpostor = join(tmp, "assert-no-mtls.mjs");
writeFileSync(scannerImpostor, "clean");
const hitsImpostor = [];
inspect(scannerImpostor, "assert-no-mtls.mjs", hitsImpostor);
assert.ok(hitsImpostor.length > 0, "only the exact scanner path may be exempt");

rmSync(tmp, { recursive: true });
console.log("t2-absence-gate tests passed");
