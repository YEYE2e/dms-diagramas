<script>
  import { Handle, Position } from "@xyflow/svelte";
  let { data } = $props();
</script>

<div class="participant" style:height={`${110 + (data.steps || 6) * 42}px`}>
  <div class="heading" style:border-color={data.color || "#087f8c"}>
    {data.label}
  </div>
  <div class="lifeline"></div>
  {#each Array.from({ length: data.steps || 6 }, (_, i) => i + 1) as step}
    <span class="step" style:top={`${76 + step * 42}px`}>{step}</span>
    <Handle
      id={`s${step}`}
      type="source"
      position={Position.Right}
      style={`top:${84 + step * 42}px;right:76px;`}
    />
    <Handle
      id={`t${step}`}
      type="target"
      position={Position.Left}
      style={`top:${84 + step * 42}px;left:76px;`}
    />
  {/each}
</div>

<style>
  .participant {
    width: 160px;
    height: 620px;
    position: relative;
    pointer-events: none;
  }
  .heading {
    border: 2px solid;
    background: white;
    border-radius: 5px;
    padding: 16px 10px;
    text-align: center;
    font-size: 13px;
    overflow-wrap: anywhere;
    pointer-events: auto;
    min-height: 56px;
  }
  .lifeline {
    position: absolute;
    top: 58px;
    bottom: 0;
    left: 79px;
    border-left: 2px dashed #b8c7ce;
  }
  .step {
    position: absolute;
    left: 55px;
    font-size: 9px;
    color: #8b9aa8;
  }
  .participant :global(.svelte-flow__handle) {
    pointer-events: auto;
    width: 8px;
    height: 8px;
  }
</style>
