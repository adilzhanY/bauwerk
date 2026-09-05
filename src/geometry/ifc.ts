/**
 * IFC4 export as a STEP physical file, written by hand.
 *
 * Spatial structure (IfcRelAggregates, top down):
 *   IfcProject > IfcSite > IfcBuilding > IfcBuildingStorey > IfcSpace
 * Elements are placed in storeys with IfcRelContainedInSpatialStructure:
 *   IfcWall (exterior, PredefinedType SOLIDWALL; interior, PARTITIONING)
 *   IfcSlab (FLOOR under each storey, ROOF over the top one)
 *   IfcWindow, IfcDoor, each filling an IfcOpeningElement that voids its wall
 *   (IfcRelVoidsElement, IfcRelFillsElement)
 * Zones: IfcZone groups its IfcSpaces through IfcRelAssignsToGroup.
 * Geometry: every solid is an IfcExtrudedAreaSolid over an
 * IfcArbitraryClosedProfileDef (IfcPolyline of IfcCartesianPoint 2D),
 * extruded along +Z. Placements are relative: storey placement carries the
 * elevation, element placements inside a storey are identity, so profile
 * coordinates are the plan coordinates in metres.
 * Axes: the editor's plan (x, y) maps to IFC (X, Y) and height maps to Z.
 * Units: metres, square metres, cubic metres, radians.
 * Property sets: Pset_WallCommon, Pset_WindowCommon, Pset_DoorCommon with
 * IsExternal and ThermalTransmittance; Pset_SpaceCommon with NetPlannedArea.
 */
import { findConstruction } from "./constructions";
import { validateOpening } from "./openings";
import { area, sub } from "./polygon";
import { NULL, DERIVED, StepWriter, bool, enm, ifcGuid, list, real, ref, str, typed } from "./step";
import type { Attr } from "./step";
import type { Building, Opening, Room, Storey, Vec2 } from "./types";
import { buildWalls } from "./walls";
import type { Wall } from "./walls";

export interface IfcOptions {
  /** ISO timestamp for the header. Defaults to now. */
  timestamp?: string;
  author?: string;
  fileName?: string;
}

const SLAB_THICKNESS = 0.2;
const INTERIOR_WALL_THICKNESS = 0.1;
const WINDOW_THICKNESS = 0.05;

interface Context {
  w: StepWriter;
  bodyContext: number;
  zUp: number;
  xAxis: number;
  origin3d: number;
}

