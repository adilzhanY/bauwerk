import { useMemo } from "react";
import { EdgesGeometry } from "three";
import type { BufferGeometry } from "three";
import { useSceneColors } from "./useSceneColors";

/** Edge lines of a geometry, the halftone underlay look for storeys that are not being edited. */
export function Outline({
  geometry,
  position,
}: {
  geometry: BufferGeometry;
  position?: [number, number, number];
}) {
  const scene = useSceneColors();
  const edges = useMemo(() => new EdgesGeometry(geometry, 20), [geometry]);
  return (
    <lineSegments geometry={edges} position={position} raycast={() => null}>
      <lineBasicMaterial color={scene.gridStrong} transparent opacity={0.9} depthWrite={false} />
    </lineSegments>
  );
}
