import { buildWalls } from "@/geometry/walls";
import { edges, pointInPolygon, pointOnSegment, sub, dot } from "@/geometry/polygon";
import { validateOpening } from "@/geometry/openings";
import type { Building, Storey, Vec2 } from "@/geometry/types";

export const EYE_HEIGHT = 1.6;
export const BODY_RADIUS = 0.25;

/**
 * Keeps a walking position inside the footprint and out of interior walls, and
 * lets it pass through door spans on exterior walls. Pure, so the collision
 * rule is testable without a camera.
 */
export function constrainWalk(
  building: Building,
  storey: Storey,
  from: Vec2,
  to: Vec2,
  thickness: number,
): Vec2 {
  const inner = innerFootprint(building, thickness);
  let p = to;
  // Exterior: stay inside the inner face unless stepping through a door.
  if (!pointInPolygon(p, inner)) {
    if (!throughDoor(building, storey, p)) p = slide(from, to, inner);
  }
  // Interior walls: keep a body radius away from every segment.
  for (const wall of storey.interiorWalls) {
    const d = distanceToSegment(p, wall.a, wall.b);
    if (d < BODY_RADIUS) {
      const n = normalAwayFrom(p, wall.a, wall.b);
      p = { x: p.x + n.x * (BODY_RADIUS - d), y: p.y + n.y * (BODY_RADIUS - d) };
    }
  }
  return p;
}

function innerFootprint(building: Building, thickness: number): Vec2[] {
  const walls = buildWalls(building.footprint, thickness, 1);
  return walls.map((w) => w.innerA);
}

function throughDoor(building: Building, storey: Storey, p: Vec2): boolean {
  const es = edges(building.footprint);
  for (const o of storey.openings) {
    if (o.kind !== "door") continue;
    const e = es[o.wallIndex];
    if (!e) continue;
    if (
      validateOpening(o, {
        wallLength: e.length,
        storeyHeight: storey.height,
        siblings: storey.openings,
      }).length > 0
    )
      continue;
    const along = dot(sub(p, e.a), e.direction);
    const off = dot(sub(p, e.a), e.normal);
    if (
      along >= o.offset - BODY_RADIUS &&
      along <= o.offset + o.width + BODY_RADIUS &&
      off > -1.5 &&
      off < 1.5
    )
      return true;
  }
  return false;
}

/** Tries the full move, then each axis alone, else stays. */
function slide(from: Vec2, to: Vec2, polygon: Vec2[]): Vec2 {
  const candidates: Vec2[] = [
    { x: to.x, y: from.y },
    { x: from.x, y: to.y },
  ];
  for (const c of candidates) if (pointInPolygon(c, polygon)) return c;
  return from;
}

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const d = sub(b, a);
  const len2 = d.x * d.x + d.y * d.y;
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.min(1, Math.max(0, dot(sub(p, a), d) / len2));
  const q = { x: a.x + d.x * t, y: a.y + d.y * t };
  return Math.hypot(p.x - q.x, p.y - q.y);
}

function normalAwayFrom(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const d = sub(b, a);
  const len = Math.hypot(d.x, d.y) || 1;
  const n = { x: -d.y / len, y: d.x / len };
  const side = dot(sub(p, a), n) >= 0 ? 1 : -1;
  return { x: n.x * side, y: n.y * side };
}

export const isOnBoundary = (p: Vec2, polygon: Vec2[]): boolean =>
  edges(polygon).some((e) => pointOnSegment(p, e.a, e.b, 1e-6));