export function toIfc(building: Building, options: IfcOptions = {}): string {
  const w = new StepWriter();
  const guid = (s: string) => str(ifcGuid(s));

  // Units and representation context.
  const lengthUnit = w.add("IFCSIUNIT", [DERIVED, enm("LENGTHUNIT"), NULL, enm("METRE")]);
  const areaUnit = w.add("IFCSIUNIT", [DERIVED, enm("AREAUNIT"), NULL, enm("SQUARE_METRE")]);
  const volumeUnit = w.add("IFCSIUNIT", [DERIVED, enm("VOLUMEUNIT"), NULL, enm("CUBIC_METRE")]);
  const angleUnit = w.add("IFCSIUNIT", [DERIVED, enm("PLANEANGLEUNIT"), NULL, enm("RADIAN")]);
  const units = w.add("IFCUNITASSIGNMENT", [
    list([lengthUnit, areaUnit, volumeUnit, angleUnit].map(ref)),
  ]);

  const origin3d = w.add("IFCCARTESIANPOINT", [list([real(0), real(0), real(0)])]);
  const zUp = w.add("IFCDIRECTION", [list([real(0), real(0), real(1)])]);
  const xAxis = w.add("IFCDIRECTION", [list([real(1), real(0), real(0)])]);
  const worldPlacement = w.add("IFCAXIS2PLACEMENT3D", [ref(origin3d), ref(zUp), ref(xAxis)]);
  const modelContext = w.add("IFCGEOMETRICREPRESENTATIONCONTEXT", [
    NULL,
    str("Model"),
    "3",
    real(1e-5),
    ref(worldPlacement),
    NULL,
  ]);
  const bodyContext = w.add("IFCGEOMETRICREPRESENTATIONSUBCONTEXT", [
    str("Body"),
    str("Model"),
    DERIVED,
    DERIVED,
    DERIVED,
    DERIVED,
    ref(modelContext),
    NULL,
    enm("MODEL_VIEW"),
    NULL,
  ]);
  const ctx: Context = { w, bodyContext, zUp, xAxis, origin3d };

  // Spatial structure.
  const project = w.add("IFCPROJECT", [
    guid(`${building.id}/project`),
    NULL,
    str(building.name),
    NULL,
    NULL,
    NULL,
    NULL,
    list([ref(modelContext)]),
    ref(units),
  ]);
  const sitePlacement = localPlacement(ctx, null, 0);
  const site = w.add("IFCSITE", [
    guid(`${building.id}/site`),
    NULL,
    str("Site"),
    NULL,
    NULL,
    ref(sitePlacement),
    NULL,
    NULL,
    enm("ELEMENT"),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
  ]);
  const buildingPlacement = localPlacement(ctx, sitePlacement, 0);
  const ifcBuilding = w.add("IFCBUILDING", [
    guid(`${building.id}/building`),
    NULL,
    str(building.name),
    NULL,
    NULL,
    ref(buildingPlacement),
    NULL,
    NULL,
    enm("ELEMENT"),
    NULL,
    NULL,
    NULL,
  ]);
  w.add("IFCRELAGGREGATES", [
    guid(`${building.id}/agg-project`),
    NULL,
    NULL,
    NULL,
    ref(project),
    list([ref(site)]),
  ]);
  w.add("IFCRELAGGREGATES", [
    guid(`${building.id}/agg-site`),
    NULL,
    NULL,
    NULL,
    ref(site),
    list([ref(ifcBuilding)]),
  ]);

  const storeyIds: number[] = [];
  const spacesByZone = new Map<string, number[]>();
  let elevation = 0;

  building.storeys.forEach((storey, index) => {
    const storeyPlacement = localPlacement(ctx, buildingPlacement, elevation);
    const ifcStorey = w.add("IFCBUILDINGSTOREY", [
      guid(storey.id),
      NULL,
      str(storey.name),
      NULL,
      NULL,
      ref(storeyPlacement),
      NULL,
      NULL,
      enm("ELEMENT"),
      real(elevation),
    ]);
    storeyIds.push(ifcStorey);
    const contained: number[] = [];
    const walls = buildWalls(building.footprint, building.wallThickness, storey.height);
    const wallU = findConstruction(building.constructions, building.wallConstructionId)?.uValue;

    // Exterior walls with their openings.
    for (const wall of walls) {
      const placement = localPlacement(ctx, storeyPlacement, 0);
      const solid = extrudedSolid(ctx, wall.quad, 0, storey.height);
      const ifcWall = w.add("IFCWALL", [
        guid(`${storey.id}/wall/${wall.index}`),
        NULL,
        str(`Wall ${wall.index + 1}`),
        NULL,
        NULL,
        ref(placement),
        ref(shape(ctx, solid)),
        NULL,
        enm("SOLIDWALL"),
      ]);
      contained.push(ifcWall);
      propertySet(
        ctx,
        `${storey.id}/wall/${wall.index}/pset`,
        "Pset_WallCommon",
        [ifcWall],
        [
          ["IsExternal", typed("IFCBOOLEAN", bool(true))],
          ...(wallU === undefined
            ? []
            : [
                ["ThermalTransmittance", typed("IFCTHERMALTRANSMITTANCEMEASURE", real(wallU))] as [
                  string,
                  Attr,
                ],
              ]),
        ],
      );

      const onWall = storey.openings.filter((o) => o.wallIndex === wall.index);
      for (const opening of onWall) {
        const valid =
          validateOpening(opening, {
            wallLength: wall.length,
            storeyHeight: storey.height,
            siblings: onWall,
          }).length === 0;
        if (!valid) continue;
        const filled = addOpening(ctx, building, storeyPlacement, wall, opening, ifcWall);
        contained.push(filled);
      }
    }

    // Interior walls.
    storey.interiorWalls.forEach((segment, i) => {
      const plan = thickSegment(segment.a, segment.b, INTERIOR_WALL_THICKNESS);
      const placement = localPlacement(ctx, storeyPlacement, 0);
      const solid = extrudedSolid(ctx, plan, 0, storey.height);
      const ifcWall = w.add("IFCWALL", [
        guid(
          `${storey.id}/interior/${i}/${segment.a.x},${segment.a.y},${segment.b.x},${segment.b.y}`,
        ),
        NULL,
        str(`Interior wall ${i + 1}`),
        NULL,
        NULL,
        ref(placement),
        ref(shape(ctx, solid)),
        NULL,
        enm("PARTITIONING"),
      ]);
      contained.push(ifcWall);
      propertySet(
        ctx,
        `${storey.id}/interior/${i}/pset`,
        "Pset_WallCommon",
        [ifcWall],
        [["IsExternal", typed("IFCBOOLEAN", bool(false))]],
      );
    });

    // Floor slab under the storey, roof slab over the top storey.
    const floorPlacement = localPlacement(ctx, storeyPlacement, 0);
    const floor = w.add("IFCSLAB", [
      guid(`${storey.id}/floor`),
      NULL,
      str(`Floor ${storey.name}`),
      NULL,
      NULL,
      ref(floorPlacement),
      ref(shape(ctx, extrudedSolid(ctx, building.footprint, -SLAB_THICKNESS, 0))),
      NULL,
      enm("FLOOR"),
    ]);
    contained.push(floor);
    if (index === building.storeys.length - 1) {
      const roofPlacement = localPlacement(ctx, storeyPlacement, 0);
      const roof = w.add("IFCSLAB", [
        guid(`${storey.id}/roof`),
        NULL,
        str("Roof"),
        NULL,
        NULL,
        ref(roofPlacement),
        ref(
          shape(
            ctx,
            extrudedSolid(ctx, building.footprint, storey.height, storey.height + SLAB_THICKNESS),
          ),
        ),
        NULL,
        enm("ROOF"),
      ]);
      contained.push(roof);
    }

    // Spaces aggregate to the storey.
    const spaces: number[] = [];
    for (const room of storey.rooms) {
      const space = addSpace(ctx, storey, storeyPlacement, room);
      spaces.push(space);
      if (room.zoneId !== undefined) {
        const listForZone = spacesByZone.get(room.zoneId) ?? [];
        listForZone.push(space);
        spacesByZone.set(room.zoneId, listForZone);
      }
    }
    if (spaces.length > 0) {
      w.add("IFCRELAGGREGATES", [
        guid(`${storey.id}/agg-spaces`),
        NULL,
        NULL,
        NULL,
        ref(ifcStorey),
        list(spaces.map(ref)),
      ]);
    }
    if (contained.length > 0) {
      w.add("IFCRELCONTAINEDINSPATIALSTRUCTURE", [
        guid(`${storey.id}/contains`),
        NULL,
        NULL,
        NULL,
        list(contained.map(ref)),
        ref(ifcStorey),
      ]);
    }
    elevation += storey.height;
  });

  if (storeyIds.length > 0) {
    w.add("IFCRELAGGREGATES", [
      guid(`${building.id}/agg-building`),
      NULL,
      NULL,
      NULL,
      ref(ifcBuilding),
      list(storeyIds.map(ref)),
    ]);
  }

  // Zones.
  for (const zone of building.zones) {
    const spaces = spacesByZone.get(zone.id) ?? [];
    const ifcZone = w.add("IFCZONE", [guid(zone.id), NULL, str(zone.name), NULL, NULL, NULL]);
    if (spaces.length > 0) {
      w.add("IFCRELASSIGNSTOGROUP", [
        guid(`${zone.id}/assign`),
        NULL,
        NULL,
        NULL,
        list(spaces.map(ref)),
        NULL,
        ref(ifcZone),
      ]);
    }
  }

  return w.toString({
    description: "ViewDefinition [ReferenceView_V1.2]",
    fileName: options.fileName ?? `${building.name}.ifc`,
    timestamp: options.timestamp ?? new Date().toISOString().slice(0, 19),
    author: options.author ?? "",
    organization: "",
    preprocessor: "Bauwerk",
    originatingSystem: "Bauwerk",
    authorization: "",
    schema: "IFC4",
  });
}

