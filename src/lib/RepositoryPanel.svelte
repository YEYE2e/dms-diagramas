<script>
  import { validateDiagram, modes } from "./diagram.js";
  let { open, dismiss, revision = 0 } = $props();
  let entries = $state([]),
    error = $state(""),
    loading = $state(true);
  async function refresh() {
    loading = true;
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}diagrams/index.json`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error("No se encontró el índice de diagramas.");
      const list = await response.json();
      if (!Array.isArray(list)) throw new Error("Índice inválido.");
      entries = list.filter(
        (e) =>
          e &&
          /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(e.id) &&
          typeof e.title === "string" &&
          Object.hasOwn(modes, e.mode),
      );
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
  $effect(() => {
    const token = revision;
    void refresh();
  });
  async function select(entry) {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}diagrams/${entry.id}.json`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("No se pudo abrir el diagrama.");
      const raw = await response.json();
      open({ ...validateDiagram(raw), repositoryId: entry.id });
      dismiss();
    } catch (e) {
      error = e.message;
    }
  }
</script>

<section class="repository-panel" aria-label="Diagramas del repositorio">
  <div class="panel-title">
    Diagramas del repositorio<button
      aria-label="Cerrar biblioteca"
      onclick={dismiss}>×</button
    >
  </div>
  <p class="muted">
    {import.meta.env.DEV
      ? "Archivos en public/diagrams. Guarda y sube los cambios a Git para publicarlos."
      : "Diagramas incluidos en el último despliegue de GitHub Pages."}
  </p>
  {#if loading}<p class="muted" role="status">
      Cargando diagramas…
    </p>{:else if !entries.length}<p class="muted">
      Todavía no hay diagramas guardados.
    </p>{/if}
  {#if error}<p class="danger" role="alert">{error}</p>{/if}
  <div class="repository-list">
    {#each entries as entry}<button onclick={() => select(entry)}
        ><strong>{entry.title}</strong><span>{modes[entry.mode]}</span></button
      >{/each}
  </div>
</section>
