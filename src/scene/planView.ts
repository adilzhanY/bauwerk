import type { Vec2 } from "@/geometry/types";

export interface PlanCamera {
  /** World position of the orthographic camera, straight above the footprint centre. */
  position: [number, number, number];
  /** Orthographic zoom so the footprint fits with a margin, in pixels per metre. */
  zoom: number;
  target: [number, number, number];
}

/**
 * Orthographic top-down camera over the active storey. Zoom is pixels per metre:
 * the footprint plus a 2 m margin fills the smaller viewport dimension.
 */
export function planCamera(
  bounds: { min: Vec2; max: Vec2 },
  viewport: { width: number; height: number },
  elevation: number,
  margin = 2,
): PlanCamera {
  const cx = (bounds.min.x + bounds.max.x) / 2;
  const cz = (bounds.min.y + bounds.max.y) / 2;
  const w = bounds.max.x - bounds.min.x + 2 * margin;
  const h = bounds.max.y - bounds.min.y + 2 * margin;
  const zoom = Math.max(1, Math.min(viewport.width / w, viewport.height / h));
  return { position: [cx, elevation + 50, cz], zoom, target: [cx, elevation, cz] };
}

/** Maps a screen pixel to a plan point under the orthographic plan camera. */
export function planPointFromScreen(
  camera: PlanCamera,
  viewport: { width: number; height: number },
  px: number,
  py: number,
): Vec2 {
  const dx = (px - viewport.width / 2) / camera.zoom;
  const dy = (py - viewport.height / 2) / camera.zoom;
  // Camera looks down -Y with up = -Z, so screen up is plan -y (north up on screen).
  return { x: camera.position[0] + dx, y: camera.position[2] + dy };
}
