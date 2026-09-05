import { useState } from "react";
import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { bounds, distance, snapPoint } from "@/geometry/polygon";
import { GRID_SIZE } from "@/geometry/types";
import type { Vec2 } from "@/geometry/types";
import { colors } from "@/lib/colors";
import { formatMetres } from "@/lib/format";
import { useEditorStore } from "@/store/building";
import { storeyElevation } from "@/store/selectors";
import { pointOnLevel } from "./plane";

/** Click two grid points, read the distance. Escape clears (handled by the shortcut hook). */
export function MeasureTool() {
  const building = useEditorStore((s) => s.building);
  const activeStoreyId = useEditorStore((s) => s.activeStoreyId);
  const language = useEditorStore((s) => s.language);
  const measurement = useEditorStore((s) => s.measurement);
  const setMeasurement = useEditorStore((s) => s.setMeasurement);
  const [start, setStart] = useState<Vec2 | null>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);

  const elevation = activeStoreyId ? storeyElevation(building, activeStoreyId) : 0;
  const { min, max } = bounds(building.footprint);
  const size = Math.max(max.x - min.x, max.y - min.y) + 40;
  const centre: [number, number, number] = [
    (min.x + max.x) / 2,
    elevation + 0.01,
    (min.y + max.y) / 2,
  ];

  const snap = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const hit = pointOnLevel(e, elevation);
    return hit ? snapPoint(hit, GRID_SIZE) : null;
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    const p = snap(e);
    if (!p) return;
    if (!start) {
      setMeasurement(null);
      setStart(p);
      return;
    }
    setMeasurement({ a: start, b: p });
    setStart(null);
  };

  const a = measurement?.a ?? start;
  const b = measurement?.b ?? cursor;
  const y = elevation + 0.06;

  return (
    <group>
      <mesh
        position={centre}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={(e) => {
          setCursor(snap(e));
        }}
        onClick={onClick}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {a && b && (
        <>
          <Line
            points={[
              [a.x, y, a.y],
              [b.x, y, b.y],
            ]}
            color={colors.warning}
            lineWidth={2}
            dashed
            dashSize={0.2}
            gapSize={0.1}
          />
          <Html
            position={[(a.x + b.x) / 2, y + 0.2, (a.y + b.y) / 2]}
            center
            style={{ pointerEvents: "none" }}
          >
            <span className="rounded-pill border border-mark bg-paper/90 px-1.5 py-0.5 font-num text-xs text-mark select-none">
              {formatMetres(distance(a, b), language)}
            </span>
          </Html>
        </>
      )}
      {[a, b].map((p, i) =>
        p ? (
          <mesh key={i} position={[p.x, y, p.y]}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshBasicMaterial color={colors.warning} />
          </mesh>
        ) : null,
      )}
    </group>
  );
}
