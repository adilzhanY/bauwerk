import type { ThreeEvent } from "@react-three/fiber";
import { useEditorStore } from "@/store/building";
import { useSceneColors } from "./useSceneColors";

/** Large plane at y = 0. Clicking it clears the selection. Tools hook in later. */
export function Ground() {
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const scene = useSceneColors();
  // With the map on, the tiles are the ground: keep this plane for clicks and shadows
  // only, otherwise its opaque fill is drawn after the tiles and covers them.
  const mapVisible = useEditorStore((s) => s.showMap && s.building.origin !== undefined);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return; // a drag, not a click
    clearSelection();
  };
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} onClick={onClick} receiveShadow>
      <planeGeometry args={[400, 400]} />
      {mapVisible ? (
        <shadowMaterial transparent opacity={0.25} />
      ) : (
        <meshStandardMaterial color={scene.ground} roughness={1} />
      )}
    </mesh>
  );
}
