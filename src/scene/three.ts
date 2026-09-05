import type { BufferGeometry } from "three";
import { ExtrudeGeometry, Shape, ShapeGeometry, Vector2 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Vec2 } from "@/geometry/types";

/**
 * The model's floor plan lives on the XZ plane with Y up. A plan point (x, y)
 * becomes world (x, elevation, y). Shapes are built in XY and rotated down.
 */
export function planShape(polygon: readonly Vec2[]): Shape {
  return new Shape(polygon.map((p) => new Vector2(p.x, -p.y)));
}

/** Vertical prism over a plan polygon from `bottom` to `top` metres. */
export function prismGeometry(plan: readonly Vec2[], bottom: number, top: number): BufferGeometry {
  const geometry = new ExtrudeGeometry(planShape(plan), {
    depth: Math.max(top - bottom, 1e-4),
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottom, 0);
  return geometry;
}

/** Flat polygon lying on the plan at height `y`. */
export function flatGeometry(plan: readonly Vec2[], y: number): BufferGeometry {
  const geometry = new ShapeGeometry(planShape(plan));
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

export function mergeAll(geometries: BufferGeometry[]): BufferGeometry {
  if (geometries.length === 1 && geometries[0]) return geometries[0];
  const merged = mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  return merged;
}

/** Rotation about Y that turns local +X into the plan direction (dx, dy). */
export const yawFor = (direction: Vec2): number => Math.atan2(-direction.y, direction.x);
