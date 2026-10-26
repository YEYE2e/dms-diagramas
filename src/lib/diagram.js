export const modes = {
  sequence: "Diagrama de secuencia",
  er: "Entidad-relación",
};
export const palette = {
  sequence: [
    ["participant", "Participante"],
    ["note", "Nota"],
  ],
  er: [
    ["entity", "Entidad"],
    ["note", "Nota"],
  ],
};
export function makeNode(kind, position = { x: 100, y: 100 }) {
  return {
    id: crypto.randomUUID(),
    type:
      kind === "entity"
        ? "entity"
        : kind === "participant"
          ? "participant"
          : "shape",
    position,
    data: {
      label: {
        note: "Escribe una nota",
        participant: "Participante",
        entity: "Nueva entidad",
      }[kind],
      kind,
      color: "#087f8c",
      ...(kind === "entity"
        ? {
            table: "Nueva entidad",
            columns: [{ name: "id", type: "int", key: "PK", nullable: false }],
          }
        : {}),
    },
  };
}
const arrow = { type: "arrowclosed", color: "#64748b" };
export function template(mode) {
  let nodes, edges;
  if (mode === "er") {
    nodes = ["Clientes", "Pedidos"].map((table, i) => ({
      ...makeNode("entity", { x: 60 + i * 390, y: 120 }),
      id: `t${i}`,
      data: {
        table,
        label: table,
        color: "#087f8c",
        columns: [
          { name: "id", type: "int", key: "PK" },
          {
            name: i ? "cliente_id" : "nombre",
            type: i ? "int" : "varchar(100)",
            key: i ? "FK" : "",
          },
        ],
      },
    }));
    edges = [
      {
        id: "relation",
        source: "t0",
        target: "t1",
        label: "1 → N",
        type: "smoothstep",
        markerEnd: arrow,
      },
    ];
  } else {
    nodes = ["Usuario", "Aplicación", "Base de datos"].map((label, i) => ({
      ...makeNode("participant", { x: 60 + i * 290, y: 30 }),
      id: `p${i}`,
      data: { label, color: "#087f8c" },
    }));
    edges = [
      [0, 1, "Enviar solicitud"],
      [1, 2, "Consultar datos"],
      [2, 1, "Devolver resultado"],
      [1, 0, "Mostrar respuesta"],
    ].map(([s, t, label], i) => ({
      id: `m${i}`,
      source: `p${s}`,
      target: `p${t}`,
      sourceHandle: `s${i + 1}`,
      targetHandle: `t${i + 1}`,
      type: "straight",
      label: `${i + 1}. ${label}`,
      markerEnd: arrow,
      style: i > 1 ? "stroke-dasharray: 6 4;" : "",
    }));
  }
  return {
    version: 1,
    mode,
    title: modes[mode],
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
export function validateDiagram(value) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.edges))
    fail("El archivo debe contener nodes y edges.");
  if (value.nodes.length > 1500 || value.edges.length > 5000)
    fail("El diagrama supera el límite de 1500 elementos o 5000 conexiones.");
  const mode = value.mode ?? "er";
  if (
    value.repositoryId != null &&
    value.repositoryId !== "" &&
    (typeof value.repositoryId !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value.repositoryId))
  )
    fail("Identificador de repositorio inválido.");
  if (!Object.hasOwn(modes, mode)) fail("Tipo de diagrama desconocido.");
  const ids = new Set();
  const nodes = value.nodes.map((n) => {
    if (!n || typeof n.id !== "string" || !n.id || ids.has(n.id))
      fail("Identificador de elemento inválido o repetido.");
    ids.add(n.id);
    if (
      ![
        "entity",
        "shape",
        "participant",
        "default",
        "input",
        "output",
      ].includes(n.type ?? "default")
    )
      fail("Tipo de elemento inválido.");
    if (!Number.isFinite(n.position?.x) || !Number.isFinite(n.position?.y))
      fail("Posición inválida.");
    const data = n.data ?? {};
    if (typeof data !== "object" || Array.isArray(data))
      fail("Datos inválidos.");
    for (const key of ["label", "table", "color", "kind"])
      if (data[key] != null && typeof data[key] !== "string")
        fail("Texto de elemento inválido.");
    if (data.color && !/^#[0-9a-f]{6}$/i.test(data.color))
      fail("Color inválido.");
    if (
      data.ports &&
      (!Array.isArray(data.ports) ||
        data.ports.length > 5000 ||
        data.ports.some(
          (p) =>
            !p ||
            typeof p.id !== "string" ||
            !["source", "target"].includes(p.type) ||
            !Number.isFinite(p.y),
        ))
    )
      fail("Puerto de entidad inválido.");
    if (
      data.steps != null &&
      (!Number.isInteger(data.steps) || data.steps < 1 || data.steps > 201)
    )
      fail("Cantidad de pasos inválida.");
    if (
      n.type === "entity" &&
      (!Array.isArray(data.columns) ||
        data.columns.length > 200 ||
        data.columns.some(
          (c) =>
            !c ||
            typeof c.name !== "string" ||
            typeof c.type !== "string" ||
            (c.key != null && !["", "PK", "FK", "PK/FK"].includes(c.key)),
        ))
    )
      fail("Columnas de entidad inválidas.");
    return {
      id: n.id,
      type: n.type ?? "default",
      position: { ...n.position },
      data: JSON.parse(JSON.stringify(data)),
    };
  });
  const edgeIds = new Set();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = value.edges.map((e) => {
    if (
      !e ||
      typeof e.id !== "string" ||
      edgeIds.has(e.id) ||
      !ids.has(e.source) ||
      !ids.has(e.target)
    )
      fail("Identificador o conexión inválida: revisa sus extremos.");
    edgeIds.add(e.id);
    if (e.label != null && typeof e.label !== "string")
      fail("Etiqueta de conexión inválida.");
    for (const k of ["sourceHandle", "targetHandle"])
      if (e[k] != null && typeof e[k] !== "string")
        fail("Puerto de conexión inválido.");
    for (const [nodeId, handle, direction] of [
      [e.source, e.sourceHandle, "source"],
      [e.target, e.targetHandle, "target"],
    ]) {
      if (handle == null) continue;
      const node = nodeById.get(nodeId);
      const valid =
        node.type === "participant"
          ? new RegExp(
              `^${direction === "source" ? "s" : "t"}[1-9]\\d{0,2}$`,
            ).test(handle) && Number(handle.slice(1)) <= 200
          : node.type === "entity"
            ? node.data.ports?.some(
                (p) => p.id === handle && p.type === direction,
              )
            : node.type === "shape" &&
              handle === (direction === "source" ? "right" : "left");
      if (!valid) fail("Puerto de conexión inexistente.");
    }
    if (mode === "sequence")
      for (const k of ["sourceHandle", "targetHandle"])
        if (
          e[k] &&
          (!/^[st][1-9]\d{0,2}$/.test(e[k]) || Number(e[k].slice(1)) > 200)
        )
          fail("Paso de secuencia inválido (1–200).");
    const route = e.data?.route;
    if (
      route &&
      (!Array.isArray(route) ||
        route.length > 2000 ||
        route.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    )
      fail("Ruta de relación inválida.");
    const routeLabel = e.data?.routeLabel;
    if (
      routeLabel &&
      (!Number.isFinite(routeLabel.x) || !Number.isFinite(routeLabel.y))
    )
      fail("Etiqueta de ruta inválida.");
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label ?? "",
      type: ["default", "smoothstep", "straight", "step", "routed"].includes(
        e.type,
      )
        ? e.type
        : "smoothstep",
      markerEnd: arrow,
      data: route ? { route, routeLabel } : undefined,
      style:
        typeof e.style === "string" && e.style.includes("stroke-dasharray")
          ? "stroke-dasharray: 6 4;"
          : "",
      animated: !!e.animated,
    };
  });
  const v = value.viewport;
  return {
    version: 1,
    mode,
    repositoryId: value.repositoryId,
    title:
      typeof value.title === "string"
        ? value.title
        : typeof value.database === "string"
          ? value.database
          : modes[mode],
    nodes,
    edges,
    viewport:
      v &&
      [v.x, v.y, v.zoom].every(Number.isFinite) &&
      v.zoom >= 0.1 &&
      v.zoom <= 3
        ? v
        : { x: 0, y: 0, zoom: 1 },
  };
}
export function removeSelection(nodes, edges) {
  const kept = nodes.filter((n) => !n.selected);
  const ids = new Set(kept.map((n) => n.id));
  return {
    nodes: kept,
    edges: edges.filter(
      (e) => !e.selected && ids.has(e.source) && ids.has(e.target),
    ),
  };
}
export function createHistory() {
  let entries = [],
    index = -1;
  return {
    record(value) {
      if (entries[index] === value) return;
      entries = entries.slice(0, index + 1);
      entries.push(value);
      if (entries.length > 80) entries.shift();
      index = entries.length - 1;
    },
    undo() {
      return index > 0 ? entries[--index] : null;
    },
    redo() {
      return index < entries.length - 1 ? entries[++index] : null;
    },
    get canUndo() {
      return index > 0;
    },
    get canRedo() {
      return index < entries.length - 1;
    },
  };
}
