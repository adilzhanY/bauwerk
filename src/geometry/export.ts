import { validateOpening } from "./openings";
import { area, isCounterClockwise, isSimplePolygon, pointInPolygon, edges } from "./polygon";
import type { Building, Opening, Room, Storey, Zone } from "./types";

export const EXPORT_VERSION = 1;

export interface ExportFile {
  format: "bauwerk";
  version: number;
  building: Building;
}

export type ImportErrorCode =
  | "invalidJson"
  | "notBauwerkFile"
  | "unsupportedVersion"
  | "invalidStructure"
  | "duplicateId"
  | "footprintInvalid"
  | "footprintNotCounterClockwise"
  | "wallThicknessInvalid"
  | "storeyHeightInvalid"
  | "wallIndexOutOfRange"
  | "openingOutsideWall"
  | "openingsOverlap"
  | "openingTooTall"
  | "doorNotOnFloor"
  | "openingTooSmall"
  | "roomOutsideFootprint"
  | "roomAreaMismatch"
  | "unknownZone";

export interface ImportError {
  code: ImportErrorCode;
  /** Where in the file the problem is, for example "storeys[1].openings[0]". */
  path?: string;
}

export type ImportResult = { ok: true; building: Building } | { ok: false; error: ImportError };

/** Pretty JSON, always with a dot as decimal separator, in metres. */
export function toJson(building: Building): string {
  const file: ExportFile = { format: "bauwerk", version: EXPORT_VERSION, building };
  return JSON.stringify(file, null, 2);
}

export function fromJson(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: { code: "invalidJson" } };
  }
  if (!isRecord(raw) || raw.format !== "bauwerk") {
    return { ok: false, error: { code: "notBauwerkFile" } };
  }
  if (raw.version !== EXPORT_VERSION) {
    return { ok: false, error: { code: "unsupportedVersion" } };
  }
  const structural = checkBuildingShape(raw.building, "building");
  if (structural) return { ok: false, error: structural };
  const building = raw.building as Building;
  const invariant = validateBuilding(building);
  if (invariant) return { ok: false, error: invariant };
  return { ok: true, building };
}

/** Checks every invariant from INFO.md. Returns the first violation or null. */
export function validateBuilding(b: Building): ImportError | null {
  if (!isSimplePolygon(b.footprint))
    return { code: "footprintInvalid", path: "building.footprint" };
  if (!isCounterClockwise(b.footprint)) {
    return { code: "footprintNotCounterClockwise", path: "building.footprint" };
  }
  if (!(b.wallThickness > 0))
    return { code: "wallThicknessInvalid", path: "building.wallThickness" };

  const ids = new Set<string>();
  const seen = (id: string, path: string): ImportError | null => {
    if (ids.has(id)) return { code: "duplicateId", path };
    ids.add(id);
    return null;
  };
  const dup = seen(b.id, "building.id");
  if (dup) return dup;
  const zoneIds = new Set(b.zones.map((z) => z.id));
  for (const [zi, z] of b.zones.entries()) {
    const d = seen(z.id, `building.zones[${zi}]`);
    if (d) return d;
  }

  const wallLengths = edges(b.footprint).map((e) => e.length);
  const footprintArea = area(b.footprint);

  for (const [si, s] of b.storeys.entries()) {
    const sp = `building.storeys[${si}]`;
    const d = seen(s.id, sp);
    if (d) return d;
    if (!(s.height > 0)) return { code: "storeyHeightInvalid", path: `${sp}.height` };

    for (const [oi, o] of s.openings.entries()) {
      const op = `${sp}.openings[${oi}]`;
      const d2 = seen(o.id, op);
      if (d2) return d2;
      const wallLength = wallLengths[o.wallIndex];
      if (wallLength === undefined) return { code: "wallIndexOutOfRange", path: op };
      const errors = validateOpening(o, {
        wallLength,
        storeyHeight: s.height,
        siblings: s.openings,
      });
      const first = errors[0];
      if (first !== undefined) return { code: openingCode(first), path: op };
    }

    let sum = 0;
    for (const [ri, r] of s.rooms.entries()) {
      const rp = `${sp}.rooms[${ri}]`;
      const d3 = seen(r.id, rp);
      if (d3) return d3;
      if (!r.polygon.every((p) => pointInPolygon(p, b.footprint))) {
        return { code: "roomOutsideFootprint", path: rp };
      }
      if (r.zoneId !== undefined && !zoneIds.has(r.zoneId))
        return { code: "unknownZone", path: rp };
      sum += area(r.polygon);
    }
    // Rooms are derived, so a storey without rooms is acceptable and gets them recomputed.
    if (s.rooms.length > 0 && Math.abs(sum - footprintArea) > 1e-4) {
      return { code: "roomAreaMismatch", path: `${sp}.rooms` };
    }
  }
  return null;
}

