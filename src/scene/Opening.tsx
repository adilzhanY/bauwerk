import { useMemo, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Wall } from "@/geometry/walls";
import type { Id, Opening as OpeningData } from "@/geometry/types";
import { colors, INACTIVE_OPACITY } from "@/lib/colors";
import { sameSelection, useEditorStore } from "@/store/building";
import type { Selection } from "@/store/building";
import { useHover } from "./hover";
import { yawFor } from "./three";
import { pointOnVertical } from "./tools/plane";
import { useDragLock } from "./tools/useDragLock";
import { snapOffset } from "@/geometry/openings";
import { dot, sub } from "@/geometry/polygon";

interface Props {
  storeyId: Id;
  wall: Wall;
  opening: OpeningData;
  thickness: number;
  elevation: number;
  active: boolean;
  valid: boolean;
}

const noRaycast = () => null;

/** A translucent pane for windows and a slab for doors, sitting inside the wall hole. */
export function Opening({ storeyId, wall, opening, thickness, elevation, active, valid }: Props) {
  const target: Selection = useMemo(
    () => ({ kind: "opening", storeyId, id: opening.id }),
    [storeyId, opening.id],
  );
  const selected = useEditorStore((s) => sameSelection(s.selection, target));
  const hovered = useEditorStore((s) => sameSelection(s.hovered, target));
  const select = useEditorStore((s) => s.select);
  const tool = useEditorStore((s) => s.tool);
  const updateOpening = useEditorStore((s) => s.updateOpening);
  const hover = useHover(target, active);
  const lock = useDragLock();
  const [dragOffset, setDragOffset] = useState<number | null>(null);

  const offset = dragOffset ?? opening.offset;
  const u = offset + opening.width / 2;
  const depth = thickness / 2;
  const cx = wall.outerA.x + wall.direction.x * u - wall.normal.x * depth;
  const cz = wall.outerA.y + wall.direction.y * u - wall.normal.y * depth;
  const cy = elevation + opening.sill + opening.height / 2;
  const yaw = yawFor(wall.direction);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    select(target);
  };

  const draggable = active && (tool === "select" || tool === "opening");

  const offsetAt = (e: ThreeEvent<PointerEvent>): number | null => {
    const hit = pointOnVertical(e, wall.outerA, wall.normal);
    if (!hit) return null;
    const along = dot(sub(hit, wall.outerA), wall.direction);
    return snapOffset(along - opening.width / 2, opening.width, wall.length);
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!draggable || e.button !== 0) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    lock(true);
    select(target);
    setDragOffset(opening.offset);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (dragOffset === null) return;
    const next = offsetAt(e);
    if (next !== null) setDragOffset(next);
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (dragOffset === null) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    lock(false);
    if (dragOffset !== opening.offset) updateOpening(storeyId, opening.id, { offset: dragOffset });
    setDragOffset(null);
  };

  const base = opening.kind === "door" ? colors.door : colors.window;
  const color = !valid ? colors.warning : selected ? colors.accent : base;
  const opacity = !active ? INACTIVE_OPACITY : opening.kind === "window" ? 0.55 : 1;

  return (
    <mesh
      position={[cx, cy, cz]}
      rotation={[0, yaw, 0]}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      raycast={active ? undefined : noRaycast}
      {...hover}
    >
      {opening.kind === "door" ? (
        <boxGeometry args={[opening.width, opening.height, Math.max(thickness * 0.5, 0.04)]} />
      ) : (
        <boxGeometry args={[opening.width, opening.height, 0.03]} />
      )}
      <meshStandardMaterial
        color={color}
        emissive={selected || hovered ? colors.accent : "#000000"}
        emissiveIntensity={selected ? 0.4 : hovered ? 0.15 : 0}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
        roughness={opening.kind === "door" ? 0.8 : 0.2}
        metalness={opening.kind === "door" ? 0 : 0.1}
      />
    </mesh>
  );
}
