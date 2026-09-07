import { ZONE_COLORS_IMPORT } from "./ifc-colors";
import { DEFAULT_ASSIGNMENT, defaultConstructions } from "./constructions";
import { fromUtm } from "./geo";
import {
  area,
  centroid,
  ensureCounterClockwise,
  pointInPolygon,
  edges as polygonEdges,
  sub,
  dot,
} from "./polygon";
import { cleanRing, clipSegmentToPolygon, computeRooms, facesOfSegments } from "./rooms";
import { asEnum, asList, asNumber, asRef, asRefs, asString, parseStep } from "./step-parse";
import type { StepEntity, StepFile, StepValue } from "./step-parse";
import type { Building, Construction, Opening, Segment, Storey, Vec2, Zone } from "./types";

/**
 * Reads an IFC4 (or IFC2X3) STEP file into the editor's model. The editor holds
 * far less than IFC can: one footprint per building, rectangular openings on
 * exterior walls, interior walls as centre lines, rooms derived from walls.
 * Everything else is reduced or listed in the report, never dropped silently.
 *
 * Reduction rules:
 * - Storeys from IfcBuildingStorey, ordered by Elevation; height is the gap to
 *   the next storey, or the tallest wall extrusion on the last one.
 * - Exterior walls (IsExternal or SOLIDWALL) with a polyline or rectangle profile
 *   give plan quads; the footprint is the outer face of their union on the
 *   lowest storey; wall thickness is the median quad offset.
 * - Openings from IfcRelVoidsElement with a rectangular extrusion: the plan rect
 *   is projected on the nearest footprint edge; sill and height from the extrusion.
 * - Interior (PARTITIONING or IsExternal = false) walls become centre lines.
 * - IfcSpace names attach to recomputed rooms by centroid; IfcZone groups become
 *   zones and their spaces' rooms are assigned.
 * - Pset_WallCommon ThermalTransmittance creates constructions.
 * - IfcMapConversion with an EPSG:258xx CRS sets the origin.
 */

export interface ImportReportItem {
  code:
    | "curvedWall"
    | "unsupportedProfile"
    | "nonRectangularOpening"
    | "noStoreys"
    | "noFootprint"
    | "openingOffWall"
    | "spaceUnmatched"
    | "unknownGeometry"
    | "curtainWall"
    | "slopedWall";
  entity: string;
  detail?: string;
}

export interface IfcImportResult {
  ok: true;
  building: Building;
  report: ImportReportItem[];
  stats: { storeys: number; walls: number; openings: number; rooms: number; zones: number };
}

export interface IfcImportFailure {
  ok: false;
  error: "parse" | "noStoreys" | "noFootprint";
  message: string;
  report: ImportReportItem[];
}

interface Ctx {
  file: StepFile;
  report: ImportReportItem[];
  ids: () => string;
  lengthScale: number;
  storeyPlacements: Set<number>;
}

const get = (ctx: Ctx, id: number | undefined): StepEntity | undefined =>
  id === undefined ? undefined : ctx.file.entities.get(id);
const byType = (ctx: Ctx, type: string): StepEntity[] =>
  [...ctx.file.entities.values()].filter((e) => e.type === type);

