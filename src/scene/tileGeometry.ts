import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import type { PlacedTile } from "@/geometry/tiles";

/** Quad from the four plan corners, lying flat with the image upright, face up. */
export function tileGeometry(placed: PlacedTile): BufferGeometry {
  const [nw, ne, se, sw] = placed.corners;
  const g = new BufferGeometry();
  // Plan (x, y) becomes world (x, 0, y). Texture v = 1 is the top of the image (north).
  const positions = new Float32Array([nw.x, 0, nw.y, ne.x, 0, ne.y, se.x, 0, se.y, sw.x, 0, sw.y]);
  const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  g.setAttribute("position", new BufferAttribute(positions, 3));
  g.setAttribute("uv", new BufferAttribute(uvs, 2));
  g.setAttribute("normal", new BufferAttribute(normals, 3));
  // Two triangles. The winding that faces up depends on the corner order, which the
  // plan rotation can flip, so it is derived from the cross product instead of assumed.
  const up = new Vector3()
    .subVectors(new Vector3(se.x, 0, se.y), new Vector3(nw.x, 0, nw.y))
    .cross(new Vector3(ne.x, 0, ne.y).sub(new Vector3(nw.x, 0, nw.y))).y;
  g.setIndex(up > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
  return g;
}
