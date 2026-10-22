<script>
  let { data } = $props();
</script>

<div class="note">{data.label}</div>

<style>
  .note {
    width: 190px;
    min-height: 80px;
    padding: 16px;
    background: #fffbe9;
    border: 1px solid #e7dbab;
    border-radius: 3px;
    color: #6d6241;
    font-size: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
