import { Suspense } from "react";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { useEditorStore } from "@/store/building";
import type { Underlay as UnderlayData } from "@/store/building";

/** The floor plan image on the ground, under everything else. Not raycast, so tools work through it. */
export function Underlay() {
  const underlay = useEditorStore((s) => s.underlay);
  if (!underlay) return null;
  return (
    <Suspense fallback={null}>
      <UnderlayPlane key={underlay.url} underlay={underlay} />
    </Suspense>
  );
}

function UnderlayPlane({ underlay }: { underlay: UnderlayData }) {
  const texture = useLoader(TextureLoader, underlay.url);
  const w = underlay.widthMetres;
  const h = w * underlay.aspect;
  return (
    <mesh
      position={[underlay.x, 0.004, underlay.y]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={() => null}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={underlay.opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
