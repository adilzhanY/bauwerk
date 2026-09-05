import { Suspense, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { DoubleSide, TextureLoader } from "three";
import { tileGeometry } from "./tileGeometry";
import { placeTiles } from "@/geometry/tiles";
import type { PlacedTile } from "@/geometry/tiles";
import { OSM_MAX_ZOOM } from "@/geometry/tiles";
import { useEditorStore } from "@/store/building";

const RADIUS_METRES = 120;

/**
 * OpenStreetMap raster tiles on the ground around the origin, at true scale and
 * rotated with the plan. Rendered below the grid and the slab, not raycast, so
 * every tool works through it. Tiles that fail to load simply stay missing.
 */
export function MapUnderlay() {
  const origin = useEditorStore((s) => s.building.origin);
  const showMap = useEditorStore((s) => s.showMap);
  const opacity = useEditorStore((s) => s.mapOpacity);
  const tiles = useMemo(
    () => (origin ? placeTiles(origin, OSM_MAX_ZOOM, RADIUS_METRES) : []),
    [origin],
  );
  if (!origin || !showMap) return null;
  return (
    <group>
      {tiles.map((t) => (
        <Suspense key={t.url} fallback={null}>
          <Tile placed={t} opacity={opacity} />
        </Suspense>
      ))}
    </group>
  );
}

function Tile({ placed, opacity }: { placed: PlacedTile; opacity: number }) {
  const texture = useLoader(TextureLoader, placed.url, (loader) => {
    loader.setCrossOrigin("anonymous");
  });
  const geometry = useMemo(() => tileGeometry(placed), [placed]);
  return (
    <mesh geometry={geometry} position={[0, 0.002, 0]} raycast={() => null} renderOrder={-1}>
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite
        toneMapped={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
