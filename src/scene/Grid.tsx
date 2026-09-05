import { Grid as DreiGrid } from "@react-three/drei";
import { GRID_SIZE } from "@/geometry/types";
import { useEditorStore } from "@/store/building";

export function Grid() {
  const show = useEditorStore((s) => s.showGrid);
  if (!show) return null;
  return (
    <DreiGrid
      position={[0, 0.002, 0]}
      args={[200, 200]}
      cellSize={GRID_SIZE}
      cellThickness={0.6}
      cellColor="#2b3040"
      sectionSize={5}
      sectionThickness={1}
      sectionColor="#3a4153"
      fadeDistance={80}
      fadeStrength={1.5}
      infiniteGrid
      followCamera={false}
    />
  );
}
