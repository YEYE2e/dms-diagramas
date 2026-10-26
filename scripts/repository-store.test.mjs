import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repositoryStore } from "./repository-store.mjs";
import { repositoryPlugin } from "./repository-store.mjs";
import { createServer } from "node:http";
import { template } from "../src/lib/diagram.js";
test("repository saves, updates and serializes concurrent diagrams without losing index entries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dms-repo-"));
  try {
    const store = repositoryStore(directory);
    const [one, two] = await Promise.all([
      store.save({ diagram: template("er") }),
      store.save({ diagram: template("sequence") }),
    ]);
    const document = JSON.parse(
      await readFile(join(directory, "public", "diagrams", one.file), "utf8"),
    );
    assert.equal(document.repositoryId, one.id);
    await store.save({
      id: one.id,
      diagram: { ...document, title: "Actualizado" },
    });
    const entries = JSON.parse(
      await readFile(
        join(directory, "public", "diagrams", "index.json"),
        "utf8",
      ),
    );
    assert.equal(entries.length, 2);
    assert.equal(entries[0].title, "Actualizado");
    assert.ok(entries.some((e) => e.id === two.id));
    await assert.rejects(
      store.save({ id: "../../escape", diagram: template("er") }),
    );
    await assert.rejects(
      store.save({
        diagram: {
          nodes: [],
          edges: [{ id: "x", source: "missing", target: "missing" }],
        },
      }),
    );
  } finally {
    assert.ok(directory.startsWith(join(tmpdir(), "dms-repo-")));
    await rm(directory, { recursive: true, force: true });
  }
});
test("local HTTP save checks origin and writes a diagram readable by static Pages", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dms-repo-"));
  let handler;
  repositoryPlugin().configureServer({
    config: { root: directory },
    middlewares: {
      use(callback) {
        handler = callback;
      },
    },
  });
  const server = createServer((req, res) =>
    handler(req, res, () => res.writeHead(404).end()),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const denied = await fetch(`${origin}/__diagrams/save`, {
      method: "POST",
      headers: {
        Origin: "https://other.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ diagram: template("er") }),
    });
    assert.equal(denied.status, 403);
    const response = await fetch(`${origin}/__diagrams/save`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ diagram: template("er") }),
    });
    assert.equal(response.status, 200);
    const entry = await response.json();
    const doc = JSON.parse(
      await readFile(join(directory, "public", "diagrams", entry.file), "utf8"),
    );
    assert.equal(doc.repositoryId, entry.id);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    assert.ok(directory.startsWith(join(tmpdir(), "dms-repo-")));
    await rm(directory, { recursive: true, force: true });
  }
});
