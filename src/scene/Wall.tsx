import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { defaultOpening, snapOffset } from "@/geometry/openings";
import { dot, sub } from "@/geometry/polygon";
import { wallSolids } from "@/geometry/walls";
import type { Wall as WallData } from "@/geometry/walls";
import type { Id, Opening } from "@/geometry/types";
import { colors, INACTIVE_OPACITY } from "@/lib/colors";
import { sameSelection, useEditorStore } from "@/store/building";
import type { Selection } from "@/store/building";
import { useHover } from "./hover";
import { mergeAll, prismGeometry } from "./three";

interface Props {
  storeyId: Id;
  wall: WallData;
  openings: readonly Opening[];
  elevation: number;
  active: boolean;
}

const noRaycast = () => null;

export function Wall({ storeyId, wall, openings, elevation, active }: Props) {
  const target: Selection = useMemo(
    () => ({ kind: "wall", storeyId, wallIndex: wall.index }),
    [storeyId, wall.index],
  );
  const selected = useEditorStore((s) => sameSelection(s.selection, target));
  const hovered = useEditorStore((s) => sameSelection(s.hovered, target));
  const remoteColor = useEditorStore(
    (s) => s.presence.find((p) => sameSelection(p.selection, target))?.color ?? null,
  );
  const select = useEditorStore((s) => s.select);
  const tool = useEditorStore((s) => s.tool);
  const addOpening = useEditorStore((s) => s.addOpening);
  const hover = useHover(target, active);

  // Memoised by a hash of the inputs: the wall quad, height and the openings on it.
  const hash = JSON.stringify([wall.quad, wall.height, openings]);
  const geometry = useMemo(() => {
    const prisms = wallSolids(wall, openings);
    return mergeAll(prisms.map((p) => prismGeometry(p.plan, p.bottom, p.top)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active || e.delta > 4) return;
    if (tool === "opening") {
      e.stopPropagation();
      const kind = e.nativeEvent.shiftKey ? "door" : "window";
      const defaults = defaultOpening(kind);
      const u = dot(sub({ x: e.point.x, y: e.point.z }, wall.outerA), wall.direction);
      const offset = snapOffset(u - defaults.width / 2, defaults.width, wall.length);
      const id = addOpening(storeyId, { ...defaults, wallIndex: wall.index, offset });
      select({ kind: "opening", storeyId, id });
      return;
    }
    if (tool === "select") {
      e.stopPropagation();
      select(target);
    }
  };

  const color = selected
    ? colors.accent
    : (remoteColor ?? (hovered ? colors.wallHover : colors.wall));

  return (
    <mesh
      geometry={geometry}
      position={[0, elevation, 0]}
      onClick={onClick}
      raycast={active ? undefined : noRaycast}
      castShadow
      receiveShadow
      {...hover}
    >
      <meshStandardMaterial
        color={color}
        emissive={selected ? colors.accent : (remoteColor ?? "#000000")}
        emissiveIntensity={selected ? 0.35 : remoteColor ? 0.25 : 0}
        roughness={0.9}
        transparent={!active}
        opacity={active ? 1 : INACTIVE_OPACITY}
        depthWrite={active}
      />
    </mesh>
  );
}
