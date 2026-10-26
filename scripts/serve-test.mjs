// A small local server for testing the production build without a second Vite process.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
export function serveBuild(base = "/", port = 4173) {
  const server = createServer(async (req, res) => {
    try {
      const requestPath = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (!requestPath.startsWith(base)) {
        res.writeHead(404).end();
        return;
      }
      const pathname = "/" + requestPath.slice(base.length);
      const file = resolve(
        root,
        `.${pathname === "/" ? "/index.html" : pathname}`,
      );
      if (!file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const content = await readFile(file);
      res
        .writeHead(200, {
          "Content-Type": types[extname(file)] || "application/octet-stream",
        })
        .end(content);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () => resolve(server)),
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await serveBuild();
