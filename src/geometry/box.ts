import { PRESET_IDS, defaultConstructions } from "@/geometry/constructions";
import { clampOpening } from "@/geometry/openings";
import { centroid, edges, isCounterClockwise } from "@/geometry/polygon";
import { computeRooms } from "@/geometry/rooms";
import type { Building, GeoOrigin, Roof, Storey, Vec2 } from "@/geometry/types";
import { DEFAULT_WALL_THICKNESS, HEATED_TEMPERATURE } from "@/geometry/types";
import { defaultRoomName, defaultStoreyName } from "@/i18n";
import type { Language } from "@/i18n";

/** Construction era of a new building, mapped onto the preset constructions. */
export type Era = "pre1918" | "1970s" | "insulated";

export interface BoxSpec {
  name: string;
  width: number;
  depth: number;
  storeys: number;
  storeyHeight: number;
  roof: Roof["kind"];
  era: Era;
  /** Plan point the box is centred on. */
  centre: Vec2;
  /** Optional map anchor retained when replacing an existing building. */
  origin?: GeoOrigin;
}

export const BOX_LIMITS = {
  width: { min: 3, max: 60 },
  depth: { min: 3, max: 60 },
  storeys: { min: 1, max: 12 },
  storeyHeight: { min: 2.2, max: 5 },
} as const;

type ConstructionAssignment = Pick<
  Building,
  | "wallConstructionId"
  | "floorConstructionId"
  | "roofConstructionId"
  | "windowConstructionId"
  | "doorConstructionId"
>;

const ERA_ASSIGNMENT: Record<Era, ConstructionAssignment> = {
  pre1918: {
    wallConstructionId: PRESET_IDS.wallBrick,
    floorConstructionId: PRESET_IDS.floorBare,
    roofConstructionId: PRESET_IDS.roofBare,
    windowConstructionId: PRESET_IDS.glazingSingle,
    doorConstructionId: PRESET_IDS.doorOld,
  },
  "1970s": {
    wallConstructionId: PRESET_IDS.wall1970,
    floorConstructionId: PRESET_IDS.floorBare,
    roofConstructionId: PRESET_IDS.roofBare,
    windowConstructionId: PRESET_IDS.glazingDouble,
    doorConstructionId: PRESET_IDS.doorOld,
  },
  insulated: {
    wallConstructionId: PRESET_IDS.wallInsulated,
    floorConstructionId: PRESET_IDS.floorInsulated,
    roofConstructionId: PRESET_IDS.roofInsulated,
    windowConstructionId: PRESET_IDS.glazingTriple,
    doorConstructionId: PRESET_IDS.doorInsulated,
  },
};

const ROOF_DEFAULTS: Record<Roof["kind"], Roof> = {
  flat: { kind: "flat", pitch: 0, overhang: 0, ridgeAxis: "x", parapet: 0.3, heatedAttic: false },
  gable: {
    kind: "gable",
    pitch: 40,
    overhang: 0.4,
    ridgeAxis: "x",
    parapet: 0,
    heatedAttic: false,
  },
  hip: { kind: "hip", pitch: 30, overhang: 0.4, ridgeAxis: "x", parapet: 0, heatedAttic: false },
};

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const roundSize = (v: number) => Math.round(v * 1e5) / 1e5;
const RECTANGLE_TOLERANCE = 1e-5;

/** Axis-aligned rectangle centred on `centre`, counter-clockwise. */
export function rectangleAround(centre: Vec2, width: number, depth: number): Vec2[] {
  const hx = width / 2;
  const hy = depth / 2;
  return [
    { x: round(centre.x - hx), y: round(centre.y - hy) },
    { x: round(centre.x + hx), y: round(centre.y - hy) },
    { x: round(centre.x + hx), y: round(centre.y + hy) },
    { x: round(centre.x - hx), y: round(centre.y + hy) },
  ];
}

/** Width and depth when the footprint is a rectangle at any angle, else null. */
export function rectangleOf(footprint: readonly Vec2[]): { width: number; depth: number } | null {
  if (footprint.length !== 4) return null;
  const es = edges(footprint);
  const [a, b, c, d] = es;
  if (!a || !b || !c || !d) return null;
  const perpendicular = Math.abs(a.direction.x * b.direction.x + a.direction.y * b.direction.y);
  const closeLength = (x: number, y: number) =>
    Math.abs(x - y) <= RECTANGLE_TOLERANCE * Math.max(1, x, y);
  const oppositeSidesMatch = closeLength(a.length, c.length) && closeLength(b.length, d.length);
  if (
    a.length <= RECTANGLE_TOLERANCE ||
    b.length <= RECTANGLE_TOLERANCE ||
    perpendicular > RECTANGLE_TOLERANCE ||
    !oppositeSidesMatch
  )
    return null;
  return { width: roundSize(a.length), depth: roundSize(b.length) };
}