export function importIfc(
  text: string,
  language: "en" | "de" = "en",
): IfcImportResult | IfcImportFailure {
  let file: StepFile;
  const report: ImportReportItem[] = [];
  try {
    file = parseStep(text);
  } catch (e) {
    return {
      ok: false,
      error: "parse",
      message: e instanceof Error ? e.message : String(e),
      report,
    };
  }
  let n = 0;
  const ctx: Ctx = {
    file,
    report,
    ids: () => `imp_${++n}`,
    lengthScale: lengthScaleOf(file),
    storeyPlacements: new Set(),
  };

  const rawStoreys = byType(ctx, "IFCBUILDINGSTOREY");
  ctx.storeyPlacements = new Set(
    rawStoreys
      .map((storey) => asRef(storey.args[5]))
      .filter((id): id is number => id !== undefined),
  );
  const storeyEntities = rawStoreys
    .map((e) => {
      const placement = get(ctx, asRef(e.args[5]));
      const placedElevation = placement ? placementChain(ctx, placement, false).z : undefined;
      const attributeElevation = asNumber(e.args[9]);
      const scaledAttribute =
        attributeElevation === undefined ? undefined : attributeElevation * ctx.lengthScale;
      return {
        e,
        elevation:
          placedElevation !== undefined &&
          (Math.abs(placedElevation) > 1e-9 || scaledAttribute === undefined)
            ? placedElevation
            : (scaledAttribute ?? 0),
        name: asString(e.args[2]) ?? "",
      };
    })
    .sort((a, b) => a.elevation - b.elevation);
  if (storeyEntities.length === 0) {
    report.push({ code: "noStoreys", entity: "IfcProject" });
    return { ok: false, error: "noStoreys", message: "The file has no IfcBuildingStorey", report };
  }

  // Containment: element id -> storey id.
  const containerOf = new Map<number, number>();
  for (const rel of byType(ctx, "IFCRELCONTAINEDINSPATIALSTRUCTURE")) {
    const storey = asRef(rel.args[5]);
    if (storey === undefined) continue;
    for (const el of asRefs(rel.args[4])) containerOf.set(el, storey);
  }
  // Element placements' absolute z, from local placements chained to the storey.
  const elevationOf = new Map<number, number>(storeyEntities.map((s) => [s.e.id, s.elevation]));

  // Walls with plan quads and heights.
  interface PlanWall {
    id: number;
    storey: number;
    plan: Vec2[];
    height: number;
    external: boolean;
    partition: boolean;
  }
  const walls: PlanWall[] = [];
  const isExternal = psetBooleans(ctx, "IsExternal");
  for (const w of [...byType(ctx, "IFCWALL"), ...byType(ctx, "IFCWALLSTANDARDCASE")]) {
    const storey = containerOf.get(w.id);
    if (storey === undefined) continue;
    const solid = firstSolid(ctx, w);
    if (!solid) {
      report.push({ code: "unknownGeometry", entity: `#${w.id} ${w.type}` });
      continue;
    }
    const plan = planOfSolid(ctx, solid, w);
    if (!plan) continue;
    const predefined = asEnum(w.args[8]);
    const partition = predefined === "PARTITIONING" || isExternal.get(w.id) === false;
    walls.push({
      id: w.id,
      storey,
      plan: plan.polygon,
      height: plan.depth,
      external: !partition,
      partition,
    });
  }
  for (const cw of byType(ctx, "IFCCURTAINWALL"))
    report.push({ code: "curtainWall", entity: `#${cw.id} IfcCurtainWall` });

  // Footprint: outer face of the exterior wall quads on the lowest storey that has any.
  const lowest =
    storeyEntities.find((s) => walls.some((w) => w.storey === s.e.id && w.external)) ??
    storeyEntities[0];
  if (!lowest) return { ok: false, error: "noStoreys", message: "No storeys", report };
  const exterior = walls.filter((w) => w.storey === lowest.e.id && w.external);
  const segments: Segment[] = exterior.flatMap((w) =>
    w.plan.map((p, i) => ({ a: p, b: w.plan[(i + 1) % w.plan.length] ?? p })),
  );
  const faces = facesOfSegments(segments);
  if (faces.length === 0) {
    report.push({ code: "noFootprint", entity: `storey #${lowest.e.id}` });
    return {
      ok: false,
      error: "noFootprint",
      message: "No closed exterior wall ring found",
      report,
    };
  }
  // The bounded faces are the wall quads and the enclosed interior; the footprint is
  // the outer boundary of their union: edges that belong to exactly one face, chained.
  const footprintRaw =
    outerBoundary(faces) ?? faces.reduce((best, f) => (area(f) > area(best) ? f : best));
  const footprint = ensureCounterClockwise(
    cleanRing(footprintRaw).map((p) => ({ x: round3(p.x), y: round3(p.y) })),
  );
  const fpEdges = polygonEdges(footprint);
  // Wall thickness: median distance of quad points from the footprint boundary, excluding boundary points.
  const thickness = medianThickness(exterior, footprint) ?? 0.3;

  // Constructions from ThermalTransmittance.
  const uValues = psetNumbers(ctx, "ThermalTransmittance");
  const constructions: Construction[] = defaultConstructions(language);
  const wallU = median([
    ...exterior.map((w) => uValues.get(w.id)).filter((x): x is number => x !== undefined),
  ]);
  let wallConstructionId: string = DEFAULT_ASSIGNMENT.wallConstructionId;
  if (wallU !== undefined) {
    wallConstructionId = "c_imported_wall";
    constructions.push({
      id: wallConstructionId,
      name: language === "de" ? "Importierte Wand" : "Imported wall",
      category: "wall",
      uValue: round3(wallU),
    });
  }
  const openingConstruction = (kind: "window" | "door", u: number | undefined): string => {
    if (u === undefined)
      return kind === "door"
        ? DEFAULT_ASSIGNMENT.doorConstructionId
        : DEFAULT_ASSIGNMENT.windowConstructionId;
    const id = `c_imported_${kind}_${Math.round(u * 100)}`;
    if (!constructions.some((c) => c.id === id)) {
      constructions.push({
        id,
        name: `${language === "de" ? (kind === "door" ? "Importierte Tür" : "Importiertes Fenster") : kind === "door" ? "Imported door" : "Imported window"} U ${round3(u)}`,
        category: kind,
        uValue: round3(u),
      });
    }
    return id;
  };

  // Openings: voids -> filler.
  const fillerOf = new Map<number, StepEntity>();
  for (const rel of byType(ctx, "IFCRELFILLSELEMENT")) {
    const opening = asRef(rel.args[4]);
    const filler = get(ctx, asRef(rel.args[5]));
    if (opening !== undefined && filler) fillerOf.set(opening, filler);
  }
  const openingsByStorey = new Map<number, Opening[]>();
  for (const rel of byType(ctx, "IFCRELVOIDSELEMENT")) {
    const wallId = asRef(rel.args[4]);
    const openingEntity = get(ctx, asRef(rel.args[5]));
    const wall = walls.find((w) => w.id === wallId);
    if (!wall || !openingEntity) continue;
    const solid = firstSolid(ctx, openingEntity);
    const plan = solid ? planOfSolid(ctx, solid, openingEntity) : null;
    if (plan?.polygon.length !== 4) {
      report.push({
        code: "nonRectangularOpening",
        entity: `#${openingEntity.id} IfcOpeningElement`,
      });
      continue;
    }
    const filler = fillerOf.get(openingEntity.id);
    const kind: "window" | "door" = filler?.type === "IFCDOOR" ? "door" : "window";
    const interiorWallsForStorey = walls.filter(
      (candidate) => candidate.storey === wall.storey && candidate.partition,
    );
    const interiorWallIndex = interiorWallsForStorey.findIndex(
      (candidate) => candidate.id === wall.id,
    );
    const placed = wall.partition
      ? projectOpeningOnSegment(plan.polygon, centreLine(wall.plan), interiorWallIndex)
      : projectOpening(plan.polygon, fpEdges);
    if (!placed) {
      report.push({ code: "openingOffWall", entity: `#${openingEntity.id} IfcOpeningElement` });
      continue;
    }
    const height = filler
      ? (asNumber(filler.args[8]) ?? plan.depth / ctx.lengthScale) * ctx.lengthScale
      : plan.depth;
    const width = filler
      ? (asNumber(filler.args[9]) ?? placed.width / ctx.lengthScale) * ctx.lengthScale
      : placed.width;
    const sill = kind === "door" ? 0 : Math.max(0, round3(plan.z0));
    const list = openingsByStorey.get(wall.storey) ?? [];
    list.push({
      id: ctx.ids(),
      wallIndex: placed.wallIndex,
      ...(wall.partition ? { interior: true } : {}),
      kind,
      offset: round3(placed.offset + (placed.width - width) / 2),
      width: round3(width),
      height: round3(height),
      sill,
      constructionId: openingConstruction(kind, filler ? uValues.get(filler.id) : undefined),
    });
    openingsByStorey.set(wall.storey, list);
  }

  // Spaces and zones.
  const spaces = byType(ctx, "IFCSPACE").map((s) => {
    const solid = firstSolid(ctx, s);
    const plan = solid ? planOfSolid(ctx, solid, s) : null;
    return {
      e: s,
      name: asString(s.args[7]) ?? asString(s.args[2]) ?? "",
      centre: plan ? centroid(plan.polygon) : null,
    };
  });
  const spaceStorey = new Map<number, number>();
  for (const rel of byType(ctx, "IFCRELAGGREGATES")) {
    const parent = asRef(rel.args[4]);
    if (parent === undefined || !elevationOf.has(parent)) continue;
    for (const child of asRefs(rel.args[5])) spaceStorey.set(child, parent);
  }
  const zones: Zone[] = [];
  const zoneOfSpace = new Map<number, string>();
  byType(ctx, "IFCZONE").forEach((z, i) => {
    const zone: Zone = {
      id: ctx.ids(),
      name: asString(z.args[2]) ?? `Zone ${i + 1}`,
      color: ZONE_COLORS_IMPORT[i % ZONE_COLORS_IMPORT.length] ?? "#e76f51",
      heated: true,
      temperature: 20,
    };
    zones.push(zone);
    for (const rel of byType(ctx, "IFCRELASSIGNSTOGROUP")) {
      if (asRef(rel.args[6]) !== z.id) continue;
      for (const s of asRefs(rel.args[4])) zoneOfSpace.set(s, zone.id);
    }
  });

  // Storeys.
  const storeys: Storey[] = storeyEntities.map((s, i) => {
    const next = storeyEntities[i + 1];
    const wallHeights = walls.filter((w) => w.storey === s.e.id).map((w) => w.height);
    const height = next
      ? round3(next.elevation - s.elevation)
      : wallHeights.length
        ? round3(Math.max(...wallHeights))
        : 3;
    const interiorWalls: Segment[] = walls
      .filter((w) => w.storey === s.e.id && w.partition)
      .map((w) => extendToBoundary(centreLine(w.plan), footprint, thickness + 0.05))
      .flatMap((seg) => clipSegmentToPolygon(seg, footprint))
      .map((seg) => ({
        a: { x: round3(seg.a.x), y: round3(seg.a.y) },
        b: { x: round3(seg.b.x), y: round3(seg.b.y) },
      }));
    const storeyId = ctx.ids();
    const rooms = computeRooms(footprint, interiorWalls, [], {
      createId: ctx.ids,
      defaultName: (k) => (language === "de" ? `Raum ${k}` : `Room ${k}`),
    });
    for (const sp of spaces) {
      if (spaceStorey.get(sp.e.id) !== s.e.id || !sp.centre) continue;
      const centre = sp.centre;
      const room = rooms.find((r) => pointInPolygon(centre, r.polygon));
      if (!room) {
        report.push({ code: "spaceUnmatched", entity: `#${sp.e.id} IfcSpace`, detail: sp.name });
        continue;
      }
      if (sp.name) room.name = sp.name;
      const zoneId = zoneOfSpace.get(sp.e.id);
      if (zoneId) room.zoneId = zoneId;
    }
    return {
      id: storeyId,
      name: s.name || `Storey ${i + 1}`,
      height: Math.max(2, height),
      openings: openingsByStorey.get(s.e.id) ?? [],
      interiorWalls,
      rooms,
    };
  });

  // Georeferencing.
  const conversion = byType(ctx, "IFCMAPCONVERSION")[0];
  let origin: Building["origin"];
  if (conversion) {
    const crs = get(ctx, asRef(conversion.args[1]));
    const epsg = /EPSG:(\d+)/.exec(asString(crs?.args[0]) ?? "")?.[1];
    const zone = epsg ? Number(epsg) - 25800 : NaN;
    const e = asNumber(conversion.args[2]);
    const nn = asNumber(conversion.args[3]);
    const xa = asNumber(conversion.args[5]) ?? 1;
    const xo = asNumber(conversion.args[6]) ?? 0;
    if (zone > 0 && zone <= 60 && e !== undefined && nn !== undefined) {
      const ll = fromUtm({ zone, north: true, easting: e, northing: nn });
      const rotation = ((-Math.atan2(xo, xa) * 180) / Math.PI + 360) % 360;
      origin = {
        lat: round6(ll.lat),
        lon: round6(ll.lon),
        rotation: Math.round(rotation * 10) / 10,
      };
    }
  }

  const project = byType(ctx, "IFCPROJECT")[0];
  const buildingEntity = byType(ctx, "IFCBUILDING")[0];
  const building: Building = {
    id: ctx.ids(),
    name: asString(buildingEntity?.args[2]) ?? asString(project?.args[2]) ?? "Imported",
    footprint,
    wallThickness: round3(thickness),
    storeys,
    zones,
    constructions,
    ...DEFAULT_ASSIGNMENT,
    wallConstructionId,
  };
  if (origin) building.origin = origin;
  return {
    ok: true,
    building,
    report,
    stats: {
      storeys: storeys.length,
      walls: walls.length,
      openings: storeys.reduce((s, st) => s + st.openings.length, 0),
      rooms: storeys.reduce((s, st) => s + st.rooms.length, 0),
      zones: zones.length,
    },
  };
}