function localPlacement(ctx: Context, parent: number | null, z: number): number {
  const point =
    z === 0 ? ctx.origin3d : ctx.w.add("IFCCARTESIANPOINT", [list([real(0), real(0), real(z)])]);
  const axis = ctx.w.add("IFCAXIS2PLACEMENT3D", [ref(point), ref(ctx.zUp), ref(ctx.xAxis)]);
  return ctx.w.add("IFCLOCALPLACEMENT", [parent === null ? NULL : ref(parent), ref(axis)]);
}

/** Vertical extrusion of a plan polygon from `bottom` to `top`, relative to its placement. */
function extrudedSolid(ctx: Context, plan: readonly Vec2[], bottom: number, top: number): number {
  const w = ctx.w;
  const points = plan.map((p) => w.add("IFCCARTESIANPOINT", [list([real(p.x), real(p.y)])]));
  const first = points[0];
  const polyline = w.add("IFCPOLYLINE", [
    list([...points, ...(first === undefined ? [] : [first])].map(ref)),
  ]);
  const profile = w.add("IFCARBITRARYCLOSEDPROFILEDEF", [enm("AREA"), NULL, ref(polyline)]);
  const base =
    bottom === 0
      ? ctx.origin3d
      : w.add("IFCCARTESIANPOINT", [list([real(0), real(0), real(bottom)])]);
  const position = w.add("IFCAXIS2PLACEMENT3D", [ref(base), ref(ctx.zUp), ref(ctx.xAxis)]);
  return w.add("IFCEXTRUDEDAREASOLID", [
    ref(profile),
    ref(position),
    ref(ctx.zUp),
    real(top - bottom),
  ]);
}

