import { Plane, Vector3 } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Vec2 } from "@/geometry/types";

const scratch = new Vector3();

/** Where the pointer ray hits the horizontal plane at height y, as a plan point. */
export function pointOnLevel(e: ThreeEvent<PointerEvent | MouseEvent>, y: number): Vec2 | null {
  const plane = new Plane(new Vector3(0, 1, 0), -y);
  const hit = e.ray.intersectPlane(plane, scratch);
  return hit ? { x: hit.x, y: hit.z } : null;
}

/** Where the pointer ray hits a vertical plane through `origin` with plan normal `normal`. */
export function pointOnVertical(
  e: ThreeEvent<PointerEvent | MouseEvent>,
  origin: Vec2,
  normal: Vec2,
): Vec2 | null {
  const n = new Vector3(normal.x, 0, normal.y);
  const plane = new Plane().setFromNormalAndCoplanarPoint(n, new Vector3(origin.x, 0, origin.y));
  const hit = e.ray.intersectPlane(plane, scratch);
  return hit ? { x: hit.x, y: hit.z } : null;
}