// ---- geometry helpers ----

/** Outer ring of a set of faces that tile a region: the edges used by exactly one face, chained. */
export function outerBoundary(faces: Vec2[][]): Vec2[] | null {
  const key = (p: Vec2) => `${Math.round(p.x * 1e5)}:${Math.round(p.y * 1e5)}`;
  const count = new Map<string, { a: Vec2; b: Vec2; n: number }>();
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      if (!a || !b) continue;
      const ka = key(a);
      const kb = key(b);
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const cur = count.get(k);
      if (cur) cur.n += 1;
      else count.set(k, { a, b, n: 1 });
    }
  }
  const boundary = [...count.values()].filter((e) => e.n === 1);
  if (boundary.length < 3) return null;
  // Chain edges into rings.
  const rings: Vec2[][] = [];
  const used = new Set<number>();
  for (let i = 0; i < boundary.length; i++) {
    if (used.has(i)) continue;
    const first = boundary[i];
    if (!first) continue;
    const ring: Vec2[] = [first.a, first.b];
    used.add(i);
    let guard = 0;
    while (guard++ < boundary.length) {
      const last = ring[ring.length - 1];
      if (!last) break;
      const next = boundary.findIndex(
        (e, j) => !used.has(j) && (key(e.a) === key(last) || key(e.b) === key(last)),
      );
      if (next === -1) break;
      used.add(next);
      const e = boundary[next];
      if (!e) break;
      ring.push(key(e.a) === key(last) ? e.b : e.a);
      const tail = ring[ring.length - 1];
      const head = ring[0];
      if (tail && head && key(tail) === key(head)) {
        ring.pop();
        break;
      }
    }
    if (ring.length >= 3) rings.push(ring);
  }
  if (rings.length === 0) return null;
  return rings.reduce((best, r) => (area(r) > area(best) ? r : best));
}

