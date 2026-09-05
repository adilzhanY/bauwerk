import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { placeTiles, OSM_MAX_ZOOM } from "@/geometry/tiles";
import { tileGeometry } from "./tileGeometry";

function faceNormalY(geometry: ReturnType<typeof tileGeometry>, tri: number): number {
  const index = geometry.getIndex();
  const pos = geometry.getAttribute("position");
  if (!index) throw new Error("indexed geometry expected");
  const p = (i: number) => new Vector3().fromBufferAttribute(pos, index.getX(tri * 3 + i));
  const a = p(0);
  return new Vector3().subVectors(p(1), a).cross(new Vector3().subVectors(p(2), a)).y;
}

describe("tileGeometry", () => {
  it.each([0, 90, 200])("faces up for rotation %d so tiles are visible from above", (rotation) => {
    const tiles = placeTiles({ lat: 52.516, lon: 13.378, rotation }, OSM_MAX_ZOOM, 60);
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      const g = tileGeometry(tile);
      expect(faceNormalY(g, 0)).toBeGreaterThan(0);
      expect(faceNormalY(g, 1)).toBeGreaterThan(0);
    }
  });
});
