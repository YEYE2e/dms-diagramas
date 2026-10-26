<script>
  import { onMount, untrack, tick } from "svelte";
  import {
    SvelteFlow,
    Controls,
    MiniMap,
    Background,
    BackgroundVariant,
    useSvelteFlow,
    useUpdateNodeInternals,
  } from "@xyflow/svelte";
  import EntityNode from "../nodes/EntityNode.svelte";
  import ShapeNode from "../nodes/ShapeNode.svelte";
  import ParticipantNode from "../nodes/ParticipantNode.svelte";
  import RoutedEdge from "../nodes/RoutedEdge.svelte";
  import { arrangeDiagram } from "./layout.js";
  import Inspector from "./Inspector.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import RepositoryPanel from "./RepositoryPanel.svelte";
  import {
    modes,
    palette,
    template,
    makeNode,
    validateDiagram,
    removeSelection,
    createHistory,
  } from "./diagram.js";
  const nodeTypes = {
    entity: EntityNode,
    shape: ShapeNode,
    participant: ParticipantNode,
  };
  const flow = useSvelteFlow();
  const updateInternals = useUpdateNodeInternals();
  const edgeTypes = { routed: RoutedEdge };
  let mode = $state("er"),
    title = $state("Entidad-relación");
  let nodes = $state.raw([]),
    edges = $state.raw([]),
    viewport = $state.raw({ x: 0, y: 0, zoom: 1 });
  let ready = $state(false),
    status = $state("Preparando lienzo…"),
    error = $state("");
  let selectedId = $state(""),
    selectedKind = $state("node"),
    revision = $state(0),
    confirmAction = $state("");
  let fileInput, timer;
  let repositoryId = $state(""),
    showRepository = $state(false),
    savingRepository = $state(false),
    repositoryNotice = $state(""),
    repositoryRevision = $state(0);
  let showConnect = $state(false),
    showMiniMap = $state(false),
    ordering = $state(false);
  let layoutRevision = 0;
  let fitInitialView = $state(true);
  let history = $state.raw(createHistory());
  let draftSource = $state(""),
    draftTarget = $state(""),
    draftLabel = $state("");
  const selectedNode = $derived(
    selectedKind === "node" ? nodes.find((n) => n.id === selectedId) : null,
  );
  const selectedEdge = $derived(
    selectedKind === "edge" ? edges.find((e) => e.id === selectedId) : null,
  );
  function documentValue() {
    return {
      version: 1,
      repositoryId: repositoryId || undefined,
      mode,
      title,
      nodes: nodes.map(({ id, type, position, data }) => ({
        id,
        type,
        position,
        data,
      })),
      edges: edges.map(({ selected, ...e }) => e),
      viewport,
    };
  }
  function snapshot() {
    const { viewport, ...doc } = documentValue();
    return JSON.stringify(doc);
  }
  function record() {
    history.record(snapshot());
    revision++;
  }
  function persist() {
    try {
      localStorage.setItem(
        `dms-diagram-${mode}`,
        JSON.stringify(documentValue()),
      );
      status = "Guardado en este navegador";
    } catch {
      error =
        "No se pudo guardar localmente. Exporta el JSON para conservar tu trabajo.";
    }
  }
  function load(doc, fit = false) {
    layoutRevision++;
    ordering = false;
    nodes = doc.nodes;
    edges = doc.edges;
    title = doc.title;
    mode = doc.mode;
    repositoryId = doc.repositoryId || "";
    viewport = doc.viewport || { x: 0, y: 0, zoom: 1 };
    selectedId = "";
    draftSource = "";
    draftTarget = "";
    history = createHistory();
    record();
    if (fit && ready) void tick().then(arrange);
  }
  onMount(() => {
    try {
      const last = localStorage.getItem("dms-mode") || "er";
      const key = Object.hasOwn(modes, last) ? last : "er";
      const saved = localStorage.getItem(`dms-diagram-${key}`);
      fitInitialView = !saved;
      load(saved ? validateDiagram(JSON.parse(saved)) : template(key));
    } catch {
      load(template("er"));
      error =
        "No se pudo abrir el guardado local. Puedes importar una copia JSON.";
    }
    ready = true;
    const publishedId = new URLSearchParams(location.search).get("diagram");
    if (publishedId && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(publishedId))
      void openPublished(publishedId);
    return () => clearTimeout(timer);
  });
  $effect(() => {
    const current = snapshot();
    const view = viewport;
    if (!ready) return;
    untrack(() => {
      status = "Guardando…";
      clearTimeout(timer);
      timer = setTimeout(() => {
        history.record(current);
        revision++;
        persist();
      }, 450);
    });
  });
  function switchMode(next) {
    if (next === mode) return;
    clearTimeout(timer);
    persist();
    error = "";
    try {
      const saved = localStorage.getItem(`dms-diagram-${next}`);
      load(saved ? validateDiagram(JSON.parse(saved)) : template(next), !saved);
      localStorage.setItem("dms-mode", next);
    } catch {
      load(template(next), true);
      error = "No se pudo recuperar el guardado de este modo.";
    }
  }
  function changeHistory(direction) {
    clearTimeout(timer);
    if (direction === "undo") record();
    const state = history[direction]();
    if (state) {
      const doc = JSON.parse(state);
      nodes = doc.nodes;
      edges = doc.edges;
      title = doc.title;
      selectedId = "";
      revision++;
    }
  }
  function add(kind) {
    record();
    const pos = flow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const node = makeNode(
      kind,
      mode === "sequence" && kind === "participant" ? { x: pos.x, y: 30 } : pos,
    );
    nodes = [
      ...nodes.map((n) => ({ ...n, selected: false })),
      { ...node, selected: true },
    ];
    selectedId = node.id;
    selectedKind = "node";
    if (kind !== "note") void arrange();
  }
  function updateNode(data) {
    if (ordering) {
      layoutRevision++;
      ordering = false;
    }
    record();
    nodes = nodes.map((n) =>
      n.id === selectedId ? { ...n, data: { ...n.data, ...data } } : n,
    );
    if (data.columns) void arrange();
  }
  function updateEdge(data) {
    if (ordering) {
      layoutRevision++;
      ordering = false;
    }
    record();
    edges = edges.map((e) => (e.id === selectedId ? { ...e, ...data } : e));
    if (data.label !== undefined) void arrange();
  }
  function remove() {
    record();
    const result = removeSelection(
      nodes.map((n) => ({
        ...n,
        selected:
          n.selected || (selectedKind === "node" && n.id === selectedId),
      })),
      edges.map((e) => ({
        ...e,
        selected:
          e.selected || (selectedKind === "edge" && e.id === selectedId),
      })),
    );
    nodes = result.nodes;
    edges = result.edges;
    selectedId = "";
    if (nodes.length) void arrange();
  }
  function duplicate() {
    if (!selectedNode) return;
    record();
    const node = {
      ...JSON.parse(JSON.stringify(selectedNode)),
      id: crypto.randomUUID(),
      position: {
        x:
          selectedNode.position.x +
          (selectedNode.type === "participant" ? 240 : 40),
        y:
          selectedNode.type === "participant"
            ? 30
            : selectedNode.position.y + 40,
      },
      selected: true,
    };
    nodes = [...nodes.map((n) => ({ ...n, selected: false })), node];
    selectedId = node.id;
    void arrange();
  }
  function connect(c) {
    error = "";
    if (
      !nodes.some((n) => n.id === c.source) ||
      !nodes.some((n) => n.id === c.target) ||
      c.source === c.target
    ) {
      error = "Elige dos elementos diferentes.";
      return;
    }
    if (mode === "sequence") {
      if (
        nodes.find((n) => n.id === c.source)?.type !== "participant" ||
        nodes.find((n) => n.id === c.target)?.type !== "participant"
      ) {
        error = "Los mensajes deben unir participantes.";
        return;
      }
      const step = edges.length + 1;
      if (step > 200) {
        error = "El diagrama admite hasta 200 mensajes.";
        return;
      }
      c = { ...c, sourceHandle: `s${step}`, targetHandle: `t${step}` };
    }
    record();
    edges = [
      ...edges,
      {
        ...c,
        id: crypto.randomUUID(),
        type: mode === "sequence" ? "straight" : "smoothstep",
        label:
          draftLabel ||
          (mode === "er"
            ? "1 → N"
            : mode === "sequence"
              ? `${c.sourceHandle.slice(1)}. Mensaje`
              : ""),
        markerEnd: { type: "arrowclosed", color: "#64748b" },
      },
    ];
    draftLabel = "";
    void arrange();
  }
  async function arrange() {
    const attempt = ++layoutRevision;
    const beforeMode = mode;
    ordering = true;
    error = "";
    record();
    try {
      const result = await arrangeDiagram(mode, nodes, edges);
      if (attempt !== layoutRevision || mode !== beforeMode) return;
      nodes = result.nodes;
      await tick();
      updateInternals(result.nodes.map((n) => n.id));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (attempt !== layoutRevision) return;
      edges = result.edges;
      await tick();
      await flow.fitView({ padding: 0.12, duration: 200 });
    } catch (e) {
      error = `No se pudo ordenar: ${e.message}`;
    } finally {
      if (attempt === layoutRevision) ordering = false;
    }
  }
  function moveMessage(direction) {
    const index = edges.findIndex((e) => e.id === selectedId),
      target = index + direction;
    if (index < 0 || target < 0 || target >= edges.length) return;
    record();
    const next = [...edges];
    const [edge] = next.splice(index, 1);
    next.splice(target, 0, edge);
    edges = next;
    void arrange();
  }
  function exportJSON() {
    const blob = new Blob([JSON.stringify(documentValue(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\p{L}\p{N}_-]/gu, "_") || "diagrama"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function openPublished(id) {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}diagrams/${id}.json`,
      );
      if (!response.ok) throw new Error("El diagrama no existe.");
      const raw = await response.json();
      load({ ...validateDiagram(raw), repositoryId: id });
    } catch (e) {
      error = `No se pudo abrir el enlace: ${e.message}`;
    }
  }
  async function saveRepository() {
    savingRepository = true;
    error = "";
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}__diagrams/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: repositoryId || undefined,
            diagram: documentValue(),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar.");
      repositoryId = result.id;
      repositoryRevision++;
      repositoryNotice = `Guardado en public/diagrams/${result.file}. Incluye estos archivos en tu próximo commit para publicarlos.`;
      persist();
    } catch (e) {
      error = `No se pudo guardar en el repositorio: ${e.message}`;
    } finally {
      savingRepository = false;
    }
  }
  async function importJSON(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("El archivo supera los 5 MB.");
      const doc = validateDiagram(JSON.parse(await file.text()));
      persist();
      load(doc);
      localStorage.setItem("dms-mode", mode);
      persist();
      error = "";
    } catch (e) {
      error = `No se pudo importar: ${e.message}`;
    } finally {
      event.target.value = "";
    }
  }
  async function loadSQL() {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}schema/erd.json`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error("No se encontró public/schema/erd.json.");
      const doc = validateDiagram(await response.json());
      persist();
      load(doc, true);
      localStorage.setItem("dms-mode", mode);
      persist();
      error = "";
    } catch (e) {
      error = `No se pudo cargar el esquema: ${e.message}`;
    }
  }
  function reset() {
    record();
    const doc =
      confirmAction === "template"
        ? template(mode)
        : { ...template(mode), nodes: [], edges: [] };
    nodes = doc.nodes;
    edges = doc.edges;
    selectedId = "";
    confirmAction = "";
    void tick().then(arrange);
  }
  function keydown(e) {
    if (confirmAction) return;
    if (
      e.target instanceof HTMLElement &&
      (e.target.closest("input,textarea,select") || e.target.isContentEditable)
    )
      return;
    if (ordering) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      changeHistory(e.shiftKey ? "redo" : "undo");
    }
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      persist();
    }
    if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicate();
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove();
    }
    if (e.key === "Escape") {
      confirmAction = "";
      selectedId = "";
    }
  }
