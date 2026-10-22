<script>
  let { action, cancel, confirm } = $props();
  function open(element) {
    element.showModal();
    return {
      destroy() {
        element.close();
      },
    };
  }
</script>

<dialog
  use:open
  oncancel={(event) => {
    event.preventDefault();
    cancel();
  }}
  aria-labelledby="confirm-title"
  class="modal"
>
  <h2 id="confirm-title">
    {action === "clear"
      ? "¿Vaciar el lienzo?"
      : action === "sql"
        ? "¿Cargar el esquema SQL?"
        : "¿Cargar un ejemplo?"}
  </h2>
  <p>
    Se reemplazará el diagrama actual. {action === "sql"
      ? "Exporta una copia JSON si quieres conservarlo."
      : "Puedes recuperar los cambios con Deshacer."}
  </p>
  <div class="button-row">
    <button onclick={cancel}>Cancelar</button><button
      class="primary"
      onclick={confirm}>Continuar</button
    >
  </div>
</dialog>
