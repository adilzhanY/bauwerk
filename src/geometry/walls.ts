import { add, edges, lineIntersection, scale, sub } from "./polygon";
import type { Edge } from "./polygon";
import type { Vec2 } from "./types";

/**
 * An exterior wall as a footprint quad. The building footprint is the outer
 * face of the walls; the inner face is offset inward by the wall thickness and
 * the corners are mitred so neighbouring walls meet without gaps or overlaps.
 *
 * `length` is the outer edge length, which is what opening offsets measure.
 */
export interface Wall {
  index: number;
  outerA: Vec2;
  outerB: Vec2;
  innerA: Vec2;
  innerB: Vec2;
  /** Outer length in metres. */
  length: number;
  /** Unit vector along the outer edge from A to B. */
  direction: Vec2;
  /** Unit outward normal. */
  normal: Vec2;
  /** Storey height in metres. */
  height: number;
  /** Quad in drawing order: outerA, outerB, innerB, innerA. */
  quad: [Vec2, Vec2, Vec2, Vec2];
}

function offsetLine(edge: Edge, thickness: number): [Vec2, Vec2] {
  const shift = scale(edge.normal, -thickness);
  return [add(edge.a, shift), add(edge.b, shift)];
}

/**
 * Builds every exterior wall for a counter-clockwise footprint. Returns one wall
 * per footprint vertex.
 */
export function buildWalls(footprint: readonly Vec2[], thickness: number, height: number): Wall[] {
  const es = edges(footprint);
  const n = es.length;
  const inner = es.map((e) => offsetLine(e, thickness));
  const innerCorners: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = inner[(i + n - 1) % n];
    const curr = inner[i];
    if (!prev || !curr) continue;
    // Corner i is where the inner line of edge i-1 meets the inner line of edge i.
    const meet = lineIntersection(prev[0], prev[1], curr[0], curr[1]) ?? curr[0];
    innerCorners.push(meet);
  }
  return es.map((e, i) => {
    const innerA = innerCorners[i] ?? e.a;
    const innerB = innerCorners[(i + 1) % n] ?? e.b;
    return {
      index: i,
      outerA: e.a,
      outerB: e.b,
      innerA,
      innerB,
      length: e.length,
      direction: e.direction,
      normal: e.normal,
      height,
      quad: [e.a, e.b, innerB, innerA],
    };
  });
}

/** Perpendicular distance between the outer and inner face at a point along the wall. */
export function wallThicknessAt(wall: Wall, t: number): number {
  const outer = add(wall.outerA, scale(sub(wall.outerB, wall.outerA), t));
  const inner = add(wall.innerA, scale(sub(wall.innerB, wall.innerA), t));
  const d = sub(outer, inner);
  return Math.abs(d.x * wall.normal.x + d.y * wall.normal.y);
}