interface PlanSolid {
  polygon: Vec2[];
  z0: number;
  depth: number;
}

function firstSolid(ctx: Ctx, product: StepEntity): StepEntity | undefined {
  const shape = get(ctx, asRef(product.args[6]));
  if (!shape) return undefined;
  const representations = asRefs(shape.args[2])
    .map((id) => get(ctx, id))
    .filter((entity): entity is StepEntity => entity !== undefined);
  const body = representations.filter(
    (representation) => asString(representation.args[1])?.toUpperCase() === "BODY",
  );
  const candidates = body.length > 0 ? body : representations;
  for (const rep of candidates) {
    for (const itemId of asRefs(rep.args[3])) {
      const item = get(ctx, itemId);
      if (item?.type === "IFCEXTRUDEDAREASOLID") return item;
    }
  }
  for (const rep of candidates) {
    const item = get(ctx, asRefs(rep.args[3])[0]);
    if (item) return item;
  }
  return undefined;
}

/** Plan polygon (relative to the storey) and z range of an extruded area solid. */
function planOfSolid(ctx: Ctx, solid: StepEntity, owner: StepEntity): PlanSolid | null {
  if (solid.type !== "IFCEXTRUDEDAREASOLID") {
    ctx.report.push({
      code: solid.type === "IFCSWEPTDISKSOLID" ? "curvedWall" : "unknownGeometry",
      entity: `#${owner.id} ${owner.type}`,
      detail: solid.type,
    });
    return null;
  }
  const profile = get(ctx, asRef(solid.args[0]));
  const position = get(ctx, asRef(solid.args[1]));
  const direction = get(ctx, asRef(solid.args[2]));
  const depth = (asNumber(solid.args[3]) ?? 0) * ctx.lengthScale;
  const dirValues = asList(direction?.args[0]).map(asNumber);
  const extrusion = normalise3({
    x: dirValues[0] ?? 0,
    y: dirValues[1] ?? 0,
    z: dirValues[2] ?? 1,
  });
  if (depth <= 0 || length3(extrusion) < 1e-9) {
    ctx.report.push({
      code: "unknownGeometry",
      entity: `#${owner.id} ${owner.type}`,
      detail: "invalid extrusion",
    });
    return null;
  }
  const local = axis2Placement3D(ctx, position);
  let polygon: Vec2[];
  if (profile?.type === "IFCARBITRARYCLOSEDPROFILEDEF") {
    const curve = get(ctx, asRef(profile.args[2]));
    if (curve?.type !== "IFCPOLYLINE") {
      ctx.report.push({
        code: "curvedWall",
        entity: `#${owner.id} ${owner.type}`,
        detail: curve?.type ?? "no curve",
      });
      return null;
    }
    const pts = asRefs(curve.args[0])
      .map((id) => point2(ctx, id))
      .filter((p): p is Vec2 => p !== null);
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (pts.length >= 2 && first && last && Math.hypot(first.x - last.x, first.y - last.y) < 1e-9)
      pts.pop();
    polygon = pts;
  } else if (profile?.type === "IFCRECTANGLEPROFILEDEF") {
    const x = (asNumber(profile.args[3]) ?? 0) * ctx.lengthScale;
    const y = (asNumber(profile.args[4]) ?? 0) * ctx.lengthScale;
    const pos = axis2Placement2D(ctx, get(ctx, asRef(profile.args[2])));
    polygon = [
      { x: -x / 2, y: -y / 2 },
      { x: x / 2, y: -y / 2 },
      { x: x / 2, y: y / 2 },
      { x: -x / 2, y: y / 2 },
    ].map((p) => {
      const transformed = applyPoint(pos, { x: p.x, y: p.y, z: 0 });
      return { x: transformed.x, y: transformed.y };
    });
  } else {
    ctx.report.push({
      code: "unsupportedProfile",
      entity: `#${owner.id} ${owner.type}`,
      detail: profile?.type ?? "no profile",
    });
    return null;
  }
  // Apply the solid position and the owner's placement chain. The full 3D basis
  // matters because many IFC writers cut openings by extruding a vertical profile
  // horizontally through the wall.
  const placement = placementChain(ctx, get(ctx, asRef(owner.args[5])));
  const frame = composeFrames(placement, local);
  const worldExtrusion = normalise3(applyVector(frame, extrusion));
  const starts = polygon.map((p) => applyPoint(frame, { x: p.x, y: p.y, z: 0 }));
  const ends = starts.map((p) => ({
    x: p.x + worldExtrusion.x * depth,
    y: p.y + worldExtrusion.y * depth,
    z: p.z + worldExtrusion.z * depth,
  }));
  const vertices = [...starts, ...ends];
  const z0 = Math.min(...vertices.map((point) => point.z));
  const z1 = Math.max(...vertices.map((point) => point.z));
  if (z1 - z0 < 1e-9) {
    ctx.report.push({
      code: "slopedWall",
      entity: `#${owner.id} ${owner.type}`,
      detail: "solid has no vertical extent",
    });
    return null;
  }
  const vertical = Math.hypot(worldExtrusion.x, worldExtrusion.y) < 1e-7;
  const plan = vertical
    ? starts.map((point) => ({ x: point.x, y: point.y }))
    : convexHull(vertices.map((point) => ({ x: point.x, y: point.y })));
  if (plan.length < 3 || area(plan) < 1e-10) {
    ctx.report.push({
      code: "unknownGeometry",
      entity: `#${owner.id} ${owner.type}`,
      detail: "solid has no plan area",
    });
    return null;
  }
  return { polygon: plan, z0, depth: z1 - z0 };
}

