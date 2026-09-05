import { useMemo } from "react";
import { findConstruction } from "@/geometry/constructions";
import { buildWalls } from "@/geometry/walls";
import { useEditorStore } from "@/store/building";
import { storeyElevation } from "@/store/selectors";
import { flatGeometry } from "./three";
import { uValueColor } from "./uValueColor";

/** Thin band on top of each exterior wall of every storey, keyed to the wall construction's U-value. */
export function UValueBands() {
  const show = useEditorStore((s) => s.showUValueBands);
  const building = useEditorStore((s) => s.building);
  const u = findConstruction(building.constructions, building.wallConstructionId)?.uValue ?? 1;
  const color = uValueColor(u);
  const geometries = useMemo(() => {
    if (!show) return [];
    return building.storeys.map((storey) => {
      const top = storeyElevation(building, storey.id) + storey.height + 0.005;
      return buildWalls(building.footprint, building.wallThickness, storey.height).map((w) =>
        flatGeometry(w.quad, top),
      );
    });
  }, [show, building]);
  if (!show) return null;
  return (
    <group>
      {geometries.flat().map((g, i) => (
        <mesh key={i} geometry={g} raycast={() => null}>
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}
