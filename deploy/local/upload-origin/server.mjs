import http from "node:http";
import { createHash } from "node:crypto";

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
  const hash = createHash("sha256");
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX) {
      res.writeHead(413);
      res.end();
      return;
    }
    hash.update(chunk);
  }
  console.log(`upload-origin discarded bytes=${total} sha256=${hash.digest("hex")}`);
  res.writeHead(204);
  res.end();
});

server.listen(PORT, HOST, () => {
  console.log(`upload-origin listening ${HOST}:${PORT} (test-only T0 sink, not Nextcloud)`);
});
