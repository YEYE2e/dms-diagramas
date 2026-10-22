let elkPromise;
export async function arrangeDiagram(mode, nodes, edges) {
  if (mode === "sequence") {
    const actors = nodes
      .filter((n) => n.type === "participant")
      .sort((a, b) => a.position.x - b.position.x);
    const rows = Math.max(6, edges.length + 1);
    return {
      nodes: nodes.map((n) =>
        n.type === "participant"
          ? {
              ...n,
              position: { x: 40 + actors.indexOf(n) * 260, y: 30 },
              data: { ...n.data, steps: rows },
            }
          : n,
      ),
      edges: edges.map((e, i) => ({
        ...e,
        type: "straight",
        sourceHandle: `s${i + 1}`,
        targetHandle: `t${i + 1}`,
        label: `${i + 1}. ${(e.label || "Mensaje").replace(/^\d+\.\s*/, "")}`,
      })),
    };
  }
  if (!elkPromise) {
    if (typeof window === "undefined") {
      const nodeModule = "elkjs/lib/elk.bundled.js";
      elkPromise = import(/* @vite-ignore */ nodeModule).then(
        (module) => new module.default(),
      );
    } else
      elkPromise = import("./elk-browser.js").then((module) =>
        module.createElk(),
      );
  }
  const elk = await elkPromise;
  const entities = nodes.filter((n) => n.type === "entity");
  const ids = new Set(entities.map((n) => n.id));
  const relations = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const portId = (e, side) => `${side}:${e.id}`;
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "40",
      "elk.spacing.edgeEdge": "18",
      "elk.spacing.componentComponent": "65",
      "elk.layered.spacing.nodeNodeBetweenLayers": "105",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "18",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.separateConnectedComponents": "true",
      "elk.aspectRatio": "1.7",
      "elk.padding": "[top=40,left=40,bottom=40,right=40]",
    },
    children: entities.map((n) => ({
      id: n.id,
      width: 270,
      height: 54 + n.data.columns.length * 26,
      layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
      ports: relations.flatMap((e) => [
        ...(e.source === n.id
          ? [
              {
                id: portId(e, "out"),
                width: 0,
                height: 0,
                layoutOptions: { "elk.port.side": "EAST" },
              },
            ]
          : []),
        ...(e.target === n.id
          ? [
              {
                id: portId(e, "in"),
                width: 0,
                height: 0,
                layoutOptions: { "elk.port.side": "WEST" },
              },
            ]
          : []),
      ]),
    })),
    edges: relations.map((e) => ({
      id: e.id,
      sources: [portId(e, "out")],
      targets: [portId(e, "in")],
      labels: e.label
        ? [
            {
              text: e.label,
              width: Math.min(180, e.label.length * 7 + 12),
              height: 20,
            },
          ]
        : [],
    })),
  };
  if (!entities.length) return { nodes, edges };
  const result = await elk.layout(graph);
  const placed = new Map(result.children.map((n) => [n.id, n]));
  const routed = new Map(result.edges.map((e) => [e.id, e]));
  return {
    nodes: nodes.map((n, i) => {
      const place = placed.get(n.id);
      return place
        ? {
            ...n,
            position: { x: place.x, y: place.y },
            data: {
              ...n.data,
              ports: (place.ports || []).map((p) => ({
                id: p.id,
                type: p.id.startsWith("out:") ? "source" : "target",
                y: p.y,
              })),
            },
          }
        : {
            ...n,
            position: { x: 40 + i * 220, y: (result.height || 200) + 40 },
          };
    }),
    edges: edges.map((e) => {
      const route = routed.get(e.id),
        section = route?.sections?.[0];
      if (!section) return e;
      return {
        ...e,
        type: "routed",
        sourceHandle: portId(e, "out"),
        targetHandle: portId(e, "in"),
        data: {
          ...e.data,
          route: [
            section.startPoint,
            ...(section.bendPoints || []),
            section.endPoint,
          ],
          routeLabel: route.labels?.[0]
            ? {
                x: route.labels[0].x + route.labels[0].width / 2,
                y: route.labels[0].y + 10,
              }
            : null,
        },
      };
    }),
  };
}
