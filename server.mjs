import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const portArgIndex = process.argv.indexOf("--port");
const requestedPort = portArgIndex >= 0 ? Number(process.argv[portArgIndex + 1]) : Number(process.env.PORT);
const port = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 4176;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    ...headers,
  });
  res.end(body);
}

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(join(root, safePath));
  return filePath.startsWith(root) ? filePath : null;
}

const server = createServer((req, res) => {
  const filePath = resolveRequestPath(req.url || "/");
  if (!filePath) {
    send(res, 403, "Forbidden");
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, "Not found");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AI Research Paper Explainer running at http://127.0.0.1:${port}`);
});
