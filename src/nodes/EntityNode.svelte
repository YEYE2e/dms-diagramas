<script>
  import { Handle, Position, useUpdateNodeInternals } from "@xyflow/svelte";
  import { tick } from "svelte";

  let { data, id } = $props();
  const update = useUpdateNodeInternals();
  $effect(() => {
    const ports = data.ports;
    const count = data.columns.length;
    void tick().then(() => update(id));
  });
</script>

<div class="entity" style:border-color={data.color || "#dbe1ea"}>
  <div class="entity-header">
    <span class="table-icon">▦</span>
    <strong>{data.table}</strong>
  </div>

  <div class="columns">
    {#each data.columns as column}
      <div class="column">
        <span
          class:pk={column.key?.includes("PK")}
          class:fk={column.key?.includes("FK")}
          class="key"
        >
          {column.key || ""}
        </span>

        <span class="column-name">
          {column.name}
        </span>

        <span class="column-type">
          {column.type}{column.nullable ? " ?" : ""}
        </span>
      </div>
    {/each}
  </div>

  <Handle type="target" position={Position.Left} style="top:20px" />
  <Handle type="source" position={Position.Right} style="top:20px" />
  {#each data.ports || [] as port}<Handle
      id={port.id}
      type={port.type}
      position={port.type === "source" ? Position.Right : Position.Left}
      style={`top:${port.y}px;`}
    />{/each}
</div>

<style>
  .entity {
    width: 270px;
    background: #ffffff;
    border: 1px solid #dbe1ea;
    border-radius: 10px;
    color: #243044;
    box-shadow: 0 4px 15px #0000000d;
  }

  .entity-header {
    height: 40px;
    overflow: hidden;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
    font-size: 13px;
  }

  .table-icon {
    font-size: 17px;
    color: #64748b;
  }

  .columns {
    padding: 6px 0;
  }

  .column {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 10px;
    height: 26px;
    font-size: 12px;
  }

  .column:hover {
    background: #f8fafc;
  }

  .key {
    min-width: 36px;
    font-size: 10px;
    font-weight: 700;
  }

  .pk {
    color: #b45309;
  }
  .fk {
    color: #2563eb;
  }

  .column-name {
    flex: 1;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .column-type {
    color: #64748b;
    font-size: 11px;
  }
</style>