/**
 * A new building from a handful of numbers. One heated zone, empty storeys, the
 * era's constructions and roof. Everything after that is normal editing.
 */
export function buildingFromBox(
  spec: BoxSpec,
  language: Language,
  makeId: (prefix: string) => string,
): Building {
  validateSpec(spec);
  const footprint = rectangleAround(spec.centre, spec.width, spec.depth);
  const zone = makeId("zone");
  const storeys: Storey[] = Array.from({ length: spec.storeys }, (_, i) => {
    const rooms = computeRooms(footprint, [], [], {
      createId: () => makeId("room"),
      defaultName: (n) => defaultRoomName(n, language),
    });
    for (const r of rooms) r.zoneId = zone;
    return {
      id: makeId("storey"),
      name: defaultStoreyName(i, language),
      height: spec.storeyHeight,
      openings: [],
      interiorWalls: [],
      rooms,
    };
  });
  return {
    id: makeId("building"),
    name: spec.name,
    footprint,
    wallThickness: DEFAULT_WALL_THICKNESS,
    storeys,
    zones: [
      {
        id: zone,
        name: language === "de" ? "Beheizt" : "Heated",
        color: "#e76f51",
        heated: true,
        temperature: HEATED_TEMPERATURE,
      },
    ],
    constructions: defaultConstructions(language),
    ...ERA_ASSIGNMENT[spec.era],
    roof: { ...ROOF_DEFAULTS[spec.roof] },
    bridgeDetail: spec.era === "insulated" ? "good" : "poor",
    ...(spec.origin ? { origin: { ...spec.origin } } : {}),
  };
}

function validateSpec(spec: BoxSpec): void {
  const values = [
    spec.width,
    spec.depth,
    spec.storeys,
    spec.storeyHeight,
    spec.centre.x,
    spec.centre.y,
  ];
  if (!values.every(Number.isFinite)) throw new Error("Building dimensions must be finite numbers");
  if (spec.width < BOX_LIMITS.width.min || spec.width > BOX_LIMITS.width.max)
    throw new Error("Building width is outside the supported range");
  if (spec.depth < BOX_LIMITS.depth.min || spec.depth > BOX_LIMITS.depth.max)
    throw new Error("Building depth is outside the supported range");
  if (
    !Number.isInteger(spec.storeys) ||
    spec.storeys < BOX_LIMITS.storeys.min ||
    spec.storeys > BOX_LIMITS.storeys.max
  )
    throw new Error("Storey count is outside the supported range");
  if (
    spec.storeyHeight < BOX_LIMITS.storeyHeight.min ||
    spec.storeyHeight > BOX_LIMITS.storeyHeight.max
  )
    throw new Error("Storey height is outside the supported range");
}

/**
 * Resizes a rectangular footprint about its centre and pulls every opening and
 * radiator back inside its wall. Interior walls stay where they are; rooms are
 * recomputed by the caller.
 */
export function resizeRectangle(building: Building, width: number, depth: number): Building {
  const current = rectangleOf(building.footprint);
  if (!current) return building;
  const centre = centroid(building.footprint);
  const first = building.footprint[0];
  const second = building.footprint[1];
  if (!first || !second) return building;
  const angle = Math.atan2(second.y - first.y, second.x - first.x);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const footprint = rectangleAround({ x: 0, y: 0 }, width, depth).map((p) => ({
    x: round(centre.x + p.x * cos - p.y * sin),
    y: round(centre.y + p.x * sin + p.y * cos),
  }));
  const ordered = isCounterClockwise(footprint) ? footprint : [...footprint].reverse();
  const lengths = edges(ordered).map((e) => e.length);
  return {
    ...building,
    footprint: ordered,
    storeys: building.storeys.map((s) => ({
      ...s,
      openings: s.openings.map((o) =>
        o.interior
          ? o
          : clampOpening(o, {
              wallLength: lengths[o.wallIndex] ?? 0,
              storeyHeight: s.height,
              siblings: s.openings,
            }),
      ),
      radiators: s.radiators?.filter(
        (r) => r.offset + r.width <= (lengths[r.wallIndex] ?? 0) + 1e-9,
      ),
    })),
  };
}