interface Frame {
  x: number;
  y: number;
  z: number;
  xAxis: Vec3;
  yAxis: Vec3;
  zAxis: Vec3;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const IDENTITY_FRAME: Frame = {
  x: 0,
  y: 0,
  z: 0,
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
  zAxis: { x: 0, y: 0, z: 1 },
};

const length3 = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
const dot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const normalise3 = (v: Vec3): Vec3 => {
  const length = length3(v);
  return length > 1e-12
    ? { x: v.x / length, y: v.y / length, z: v.z / length }
    : { x: 0, y: 0, z: 0 };
};

function applyVector(frame: Frame, v: Vec3): Vec3 {
  return {
    x: frame.xAxis.x * v.x + frame.yAxis.x * v.y + frame.zAxis.x * v.z,
    y: frame.xAxis.y * v.x + frame.yAxis.y * v.y + frame.zAxis.y * v.z,
    z: frame.xAxis.z * v.x + frame.yAxis.z * v.y + frame.zAxis.z * v.z,
  };
}

function applyPoint(frame: Frame, p: Vec3): Vec3 {
  const vector = applyVector(frame, p);
  return { x: frame.x + vector.x, y: frame.y + vector.y, z: frame.z + vector.z };
}

function composeFrames(outer: Frame, inner: Frame): Frame {
  const origin = applyPoint(outer, { x: inner.x, y: inner.y, z: inner.z });
  return {
    ...origin,
    xAxis: applyVector(outer, inner.xAxis),
    yAxis: applyVector(outer, inner.yAxis),
    zAxis: applyVector(outer, inner.zAxis),
  };
}

function point2(ctx: Ctx, id: number): Vec2 | null {
  const p = get(ctx, id);
  const c = asList(p?.args[0]).map(asNumber);
  return c.length >= 2
    ? { x: (c[0] ?? 0) * ctx.lengthScale, y: (c[1] ?? 0) * ctx.lengthScale }
    : null;
}

function axis2Placement3D(ctx: Ctx, e: StepEntity | undefined): Frame {
  const loc = asList(get(ctx, asRef(e?.args[0]))?.args[0]).map(asNumber);
  const axisValues = asList(get(ctx, asRef(e?.args[1]))?.args[0]).map(asNumber);
  const refValues = asList(get(ctx, asRef(e?.args[2]))?.args[0]).map(asNumber);
  const zAxis = normalise3({
    x: axisValues[0] ?? 0,
    y: axisValues[1] ?? 0,
    z: axisValues[2] ?? 1,
  });
  const requestedX = normalise3({
    x: refValues[0] ?? 1,
    y: refValues[1] ?? 0,
    z: refValues[2] ?? 0,
  });
  const projection = dot3(requestedX, zAxis);
  let xAxis = normalise3({
    x: requestedX.x - projection * zAxis.x,
    y: requestedX.y - projection * zAxis.y,
    z: requestedX.z - projection * zAxis.z,
  });
  if (length3(xAxis) < 1e-9) {
    const fallback = Math.abs(zAxis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    xAxis = normalise3(cross3(fallback, zAxis));
  }
  const yAxis = normalise3(cross3(zAxis, xAxis));
  return {
    x: (loc[0] ?? 0) * ctx.lengthScale,
    y: (loc[1] ?? 0) * ctx.lengthScale,
    z: (loc[2] ?? 0) * ctx.lengthScale,
    xAxis,
    yAxis,
    zAxis,
  };
}

function axis2Placement2D(ctx: Ctx, e: StepEntity | undefined): Frame {
  const loc = asList(get(ctx, asRef(e?.args[0]))?.args[0]).map(asNumber);
  const ref = asList(get(ctx, asRef(e?.args[1]))?.args[0]).map(asNumber);
  const cos = ref.length >= 2 ? (ref[0] ?? 1) : 1;
  const sin = ref.length >= 2 ? (ref[1] ?? 0) : 0;
  return {
    x: (loc[0] ?? 0) * ctx.lengthScale,
    y: (loc[1] ?? 0) * ctx.lengthScale,
    z: 0,
    xAxis: { x: cos, y: sin, z: 0 },
    yAxis: { x: -sin, y: cos, z: 0 },
    zAxis: { x: 0, y: 0, z: 1 },
  };
}

/** Composes IfcLocalPlacement up to, but excluding, the storey (elements are stored relative to their storey). */
function placementChain(ctx: Ctx, placement: StepEntity | undefined, stopAtStorey = true): Frame {
  const frames: Frame[] = [];
  let current = placement;
  let guard = 0;
  while (current && guard++ < 20) {
    if (stopAtStorey && ctx.storeyPlacements.has(current.id)) break;
    const rel = axis2Placement3D(ctx, get(ctx, asRef(current.args[1])));
    frames.push(rel);
    const parent = get(ctx, asRef(current.args[0]));
    if (!parent) break;
    current = parent;
  }
  // Compose from the outermost inwards.
  let out: Frame = IDENTITY_FRAME;
  for (const f of frames.reverse()) {
    out = composeFrames(out, f);
  }
  return out;
}

/**
 * Interior walls in other tools stop at the inner face of the exterior wall; the
 * editor's footprint is the outer face, so an end within `reach` of the boundary
 * is pushed along the wall's direction onto the footprint edge.
 */
function extendToBoundary(seg: Segment, footprint: Vec2[], reach: number): Segment {
  const es = polygonEdges(footprint);
  const d = sub(seg.b, seg.a);
  const len = Math.hypot(d.x, d.y);
  if (len < 1e-9) return seg;
  const dir = { x: d.x / len, y: d.y / len };
  const push = (p: Vec2, forward: Vec2): Vec2 => {
    let best: { t: number; q: Vec2 } | null = null;
    for (const e of es) {
      const denom = dot(forward, e.normal);
      if (Math.abs(denom) < 1e-9) continue;
      const t = dot(sub(e.a, p), e.normal) / denom;
      if (t < -1e-6 || t > reach) continue;
      const q = { x: p.x + forward.x * t, y: p.y + forward.y * t };
      const along = dot(sub(q, e.a), e.direction);
      if (along < -1e-6 || along > e.length + 1e-6) continue;
      if (!best || t < best.t) best = { t, q };
    }
    return best ? best.q : p;
  };
  return { a: push(seg.a, { x: -dir.x, y: -dir.y }), b: push(seg.b, dir) };
}

function centreLine(plan: Vec2[]): Segment {
  // Longest edge direction: the centre line runs between the midpoints of the two short edges.
  if (plan.length !== 4) {
    const c = centroid(plan);
    return { a: c, b: c };
  }
  const [p0, p1, p2, p3] = plan as [Vec2, Vec2, Vec2, Vec2];
  const l01 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const l12 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const mid = (a: Vec2, b: Vec2) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return l01 >= l12 ? { a: mid(p0, p3), b: mid(p1, p2) } : { a: mid(p0, p1), b: mid(p3, p2) };
}

function projectOpening(
  plan: Vec2[],
  fpEdges: ReturnType<typeof polygonEdges>,
): { wallIndex: number; offset: number; width: number } | null {
  const c = centroid(plan);
  let best: { wallIndex: number; offset: number; width: number; dist: number } | null = null;
  for (const e of fpEdges) {
    const rel = sub(c, e.a);
    const along = dot(rel, e.direction);
    const off = Math.abs(dot(rel, e.normal));
    if (along < -0.5 || along > e.length + 0.5) continue;
    const extent = plan.map((p) => dot(sub(p, e.a), e.direction));
    const width = Math.max(...extent) - Math.min(...extent);
    if (!best || off < best.dist)
      best = { wallIndex: e.index, offset: Math.min(...extent), width, dist: off };
  }
  if (!best || best.dist > 1.0) return null;
  return { wallIndex: best.wallIndex, offset: Math.max(0, best.offset), width: best.width };
}

function projectOpeningOnSegment(
  plan: Vec2[],
  wall: Segment,
  wallIndex: number,
): { wallIndex: number; offset: number; width: number } | null {
  if (wallIndex < 0) return null;
  const vector = sub(wall.b, wall.a);
  const length = Math.hypot(vector.x, vector.y);
  if (length < 1e-9) return null;
  const direction = { x: vector.x / length, y: vector.y / length };
  const normal = { x: direction.y, y: -direction.x };
  const centre = centroid(plan);
  const off = Math.abs(dot(sub(centre, wall.a), normal));
  const extent = plan.map((point) => dot(sub(point, wall.a), direction));
  const start = Math.min(...extent);
  const end = Math.max(...extent);
  if (off > 1 || end < -0.5 || start > length + 0.5) return null;
  return { wallIndex, offset: Math.max(0, start), width: end - start };
}

function convexHull(points: Vec2[]): Vec2[] {
  const unique = new Map<string, Vec2>();
  for (const point of points) unique.set(`${round6(point.x)}:${round6(point.y)}`, point);
  const sorted = [...unique.values()].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length <= 2) return sorted;
  const turn = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower: Vec2[] = [];
  for (const point of sorted) {
    while (lower.length >= 2) {
      const p1 = lower[lower.length - 2];
      const p2 = lower[lower.length - 1];
      if (!p1 || !p2 || turn(p1, p2, point) <= 1e-10) {
        lower.pop();
      } else {
        break;
      }
    }
    lower.push(point);
  }
  const upper: Vec2[] = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2) {
      const p1 = upper[upper.length - 2];
      const p2 = upper[upper.length - 1];
      if (!p1 || !p2 || turn(p1, p2, point) <= 1e-10) {
        upper.pop();
      } else {
        break;
      }
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function medianThickness(walls: { plan: Vec2[] }[], footprint: Vec2[]): number | undefined {
  const es = polygonEdges(footprint);
  const distances: number[] = [];
  for (const w of walls) {
    for (const p of w.plan) {
      const d = Math.min(...es.map((e) => Math.abs(dot(sub(p, e.a), e.normal))));
      if (d > 0.02) distances.push(d);
    }
  }
  return median(distances);
}

function median(xs: number[]): number | undefined {
  if (xs.length === 0) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function psetNumbers(ctx: Ctx, propertyName: string): Map<number, number> {
  return psetValues(ctx, propertyName, asNumber);
}
function psetBooleans(ctx: Ctx, propertyName: string): Map<number, boolean> {
  return psetValues(ctx, propertyName, (v) => {
    const e = v?.kind === "typed" ? asEnum(v.value) : asEnum(v);
    return e === "T" ? true : e === "F" ? false : undefined;
  });
}
function psetValues<T>(
  ctx: Ctx,
  propertyName: string,
  read: (v: StepValue | undefined) => T | undefined,
): Map<number, T> {
  const out = new Map<number, T>();
  for (const rel of byType(ctx, "IFCRELDEFINESBYPROPERTIES")) {
    const pset = get(ctx, asRef(rel.args[5]));
    if (pset?.type !== "IFCPROPERTYSET") continue;
    for (const propId of asRefs(pset.args[4])) {
      const prop = get(ctx, propId);
      if (prop?.type !== "IFCPROPERTYSINGLEVALUE" || asString(prop.args[0]) !== propertyName)
        continue;
      const value = read(prop.args[2]);
      if (value === undefined) continue;
      for (const el of asRefs(rel.args[4])) out.set(el, value);
    }
  }
  return out;
}

function lengthScaleOf(file: StepFile): number {
  const prefixScale: Record<string, number> = {
    EXA: 1e18,
    PETA: 1e15,
    TERA: 1e12,
    GIGA: 1e9,
    MEGA: 1e6,
    KILO: 1e3,
    HECTO: 1e2,
    DECA: 1e1,
    DECI: 1e-1,
    CENTI: 1e-2,
    MILLI: 1e-3,
    MICRO: 1e-6,
    NANO: 1e-9,
    PICO: 1e-12,
    FEMTO: 1e-15,
    ATTO: 1e-18,
  };
  for (const entity of file.entities.values()) {
    if (
      entity.type !== "IFCSIUNIT" ||
      asEnum(entity.args[1]) !== "LENGTHUNIT" ||
      asEnum(entity.args[3]) !== "METRE"
    )
      continue;
    const prefix = asEnum(entity.args[2]);
    return prefix === undefined ? 1 : (prefixScale[prefix] ?? 1);
  }
  return 1;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
