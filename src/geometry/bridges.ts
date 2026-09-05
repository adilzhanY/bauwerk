import { validateOpening } from "./openings";
import { edges, pointOnSegment } from "./polygon";
import type { Building, Storey, Vec2 } from "./types";

/**
 * Linear thermal bridges from the geometry. Every length the model already knows
 * becomes a bridge with a type, and the extra loss is ΔH_T = Σ ψ · l in W/K.
 *
 * ψ values in W/(m·K). "good" is the reference detail level of DIN 4108
 * Beiblatt 2 (the level assumed when a certificate uses the 0.05 W/(m²K)
 * blanket allowance); "poor" is the uninsulated stock without detail design,
 * taken from typical catalogue values for old buildings. Both are starting
 * points a consultant overrides, not survey results.
 */
export type BridgeType = "corner" | "opening" | "slabEdge" | "roofEdge" | "floorJoint" | "junction";
export type BridgeDetail = "good" | "poor";

export const PSI: Record<BridgeDetail, Record<BridgeType, number>> = {
  good: {
    corner: 0.05,
    opening: 0.04,
    slabEdge: 0.1,
    roofEdge: 0.1,
    floorJoint: 0.05,
    junction: 0.03,
  },
  poor: {
    corner: 0.15,
    opening: 0.2,
    slabEdge: 0.5,
    roofEdge: 0.3,
    floorJoint: 0.2,
    junction: 0.1,
  },
};

export interface Bridge {
  type: BridgeType;
  storeyId: string;
  /** Metres. */
  length: number;
  /** Segments to draw: plan points with a height range each. */
  segments: { a: Vec2; b: Vec2; z0: number; z1: number }[];
}

export interface BridgeSummary {
  bridges: Bridge[];
  /** Total length per type in metres. */
  lengths: Record<BridgeType, number>;
  /** Σ ψ · l per type in W/K. */
  losses: Record<BridgeType, number>;
  total: number;
}

const zero = (): Record<BridgeType, number> => ({
  corner: 0,
  opening: 0,
  slabEdge: 0,
  roofEdge: 0,
  floorJoint: 0,
  junction: 0,
});

export function extractBridges(building: Building): Bridge[] {
  const fp = building.footprint;
  const es = edges(fp);
  const perimeterSegments = (z: number) => es.map((e) => ({ a: e.a, b: e.b, z0: z, z1: z }));
  const perimeter = es.reduce((s, e) => s + e.length, 0);
  const out: Bridge[] = [];
  let elevation = 0;
  building.storeys.forEach((storey, index) => {
    const top = elevation + storey.height;
    // Outer corners: one vertical line per footprint vertex, storey high.
    for (const p of fp) {
      out.push({
        type: "corner",
        storeyId: storey.id,
        length: storey.height,
        segments: [{ a: p, b: p, z0: elevation, z1: top }],
      });
    }
    // Window and door perimeters.
    for (const o of storey.openings) {
      const e = es[o.wallIndex];
      if (!e) continue;
      const onWall = storey.openings.filter((x) => x.wallIndex === o.wallIndex);
      if (
        validateOpening(o, { wallLength: e.length, storeyHeight: storey.height, siblings: onWall })
          .length > 0
      )
        continue;
      const a = { x: e.a.x + e.direction.x * o.offset, y: e.a.y + e.direction.y * o.offset };
      const b = { x: a.x + e.direction.x * o.width, y: a.y + e.direction.y * o.width };
      const z0 = elevation + o.sill;
      const z1 = z0 + o.height;
      out.push({
        type: "opening",
        storeyId: storey.id,
        length: 2 * (o.width + o.height),
        segments: [
          { a, b, z0, z1: z0 },
          { a, b, z0: z1, z1 },
          { a, b: a, z0, z1 },
          { a: b, b, z0, z1 },
        ],
      });
    }
    // Slab edge on the ground storey, intermediate floor joints above, roof edge on top.
    if (index === 0)
      out.push({
        type: "slabEdge",
        storeyId: storey.id,
        length: perimeter,
        segments: perimeterSegments(elevation),
      });
    else
      out.push({
        type: "floorJoint",
        storeyId: storey.id,
        length: perimeter,
        segments: perimeterSegments(elevation),
      });
    if (index === building.storeys.length - 1)
      out.push({
        type: "roofEdge",
        storeyId: storey.id,
        length: perimeter,
        segments: perimeterSegments(top),
      });
    // Interior wall ends touching the exterior wall.
    for (const wall of storey.interiorWalls) {
      for (const p of [wall.a, wall.b]) {
        if (es.some((e) => pointOnSegment(p, e.a, e.b, 1e-6))) {
          out.push({
            type: "junction",
            storeyId: storey.id,
            length: storey.height,
            segments: [{ a: p, b: p, z0: elevation, z1: top }],
          });
        }
      }
    }
    elevation = top;
  });
  return out;
}

export function summarizeBridges(building: Building, detail: BridgeDetail): BridgeSummary {
  const bridges = extractBridges(building);
  const lengths = zero();
  const losses = zero();
  for (const b of bridges) {
    lengths[b.type] += b.length;
    losses[b.type] += PSI[detail][b.type] * b.length;
  }
  const total = Object.values(losses).reduce((s, v) => s + v, 0);
  return { bridges, lengths, losses, total };
}

export const bridgeDetailOf = (building: Building): BridgeDetail => building.bridgeDetail ?? "poor";

export function storeyOf(building: Building, id: string): Storey | undefined {
  return building.storeys.find((s) => s.id === id);
}
