import { Suspense, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, TextureLoader } from "three";
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
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Quad from the four plan corners, lying flat with the image upright. */
function tileGeometry(placed: PlacedTile): BufferGeometry {
  const [nw, ne, se, sw] = placed.corners;
  const g = new BufferGeometry();
  // Plan (x, y) becomes world (x, 0, y). Texture v = 1 is the top of the image (north).
  const positions = new Float32Array([nw.x, 0, nw.y, ne.x, 0, ne.y, se.x, 0, se.y, sw.x, 0, sw.y]);
  const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  g.setAttribute("position", new BufferAttribute(positions, 3));
  g.setAttribute("uv", new BufferAttribute(uvs, 2));
  g.setAttribute("normal", new BufferAttribute(normals, 3));
  // Two triangles, wound so the face points up (+Y) when seen from above.
  g.setIndex([0, 2, 1, 0, 3, 2]);
  return g;
}