function shape(ctx: Context, solid: number): number {
  const rep = ctx.w.add("IFCSHAPEREPRESENTATION", [
    ref(ctx.bodyContext),
    str("Body"),
    str("SweptSolid"),
    list([ref(solid)]),
  ]);
  return ctx.w.add("IFCPRODUCTDEFINITIONSHAPE", [NULL, NULL, list([ref(rep)])]);
}

function propertySet(
  ctx: Context,
  key: string,
  name: string,
  elements: number[],
  props: [string, Attr][],
): void {
  if (props.length === 0) return;
  const w = ctx.w;
  const ids = props.map(([n, v]) => w.add("IFCPROPERTYSINGLEVALUE", [str(n), NULL, v, NULL]));
  const pset = w.add("IFCPROPERTYSET", [
    str(ifcGuid(key)),
    NULL,
    str(name),
    NULL,
    list(ids.map(ref)),
  ]);
  w.add("IFCRELDEFINESBYPROPERTIES", [
    str(ifcGuid(`${key}/rel`)),
    NULL,
    NULL,
    NULL,
    list(elements.map(ref)),
    ref(pset),
  ]);
}

/** Rectangle of `thickness` centred on the segment. */
function thickSegment(a: Vec2, b: Vec2, thickness: number): Vec2[] {
  const d = sub(b, a);
  const len = Math.hypot(d.x, d.y) || 1;
  const n = { x: (-d.y / len) * (thickness / 2), y: (d.x / len) * (thickness / 2) };
  return [
    { x: a.x + n.x, y: a.y + n.y },
    { x: b.x + n.x, y: b.y + n.y },
    { x: b.x - n.x, y: b.y - n.y },
    { x: a.x - n.x, y: a.y - n.y },
  ];
}

