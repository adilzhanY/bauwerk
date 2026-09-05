import { useEffect, useState } from "react";
import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { bounds, equals, pointInPolygon, snapPoint } from "@/geometry/polygon";
import { GRID_SIZE } from "@/geometry/types";
import type { Vec2 } from "@/geometry/types";
import { colors } from "@/lib/colors";
import { useEditorStore } from "@/store/building";
import { storeyElevation } from "@/store/selectors";
import { pointOnLevel } from "./plane";

/**
 * Click two grid points on the active storey to add a wall segment. A preview
 * line follows the pointer after the first click. Escape cancels.
 */
export function InteriorWallTool() {
  const building = useEditorStore((s) => s.building);
  const activeStoreyId = useEditorStore((s) => s.activeStoreyId);
  const addInteriorWall = useEditorStore((s) => s.addInteriorWall);
  const [start, setStart] = useState<Vec2 | null>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStart(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (activeStoreyId === null) return null;
  const elevation = storeyElevation(building, activeStoreyId);
  const { min, max } = bounds(building.footprint);
  const centre: [number, number, number] = [
    (min.x + max.x) / 2,
    elevation + 0.01,
    (min.y + max.y) / 2,
  ];
  const size = Math.max(max.x - min.x, max.y - min.y) + 4;

  const snap = (e: ThreeEvent<PointerEvent | MouseEvent>): Vec2 | null => {
    const hit = pointOnLevel(e, elevation);
    if (!hit) return null;
    const p = snapPoint(hit, GRID_SIZE);
    return pointInPolygon(p, building.footprint) ? p : null;
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    setCursor(snap(e));
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    const p = snap(e);
    if (!p) return;
    if (!start) {
      setStart(p);
      return;
    }
    if (!equals(start, p)) addInteriorWall(activeStoreyId, { a: start, b: p });
    setStart(null);
  };

  const end = cursor ?? start;

  return (
    <group>
      <mesh
        position={centre}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={onMove}
        onClick={onClick}
        onPointerOut={() => {
          setCursor(null);
        }}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {cursor && (
        <mesh position={[cursor.x, elevation + 0.05, cursor.y]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshBasicMaterial color={colors.accent} />
        </mesh>
      )}
      {start && end && (
        <Line
          points={[
            [start.x, elevation + 0.05, start.y],
            [end.x, elevation + 0.05, end.y],
          ]}
          color={colors.accent}
          lineWidth={3}
        />
      )}
    </group>
  );
}
