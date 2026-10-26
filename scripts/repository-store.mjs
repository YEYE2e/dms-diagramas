import { mkdir, readFile, writeFile, rename, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { validateDiagram } from "../src/lib/diagram.js";
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
export function repositoryStore(root) {
  const directory = resolve(root, "public", "diagrams");
  let queue = Promise.resolve();
  async function save(input) {
    const doc = validateDiagram(input.diagram);
    const id = input.id || randomUUID();
    if (!idPattern.test(id))
      throw new Error("Identificador de archivo inválido.");
    await mkdir(directory, { recursive: true });
    if ((await lstat(directory)).isSymbolicLink())
      throw new Error("El directorio no puede ser un enlace.");
    const indexFile = join(directory, "index.json");
    let entries = [];
    try {
      entries = JSON.parse(await readFile(indexFile, "utf8"));
      if (!Array.isArray(entries)) throw new Error("Índice inválido.");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const updatedAt = new Date().toISOString();
    const stored = { ...doc, repositoryId: id, updatedAt };
    const entry = {
      id,
      title: doc.title,
      mode: doc.mode,
      updatedAt,
      file: `${id}.json`,
    };
    const next = [entry, ...entries.filter((e) => e.id !== id)];
    const temporary = join(directory, `.${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(stored, null, 2) + "\n", {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporary, join(directory, entry.file));
    const indexTemporary = join(directory, `.${randomUUID()}.tmp`);
    await writeFile(indexTemporary, JSON.stringify(next, null, 2) + "\n", {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(indexTemporary, indexFile);
    return entry;
  }
  return {
    save(input) {
      const operation = queue.then(() => save(input));
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
export function repositoryPlugin() {
  return {
    name: "local-diagram-repository",
    configureServer(server) {
      const store = repositoryStore(server.config.root);
      server.middlewares.use(async (req, res, next) => {
        const path = new URL(req.url, "http://localhost").pathname;
        if (path !== "/__diagrams/save") return next();
        const reply = (code, data) => {
          res.writeHead(code, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end(JSON.stringify(data));
        };
        if (req.method !== "POST")
          return reply(405, { error: "Método no permitido." });
        const remote = req.socket.remoteAddress;
        if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote))
          return reply(403, { error: "Solo disponible desde este equipo." });
        const hostname = new URL(`http://${req.headers.host}`).hostname;
        if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname))
          return reply(403, { error: "Host local no permitido." });
        if (
          req.headers.origin !== `http://${req.headers.host}` &&
          req.headers.origin !== `https://${req.headers.host}`
        )
          return reply(403, { error: "Origen no permitido." });
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return reply(415, { error: "Se requiere JSON." });
        try {
          const chunks = [];
          let length = 0;
          for await (const chunk of req) {
            length += chunk.length;
            if (length > 5 * 1024 * 1024)
              return reply(413, { error: "El archivo supera los 5 MB." });
            chunks.push(chunk);
          }
          const entry = await store.save(
            JSON.parse(Buffer.concat(chunks).toString("utf8")),
          );
          reply(200, entry);
        } catch (e) {
          reply(400, { error: e.message });
        }
      });
    },
  };
}