/** Rectangle in the wall between u0 and u1, from `from` to `to` along the inward normal (0 is the outer face). */
function wallRect(wall: Wall, u0: number, u1: number, from: number, to: number): Vec2[] {
  const at = (u: number, depth: number): Vec2 => ({
    x: wall.outerA.x + wall.direction.x * u - wall.normal.x * depth,
    y: wall.outerA.y + wall.direction.y * u - wall.normal.y * depth,
  });
  return [at(u0, from), at(u1, from), at(u1, to), at(u0, to)];
}

function addOpening(
  ctx: Context,
  building: Building,
  storeyPlacement: number,
  wall: Wall,
  opening: Opening,
  ifcWall: number,
): number {
  const w = ctx.w;
  const t = building.wallThickness;
  const u0 = opening.offset;
  const u1 = opening.offset + opening.width;
  const openingPlan = wallRect(wall, u0, u1, -0.01, t + 0.01);
  const openingPlacement = localPlacement(ctx, storeyPlacement, 0);
  const ifcOpening = w.add("IFCOPENINGELEMENT", [
    str(ifcGuid(`${opening.id}/opening`)),
    NULL,
    str("Opening"),
    NULL,
    NULL,
    ref(openingPlacement),
    ref(shape(ctx, extrudedSolid(ctx, openingPlan, opening.sill, opening.sill + opening.height))),
    NULL,
    enm("OPENING"),
  ]);
  w.add("IFCRELVOIDSELEMENT", [
    str(ifcGuid(`${opening.id}/voids`)),
    NULL,
    NULL,
    NULL,
    ref(ifcWall),
    ref(ifcOpening),
  ]);

  const fillPlan = wallRect(
    wall,
    u0,
    u1,
    t / 2 - WINDOW_THICKNESS / 2,
    t / 2 + WINDOW_THICKNESS / 2,
  );
  const fillPlacement = localPlacement(ctx, storeyPlacement, 0);
  const fillShape = shape(
    ctx,
    extrudedSolid(ctx, fillPlan, opening.sill, opening.sill + opening.height),
  );
  const isDoor = opening.kind === "door";
  const filled = w.add(isDoor ? "IFCDOOR" : "IFCWINDOW", [
    str(ifcGuid(opening.id)),
    NULL,
    str(isDoor ? "Door" : "Window"),
    NULL,
    NULL,
    ref(fillPlacement),
    ref(fillShape),
    NULL,
    real(opening.height),
    real(opening.width),
    enm(isDoor ? "DOOR" : "WINDOW"),
    NULL,
    NULL,
  ]);
  w.add("IFCRELFILLSELEMENT", [
    str(ifcGuid(`${opening.id}/fills`)),
    NULL,
    NULL,
    NULL,
    ref(ifcOpening),
    ref(filled),
  ]);
  const u = findConstruction(building.constructions, opening.constructionId)?.uValue;
  propertySet(
    ctx,
    `${opening.id}/pset`,
    isDoor ? "Pset_DoorCommon" : "Pset_WindowCommon",
    [filled],
    [
      ["IsExternal", typed("IFCBOOLEAN", bool(true))],
      ...(u === undefined
        ? []
        : [
            ["ThermalTransmittance", typed("IFCTHERMALTRANSMITTANCEMEASURE", real(u))] as [
              string,
              Attr,
            ],
          ]),
    ],
  );
  return filled;
}

function addSpace(ctx: Context, storey: Storey, storeyPlacement: number, room: Room): number {
  const w = ctx.w;
  const placement = localPlacement(ctx, storeyPlacement, 0);
  const space = w.add("IFCSPACE", [
    str(ifcGuid(room.id)),
    NULL,
    str(room.name),
    NULL,
    NULL,
    ref(placement),
    ref(shape(ctx, extrudedSolid(ctx, room.polygon, 0, storey.height))),
    str(room.name),
    enm("ELEMENT"),
    enm("INTERNAL"),
    NULL,
  ]);
  propertySet(
    ctx,
    `${room.id}/pset`,
    "Pset_SpaceCommon",
    [space],
    [["NetPlannedArea", typed("IFCAREAMEASURE", real(area(room.polygon)))]],
  );
  return space;
}
