import { test } from "node:test";
import assert from "node:assert/strict";
import { template, validateDiagram } from "./diagram.js";
import { arrangeDiagram } from "./layout.js";
test("sequence layout gives every message its own row and aligns lifelines", async () => {
  const doc = template("sequence");
  doc.edges.push({ ...doc.edges[0], id: "extra" });
  doc.nodes[1].position.y = 270;
  const result = await arrangeDiagram(doc.mode, doc.nodes, doc.edges);
  assert.deepEqual(
    result.edges.map((e) => e.sourceHandle),
    ["s1", "s2", "s3", "s4", "s5"],
  );
  assert.ok(result.nodes.every((n) => n.position.y === 30));
  assert.equal(new Set(result.nodes.map((n) => n.position.x)).size, 3);
});
test("ER layout routes orthogonal relations between separate ports and persists routes", async () => {
  const doc = template("er");
  doc.edges.push({ ...doc.edges[0], id: "second" });
  const result = await arrangeDiagram("er", doc.nodes, doc.edges);
  assert.ok(result.nodes[0].position.x !== result.nodes[1].position.x);
  assert.notEqual(result.edges[0].sourceHandle, result.edges[1].sourceHandle);
  for (const edge of result.edges) {
    assert.ok(edge.data.route.length >= 2);
    const p = edge.data.route;
    for (let i = 1; i < p.length; i++)
      assert.ok(p[i].x === p[i - 1].x || p[i].y === p[i - 1].y);
  }
  assert.equal(validateDiagram({ ...doc, ...result }).edges[0].type, "routed");
});