function openingCode(err: ReturnType<typeof validateOpening>[number]): ImportErrorCode {
  switch (err) {
    case "outsideWallStart":
    case "outsideWallEnd":
      return "openingOutsideWall";
    case "overlaps":
      return "openingsOverlap";
    case "tooTall":
    case "negativeSill":
      return "openingTooTall";
    case "doorNotOnFloor":
      return "doorNotOnFloor";
    case "tooSmall":
      return "openingTooSmall";
  }
}

// Structural checks. Hand written on purpose: the shape is small and a schema
// library would be the only runtime dependency of the geometry layer.

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === "string";

const bad = (path: string): ImportError => ({ code: "invalidStructure", path });

function checkVec2(v: unknown, path: string): ImportError | null {
  if (!isRecord(v) || !isNumber(v.x) || !isNumber(v.y)) return bad(path);
  return null;
}

function checkPolygon(v: unknown, path: string): ImportError | null {
  if (!Array.isArray(v)) return bad(path);
  for (const [i, p] of v.entries()) {
    const e = checkVec2(p, `${path}[${i}]`);
    if (e) return e;
  }
  return null;
}

function checkSegment(v: unknown, path: string): ImportError | null {
  if (!isRecord(v)) return bad(path);
  return checkVec2(v.a, `${path}.a`) ?? checkVec2(v.b, `${path}.b`);
}

function checkOpening(v: unknown, path: string): ImportError | null {
  if (!isRecord(v)) return bad(path);
  const o = v as Partial<Record<keyof Opening, unknown>>;
  if (!isString(o.id)) return bad(`${path}.id`);
  if (!isNumber(o.wallIndex) || !Number.isInteger(o.wallIndex)) return bad(`${path}.wallIndex`);
  if (o.kind !== "window" && o.kind !== "door") return bad(`${path}.kind`);
  for (const k of ["offset", "width", "height", "sill"] as const) {
    if (!isNumber(o[k])) return bad(`${path}.${k}`);
  }
  return null;
}

function checkRoom(v: unknown, path: string): ImportError | null {
  if (!isRecord(v)) return bad(path);
  const r = v as Partial<Record<keyof Room, unknown>>;
  if (!isString(r.id)) return bad(`${path}.id`);
  if (!isString(r.name)) return bad(`${path}.name`);
  if (!isNumber(r.area)) return bad(`${path}.area`);
  if (r.zoneId !== undefined && !isString(r.zoneId)) return bad(`${path}.zoneId`);
  return checkPolygon(r.polygon, `${path}.polygon`);
}

function checkStorey(v: unknown, path: string): ImportError | null {
  if (!isRecord(v)) return bad(path);
  const s = v as Partial<Record<keyof Storey, unknown>>;
  if (!isString(s.id)) return bad(`${path}.id`);
  if (!isString(s.name)) return bad(`${path}.name`);
  if (!isNumber(s.height)) return bad(`${path}.height`);
  if (!Array.isArray(s.openings) || !Array.isArray(s.interiorWalls) || !Array.isArray(s.rooms)) {
    return bad(path);
  }
  for (const [i, o] of s.openings.entries()) {
    const e = checkOpening(o, `${path}.openings[${i}]`);
    if (e) return e;
  }
  for (const [i, w] of (s.interiorWalls as unknown[]).entries()) {
    const e = checkSegment(w, `${path}.interiorWalls[${i}]`);
    if (e) return e;
  }
  for (const [i, r] of s.rooms.entries()) {
    const e = checkRoom(r, `${path}.rooms[${i}]`);
    if (e) return e;
  }
  return null;
}

function checkZone(v: unknown, path: string): ImportError | null {
  if (!isRecord(v)) return bad(path);
  const z = v as Partial<Record<keyof Zone, unknown>>;
  if (!isString(z.id) || !isString(z.name) || !isString(z.color)) return bad(path);
  return null;
}

function checkBuildingShape(v: unknown, path: string): ImportError | null {
  if (!isRecord(v)) return bad(path);
  const b = v as Partial<Record<keyof Building, unknown>>;
  if (!isString(b.id)) return bad(`${path}.id`);
  if (!isString(b.name)) return bad(`${path}.name`);
  if (!isNumber(b.wallThickness)) return bad(`${path}.wallThickness`);
  const fp = checkPolygon(b.footprint, `${path}.footprint`);
  if (fp) return fp;
  if (!Array.isArray(b.storeys) || !Array.isArray(b.zones)) return bad(path);
  for (const [i, s] of b.storeys.entries()) {
    const e = checkStorey(s, `${path}.storeys[${i}]`);
    if (e) return e;
  }
  for (const [i, z] of b.zones.entries()) {
    const e = checkZone(z, `${path}.zones[${i}]`);
    if (e) return e;
  }
  return null;
}
