<script>
  let {
    node,
    edge,
    mode,
    updateNode,
    updateEdge,
    remove,
    duplicate,
    dismiss,
    moveMessage,
    canMoveUp,
    canMoveDown,
  } = $props();
  function column(i, key, value) {
    updateNode({
      columns: node.data.columns.map((c, j) =>
        i === j ? { ...c, [key]: value } : c,
      ),
    });
  }
</script>

<aside class="inspector">
  <div class="panel-title">
    Propiedades <span>{node ? "ELEMENTO" : edge ? "CONEXIÓN" : "LIENZO"}</span>
    {#if node || edge}<button aria-label="Cerrar propiedades" onclick={dismiss}
        >×</button
      >{/if}
  </div>
  {#if node}
    <label
      >Nombre<input
        value={node.type === "entity" ? node.data.table : node.data.label}
        onchange={(e) =>
          updateNode(
            node.type === "entity"
              ? { table: e.target.value, label: e.target.value }
              : { label: e.target.value },
          )}
      /></label
    >
    <label
      >Color<input
        type="color"
        value={node.data.color || "#087f8c"}
        oninput={(e) => updateNode({ color: e.target.value })}
      /></label
    >
    {#if node.type === "entity"}
      <div class="section-heading">
        Atributos <button
          onclick={() =>
            updateNode({
              columns: [
                ...node.data.columns,
                {
                  name: "campo",
                  type: "varchar(100)",
                  key: "",
                  nullable: true,
                },
              ],
            })}>+ Añadir</button
        >
      </div>
      <div class="attributes">
        {#each node.data.columns as c, i}<div class="attribute">
            <input
              aria-label={`Nombre del atributo ${i + 1}`}
              value={c.name}
              onchange={(e) => column(i, "name", e.target.value)}
            />
            <input
              aria-label={`Tipo del atributo ${i + 1}`}
              value={c.type}
              onchange={(e) => column(i, "type", e.target.value)}
            />
            <select
              aria-label={`Clave del atributo ${i + 1}`}
              value={c.key || ""}
              onchange={(e) => column(i, "key", e.target.value)}
              ><option value="">Sin clave</option><option>PK</option><option
                >FK</option
              ><option>PK/FK</option></select
            >
            <label class="check"
              ><input
                type="checkbox"
                checked={!!c.nullable}
                onchange={(e) => column(i, "nullable", e.target.checked)}
              /> Nulo</label
            >
            <button
              class="danger"
              onclick={() =>
                updateNode({
                  columns: node.data.columns.filter((_, j) => j !== i),
                })}>Eliminar atributo</button
            >
          </div>{/each}
      </div>
    {/if}
    <div class="button-row">
      <button onclick={duplicate}>Duplicar</button><button
        class="danger"
        onclick={remove}>Eliminar</button
      >
    </div>
  {:else if edge}
    <label
      >Etiqueta<input
        value={edge.label || ""}
        onchange={(e) => updateEdge({ label: e.target.value })}
      /></label
    >
    {#if mode === "er"}<label
        >Cardinalidad<select
          value={["1 → 1", "1 → N", "N → M"].includes(edge.label)
            ? edge.label
            : ""}
          onchange={(e) => updateEdge({ label: e.target.value })}
          ><option value="">Personalizada</option><option>1 → 1</option><option
            >1 → N</option
          ><option>N → M</option></select
        ></label
      >{/if}
    {#if mode === "sequence"}
      <div class="button-row message-order">
        <button disabled={!canMoveUp} onclick={() => moveMessage(-1)}
          >↑ Subir mensaje</button
        ><button disabled={!canMoveDown} onclick={() => moveMessage(1)}
          >↓ Bajar mensaje</button
        >
      </div>
      <label class="check"
        ><input
          type="checkbox"
          checked={
            edge.returnMessage ?? !!edge.style?.includes("stroke-dasharray")
          }
          onchange={(e) =>
            updateEdge({ returnMessage: e.target.checked })}
        /> Mensaje de retorno</label
      >
    {:else}<label
        >Trazado<select
          value={edge.type || "default"}
          onchange={(e) => updateEdge({ type: e.target.value })}
          ><option value="routed">Automático (ordenado)</option><option
            value="smoothstep">Ortogonal suave</option
          ><option value="default">Curva</option><option value="straight"
            >Recta</option
          ><option value="step">Ortogonal</option></select
        ></label
      >
      <label class="check"
        ><input
          type="checkbox"
          checked={!!edge.animated}
          onchange={(e) => updateEdge({ animated: e.target.checked })}
        /> Animar conexión</label
      >{/if}
    <button class="danger" onclick={remove}>Eliminar conexión</button>
  {:else}
    <div class="empty-inspector">
      <div class="select-symbol">↖</div>
      <h2>Todo empieza con una idea</h2>
      <p>
        Añade un elemento o selecciona uno en el lienzo para editar sus
        propiedades.
      </p>
    </div>
    <div class="tips">
      <strong>En tu lienzo</strong>
      <p>Arrastra los elementos para moverlos.</p>
      <p>Une un puerto de salida con uno de entrada para conectar.</p>
      <p>Shift + arrastrar: selección múltiple.</p>
      <p>Rueda: zoom · Arrastrar el fondo: mover.</p>
      <p>Ctrl / ⌘ + Z: deshacer · Supr: eliminar.</p>
      {#if mode === "sequence"}<p>
          Conecta puertos numerados. Los mensajes avanzan de arriba hacia abajo.
        </p>{/if}
    </div>
  {/if}
</aside>
