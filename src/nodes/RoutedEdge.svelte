<script>
  import { BaseEdge, getSmoothStepPath } from "@xyflow/svelte";
  let {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    label,
    labelStyle,
    markerEnd,
    style,
  } = $props();
  const geometry = $derived.by(() => {
    const points = data?.route;
    if (points?.length >= 2) {
      const start = points[0],
        end = points.at(-1);
      if (
        Math.abs(start.x - sourceX) < 6 &&
        Math.abs(start.y - sourceY) < 6 &&
        Math.abs(end.x - targetX) < 6 &&
        Math.abs(end.y - targetY) < 6
      ) {
        const route = [
          { x: sourceX, y: sourceY },
          ...points.slice(1, -1),
          { x: targetX, y: targetY },
        ];
        return [
          route.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "),
          data.routeLabel?.x || (sourceX + targetX) / 2,
          data.routeLabel?.y || (sourceY + targetY) / 2,
        ];
      }
    }
    return getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
  });
</script>

<BaseEdge
  class="routed-relation"
  {id}
  path={geometry[0]}
  labelX={geometry[1]}
  labelY={geometry[2]}
  {label}
  {labelStyle}
  {markerEnd}
  {style}
/>
