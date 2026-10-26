import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateDiagram,
  template,
  removeSelection,
  createHistory,
} from "./diagram.js";

test("rejects dangling connections and duplicate node ids", () => {
  const doc = template("er");
  doc.edges[0].target = "missing";
  assert.throws(() => validateDiagram(doc), /conexión/i);
  const duplicate = template("er");
  duplicate.nodes.push(duplicate.nodes[0]);
  assert.throws(() => validateDiagram(duplicate), /identificador/i);
});
test("accepts legacy SQL schemas and preserves columns", () => {
  const doc = validateDiagram({
    database: "SQL",
    nodes: [
      {
        id: "a",
        type: "entity",
        position: { x: 0, y: 0 },
        data: {
          table: "users",
          columns: [{ name: "id", type: "int", key: "PK" }],
        },
      },
    ],
    edges: [],
  });
  assert.equal(doc.mode, "er");
  assert.equal(doc.nodes[0].data.columns[0].key, "PK");
});
test("deleting a node also removes its connections", () => {
  const doc = template("er");
  doc.nodes[0].selected = true;
  const result = removeSelection(doc.nodes, doc.edges);
  assert.equal(result.nodes.length, doc.nodes.length - 1);
  assert.ok(
    result.edges.every(
      (e) => e.source !== doc.nodes[0].id && e.target !== doc.nodes[0].id,
    ),
  );
});
test("history restores edits and clears redo after branching", () => {
  const h = createHistory();
  h.record("a");
  h.record("b");
  h.record("c");
  assert.equal(h.undo(), "b");
  assert.equal(h.redo(), "c");
  h.undo();
  h.record("d");
  assert.equal(h.redo(), null);
});
test("every template survives JSON round trip", () => {
  for (const mode of ["er", "sequence"]) {
    const doc = template(mode);
    assert.equal(validateDiagram(JSON.parse(JSON.stringify(doc))).mode, mode);
  }
});
test("preserves explicit and migrates legacy sequence return-message flags", () => {
  const doc = template("sequence");
  assert.deepEqual(
    doc.edges.map((edge) => edge.returnMessage),
    [false, false, true, true],
  );
  const legacy = JSON.parse(JSON.stringify(doc));
  for (const edge of legacy.edges) delete edge.returnMessage;
  const imported = validateDiagram(legacy);
  assert.deepEqual(
    imported.edges.map((edge) => edge.returnMessage),
    [false, false, true, true],
  );
  assert.equal(imported.edges[2].source, "p2");
  assert.equal(imported.edges[2].target, "p1");

  const legacyCall = {
    ...doc.edges[0],
    id: "call",
    source: "p0",
    target: "p1",
    sourceHandle: "s1",
    targetHandle: "t1",
    returnMessage: false,
    style: "",
  };
  const legacyReply = {
    ...doc.edges[2],
    id: "reply",
    source: "p0",
    target: "p1",
    sourceHandle: "s2",
    targetHandle: "t2",
  };
  delete legacyReply.returnMessage;
  const corrected = validateDiagram({
    ...doc,
    edges: [legacyCall, legacyReply],
  });
  assert.equal(corrected.edges[1].source, "p1");
  assert.equal(corrected.edges[1].target, "p0");
  assert.equal(validateDiagram(corrected).edges[1].source, "p1");

  const explicitNormalMessage = validateDiagram({
    ...doc,
    edges: doc.edges.map((edge, i) =>
      i === 0
        ? {
            ...edge,
            returnMessage: false,
            style: "stroke-dasharray: 6 4;",
          }
        : edge,
    ),
  });
  assert.equal(explicitNormalMessage.edges[0].style, "");
});
test("rejects non-finite coordinates and unsafe node types", () => {
  const doc = template("er");
  doc.nodes[0].position.x = Infinity;
  assert.throws(() => validateDiagram(doc));
  doc.nodes[0].position.x = 0;
  doc.nodes[0].type = "__proto__";
  assert.throws(() => validateDiagram(doc));
});
test("rejects connections to handles that do not exist", () => {
  const doc = template("sequence");
  doc.edges[0].sourceHandle = "t1";
  assert.throws(() => validateDiagram(doc), /puerto/i);
  const flow = template("er");
  flow.edges[0].targetHandle = "missing";
  assert.throws(() => validateDiagram(flow), /puerto/i);
});
