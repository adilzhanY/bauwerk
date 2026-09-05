import { useMemo } from "react";
import { Mesh } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { distance, normalize, sub } from "@/geometry/polygon";
import type { Id, Segment } from "@/geometry/types";
import { colors } from "@/lib/colors";
import type { StoreyDisplay } from "./display";
import { sameSelection, useEditorStore } from "@/store/building";
import type { Selection } from "@/store/building";
import { useHover } from "./hover";
import { yawFor } from "./three";

interface Props {
  storeyId: Id;
  index: number;
  segment: Segment;
  height: number;
  elevation: number;
  active: boolean;
  display: StoreyDisplay;
  ghostOpacity: number;
}

export const INTERIOR_WALL_THICKNESS = 0.1;
// Passing `undefined` to switch the override off writes undefined onto the mesh and every
// later pointer event throws inside the raycaster, killing all interaction until reload.
// Switch between the real Mesh raycast and a no-op instead.
const meshRaycast: Mesh["raycast"] = function raycast(this: Mesh, raycaster, intersects) {
  Mesh.prototype.raycast.call(this, raycaster, intersects);
};
const noRaycast = () => null;

export function InteriorWall({
  storeyId,
  index,
  segment,
  height,
  elevation,
  active,
  display,
  ghostOpacity,
}: Props) {
  const target: Selection = useMemo(
    () => ({ kind: "interiorWall", storeyId, index }),
    [storeyId, index],
  );
  const selected = useEditorStore((s) => sameSelection(s.selection, target));
  const hovered = useEditorStore((s) => sameSelection(s.hovered, target));
  const select = useEditorStore((s) => s.select);
  const tool = useEditorStore((s) => s.tool);
  const hover = useHover(target, active);

  const length = distance(segment.a, segment.b);
  const yaw = yawFor(normalize(sub(segment.b, segment.a)));
  const cx = (segment.a.x + segment.b.x) / 2;
  const cz = (segment.a.y + segment.b.y) / 2;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active || (tool !== "select" && tool !== "interiorWall")) return;
    e.stopPropagation();
    select(target);
  };

  if (display === "outline") return null;
  return (
    <mesh
      position={[cx, elevation + height / 2, cz]}
      rotation={[0, yaw, 0]}
      onClick={onClick}
      raycast={active ? meshRaycast : noRaycast}
      castShadow
      {...hover}
    >
      <boxGeometry args={[length, height, INTERIOR_WALL_THICKNESS]} />
      <meshStandardMaterial
        color={selected ? colors.accent : hovered ? colors.wallHover : colors.interiorWall}
        emissive={selected ? colors.accent : "#000000"}
        emissiveIntensity={selected ? 0.35 : 0}
        roughness={0.9}
        transparent={display === "ghost"}
        opacity={display === "ghost" ? ghostOpacity : 1}
        depthWrite={display !== "ghost"}
      />
    </mesh>
  );
}
