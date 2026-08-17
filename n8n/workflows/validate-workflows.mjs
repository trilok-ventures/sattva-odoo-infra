#!/usr/bin/env node
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (!files.length) throw new Error("usage: validate-workflows.mjs <workflow.json...>");

for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (text.includes('saveDataSuccessExecution":"all"') || text.includes('saveDataSuccessExecution": "all"')) {
    throw new Error(`${file}: saveDataSuccessExecution all is forbidden`);
  }
  if (text.includes('saveDataErrorExecution":"all"') || text.includes('saveDataErrorExecution": "all"')) {
    throw new Error(`${file}: saveDataErrorExecution all is forbidden`);
  }
  const wf = JSON.parse(text);
  if (wf.settings?.saveDataSuccessExecution !== "none") {
    throw new Error(`${file}: settings.saveDataSuccessExecution must be none`);
  }
  if (wf.settings?.saveDataErrorExecution !== "none") {
    throw new Error(`${file}: settings.saveDataErrorExecution must be none`);
  }
  if (!Array.isArray(wf.nodes) || wf.nodes.length === 0) {
    throw new Error(`${file}: nodes required`);
  }
  for (const node of wf.nodes) {
    if (!node.id || !node.type || !node.name) {
      throw new Error(`${file}: node missing id/type/name`);
    }
  }
}
console.log("workflow validation passed");