</script>

<svelte:window
  onkeydown={keydown}
  onpagehide={() => {
    if (ready) persist();
  }}
/>
<div class="workspace" class:busy={ordering}>
  <header class="topbar">
    <a class="brand" href="./" aria-label="DMS Diagramas"
      >DMS<span>diagramas</span></a
    >
    <select
      class="diagram-picker"
      aria-label="Tipo de diagrama"
      value={mode}
      onchange={(e) => switchMode(e.target.value)}
      disabled={ordering}
    >
      {#each Object.entries(modes) as [key, label]}<option value={key}
          >{label}</option
        >{/each}
    </select>
    <input
      class="document-title"
      aria-label="Nombre del diagrama"
      bind:value={title}
    />
    <span class="save-status"
      >{status === "Guardando…" ? "Guardando…" : "Guardado local"}</span
    >
    <div class="top-actions">
      <button
        class="repository-toggle"
        aria-expanded={showRepository}
        onclick={() => {
          showRepository = !showRepository;
          showConnect = false;
        }}>Diagramas</button
      >
      <button
        aria-label="Deshacer"
        title="Deshacer (Ctrl+Z)"
        disabled={!(revision && history.canUndo) || ordering}
        onclick={() => changeHistory("undo")}>↶</button
      >
      <button
        aria-label="Rehacer"
        title="Rehacer (Ctrl+Shift+Z)"
        disabled={!(revision && history.canRedo) || ordering}
        onclick={() => changeHistory("redo")}>↷</button
      >
      <details class="file-menu">
        <summary>Archivo ⌄</summary>
        <div>
          <button onclick={() => fileInput.click()}>Importar JSON</button
          ><button onclick={exportJSON}>Exportar JSON</button>
          <button onclick={() => (confirmAction = "template")}
            >Cargar ejemplo</button
          >
          {#if mode === "er"}<button onclick={() => (confirmAction = "sql")}
              >Cargar esquema SQL</button
            >{/if}
          <button class="danger" onclick={() => (confirmAction = "clear")}
            >Vaciar lienzo</button
          >
        </div>
      </details>
    </div>
    <input
      bind:this={fileInput}
      type="file"
      accept=".json,application/json"
      class="hidden"
      onchange={importJSON}
    />
  </header>
  <div class="actionbar">
    {#if import.meta.env.DEV}<button
        class="save-repository"
        disabled={savingRepository || ordering}
        onclick={saveRepository}
        >{savingRepository ? "Guardando…" : "Guardar en repositorio"}</button
      >{/if}
    <div class="add-actions">
      {#each palette[mode] as [kind, label]}<button
          disabled={ordering}
          onclick={() => add(kind)}>+ {label}</button
        >{/each}
      <button
        class:pressed={showConnect}
        aria-expanded={showConnect}
        onclick={() => (showConnect = !showConnect)}>Conectar</button
      >
    </div>
    <span class="diagram-count"
      >{nodes.length} elementos · {edges.length}
      {mode === "sequence" ? "mensajes" : "relaciones"}</span
    >
    <div class="view-actions">
      <button
        class="arrange-button"
        disabled={ordering || !nodes.length}
        onclick={arrange}>{ordering ? "Ordenando…" : "Ordenar diagrama"}</button
      ><button onclick={() => flow.fitView({ padding: 0.12, duration: 200 })}
        >Ajustar</button
      ><button
        class:pressed={showMiniMap}
        aria-pressed={showMiniMap}
        onclick={() => (showMiniMap = !showMiniMap)}>Mapa</button
      >
    </div>
  </div>
  {#if error}<div class="error-banner" role="alert">
      {error}<button aria-label="Cerrar aviso" onclick={() => (error = "")}
        >×</button
      >
    </div>{/if}
  {#if repositoryNotice}<div class="repository-notice" role="status">
      {repositoryNotice}<button
        aria-label="Cerrar confirmación"
        onclick={() => (repositoryNotice = "")}>×</button
      >
    </div>{/if}
  <main class="canvas" aria-label="Lienzo de diagramación">
    {#if showRepository}<RepositoryPanel
        revision={repositoryRevision}
        open={(doc) => {
          persist();
          load(doc);
        }}
        dismiss={() => (showRepository = false)}
      />{/if}
    {#if ready}<SvelteFlow
        bind:nodes
        bind:edges
        bind:viewport
        {nodeTypes}
        {edgeTypes}
        minZoom={0.05}
        maxZoom={2}
        fitView={fitInitialView}
        fitViewOptions={{ padding: 0.12 }}
        deleteKey={[]}
        snapToGrid
        snapGrid={[10, 10]}
        colorMode="light"
        oninit={() => {
          if (fitInitialView) void arrange();
        }}
        nodesDraggable={!ordering}
        nodesConnectable={!ordering}
        onbeforeconnect={(connection) => {
          connect(connection);
          return null;
        }}
        onnodeclick={({ node }) => {
          selectedId = node.id;
          selectedKind = "node";
        }}
        onedgeclick={({ edge }) => {
          selectedId = edge.id;
          selectedKind = "edge";
        }}
        onpaneclick={() => {
          selectedId = "";
          showConnect = false;
        }}
        onselectionchange={({ nodes: chosenNodes, edges: chosenEdges }) => {
          if (chosenNodes.length === 1 && chosenEdges.length === 0) {
            selectedId = chosenNodes[0].id;
            selectedKind = "node";
          } else if (chosenEdges.length === 1 && chosenNodes.length === 0) {
            selectedId = chosenEdges[0].id;
            selectedKind = "edge";
          } else if (!chosenNodes.length && !chosenEdges.length)
            selectedId = "";
        }}
        onnodedragstart={record}
        onnodedragstop={() => {
          if (mode === "sequence") void arrange();
        }}
        onselectiondragstart={record}
        onselectiondragstop={() => {
          if (mode === "sequence") void arrange();
        }}
        onflowerror={(code, message) =>
          queueMicrotask(() => {
            error = "Error al dibujar (" + code + "): " + message;
          })}
      >
        <Controls />{#if showMiniMap}<MiniMap
            pannable
            zoomable
          />{/if}<Background
          variant={BackgroundVariant.Dots}
          gap={24}
          color="#d8e0e3"
        />
      </SvelteFlow>{/if}
    {#if showConnect}<section class="connect-panel" aria-label="Crear conexión">
        <div class="panel-title">
          {mode === "sequence" ? "Nuevo mensaje" : "Nueva relación"}<button
            aria-label="Cerrar conexiones"
            onclick={() => (showConnect = false)}>×</button
          >
        </div>
        <label
          >Desde<select aria-label="Desde" bind:value={draftSource}
            ><option value="">Elegir origen</option
            >{#each nodes.filter((n) => n.type === (mode === "sequence" ? "participant" : "entity")) as n}<option
                value={n.id}>{n.data.table || n.data.label}</option
              >{/each}</select
          ></label
        >
        <label
          >Hacia<select aria-label="Hacia" bind:value={draftTarget}
            ><option value="">Elegir destino</option
            >{#each nodes.filter((n) => n.type === (mode === "sequence" ? "participant" : "entity")) as n}<option
                value={n.id}>{n.data.table || n.data.label}</option
              >{/each}</select
          ></label
        >
        <label
          >Etiqueta<input
            bind:value={draftLabel}
            placeholder={mode === "er" ? "1 → N" : "Nombre del mensaje"}
          /></label
        >
        <button
          class="primary wide"
          disabled={ordering ||
            !draftSource ||
            !draftTarget ||
            draftSource === draftTarget}
          onclick={() => connect({ source: draftSource, target: draftTarget })}
          >+ Crear {mode === "sequence" ? "mensaje" : "relación"}</button
        >
        <p class="muted">
          También puedes arrastrar entre los puertos del diagrama.
        </p>
      </section>{/if}
    {#if selectedNode || selectedEdge}<Inspector
        node={selectedNode}
        edge={selectedEdge}
        {mode}
        {updateNode}
        {updateEdge}
        {remove}
        {duplicate}
        {moveMessage}
        canMoveUp={edges.findIndex((e) => e.id === selectedId) > 0}
        canMoveDown={edges.findIndex((e) => e.id === selectedId) <
          edges.length - 1}
        dismiss={() => {
          selectedId = "";
          nodes = nodes.map((n) => ({ ...n, selected: false }));
          edges = edges.map((e) => ({ ...e, selected: false }));
        }}
      />{/if}
    {#if ready && !nodes.length}<div class="canvas-empty">
        <h1>Un lienzo para tus ideas</h1>
        <p>
          Añade {mode === "er" ? "una entidad" : "un participante"} para empezar.
        </p>
        <button class="primary" onclick={() => add(palette[mode][0][0])}
          >+ {palette[mode][0][1]}</button
        >
      </div>{/if}
  </main>
  <footer>
    <span>Arrastra para mover · Rueda para zoom · Shift para seleccionar</span
    ><span>{Math.round(viewport.zoom * 100)}% · Svelte Flow</span>
  </footer>
</div>
{#if confirmAction}<ConfirmDialog
    action={confirmAction}
    cancel={() => (confirmAction = "")}
    confirm={() => {
      if (confirmAction === "sql") {
        confirmAction = "";
        void loadSQL();
      } else reset();
    }}
  />{/if}
