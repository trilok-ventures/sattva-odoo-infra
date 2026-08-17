import http from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.UPLOAD_ORIGIN_PORT || 8091);
const HOST = process.env.UPLOAD_ORIGIN_HOST || "127.0.0.1";
const MAX = 100 * 1024 * 1024;

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end();
    return;
  }
  const len = Number(req.headers["content-length"] || 0);
  if (len > MAX) {
    res.writeHead(413);
    res.end();
    return;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX) {
      res.writeHead(413);
      res.end();
      return;
    }
    chunks.push(chunk);
  }
  await mkdir("/tmp/sattva-upload-origin", { recursive: true });
  await writeFile(`/tmp/sattva-upload-origin/${randomUUID()}`, Buffer.concat(chunks));
  res.writeHead(204);
  res.end();
});

server.listen(PORT, HOST, () => {
  console.log(`upload-origin listening ${HOST}:${PORT} (test-only T0 sink, not Nextcloud)`);
});
