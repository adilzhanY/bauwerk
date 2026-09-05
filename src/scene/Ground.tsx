import type { ThreeEvent } from "@react-three/fiber";
import { useEditorStore } from "@/store/building";

/** Large plane at y = 0. Clicking it clears the selection. Tools hook in later. */
export function Ground() {
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return; // a drag, not a click
    clearSelection();
  };
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} onClick={onClick} receiveShadow>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color="#12151b" roughness={1} />
    </mesh>
  );
}
