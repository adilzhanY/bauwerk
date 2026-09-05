import { bestInCategory, findConstruction } from "./constructions";
import { validateOpening } from "./openings";
import { area, edges, pointInPolygon, pointOnSegment, sub, distance } from "./polygon";
import type { Edge } from "./polygon";
import type {
  Building,
  Construction,
  ConstructionCategory,
  Opening,
  Room,
  Storey,
  Vec2,
  Zone,
} from "./types";

/**
 * Building physics, simplified on purpose and documented where simplified.
 *
 * Transmission heat loss coefficient   H_T  = Σ U_i · A_i           [W/K]
 * Ventilation heat loss coefficient    H_V  = 0.34 · n · V          [W/K], n = 0.5 1/h, V heated volume
 * Specific transmission loss           H_T' = H_T / A_envelope      [W/(m²K)]
 * Annual heating demand                Q_h  = (H_T + H_V) · G_t     [kWh/a], G_t = 84 kKh for Berlin
 * Specific heating demand              q_h  = Q_h / A_heated        [kWh/(m²a)]
 *
 * Simplifications: no solar or internal gains, no thermal bridges beyond the U-values,
 * ground floor treated like an exterior surface, one temperature difference for all
 * heated surfaces. Interior walls between a heated and an unheated room count with a
 * fixed U of 1.0 W/(m²K). Rooms without a zone count as heated.
 */

export const AIR_HEAT_CAPACITY = 0.34; // Wh/(m³K)
export const AIR_CHANGE_RATE = 0.5; // 1/h
export const HEATING_DEGREE_HOURS_BERLIN = 84; // kKh per year
export const INTERIOR_WALL_U = 1.0; // W/(m²K)
export const INTERIOR_WALL_HEIGHT_FACTOR = 1;

export type Orientation = "N" | "E" | "S" | "W";

export interface ElementLoss {
  category: ConstructionCategory | "interiorWall";
  label: string;
  area: number;
  uValue: number;
  /** U · A in W/K. */
  loss: number;
}

export interface StoreyEnvelope {
  storeyId: string;
  wallGrossArea: number;
  wallNetArea: number;
  windowArea: number;
  doorArea: number;
  floorArea: number;
  roofArea: number;
  /** Window area divided by gross wall area, per orientation. */
  windowToWall: Record<Orientation, { wall: number; window: number; ratio: number }>;
  heatedFloorArea: number;
  heatedVolume: number;
}

export interface EnergySummary {
  storeys: StoreyEnvelope[];
  envelopeArea: number;
  wallNetArea: number;
  windowArea: number;
  doorArea: number;
  windowToWallRatio: number;
  heatedFloorArea: number;
  heatedVolume: number;
  transmissionLoss: number;
  specificTransmissionLoss: number;
  ventilationLoss: number;
  heatingDemand: number;
  specificHeatingDemand: number;
  energyClass: EnergyClass;
  elements: ElementLoss[];
  /** Per zone: heated floor area and transmission loss through its envelope. */
  zones: { zoneId: string | null; floorArea: number; transmissionLoss: number }[];
}

export type EnergyClass = "A+" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

/** Energieausweis bands for the specific demand in kWh/(m²a). */
export function energyClass(specificDemand: number): EnergyClass {
  if (specificDemand <= 30) return "A+";
  if (specificDemand <= 50) return "A";
  if (specificDemand <= 75) return "B";
  if (specificDemand <= 100) return "C";
  if (specificDemand <= 130) return "D";
  if (specificDemand <= 160) return "E";
  if (specificDemand <= 200) return "F";
  if (specificDemand <= 250) return "G";
  return "H";
}

export const ENERGY_CLASS_COLORS: Record<EnergyClass, string> = {
  "A+": "#1a9850",
  A: "#66bd63",
  B: "#a6d96a",
  C: "#d9ef8b",
  D: "#fee08b",
  E: "#fdae61",
  F: "#f46d43",
  G: "#d73027",
  H: "#a50026",
};

/** Compass bucket for an outward normal in plan coordinates, y pointing north. */
export function orientationOf(normal: Vec2, rotationDegrees = 0): Orientation {
  const angle = (Math.atan2(normal.x, normal.y) * 180) / Math.PI + rotationDegrees;
  const a = ((angle % 360) + 360) % 360;
  if (a < 45 || a >= 315) return "N";
  if (a < 135) return "E";
  if (a < 225) return "S";
  return "W";
}

function zoneOf(room: Room, zones: readonly Zone[]): Zone | undefined {
  return room.zoneId === undefined ? undefined : zones.find((z) => z.id === room.zoneId);
}

export function isRoomHeated(room: Room, zones: readonly Zone[]): boolean {
  const zone = zoneOf(room, zones);
  return zone ? zone.heated : true;
}

interface Span {
  from: number;
  to: number;
}

/** Portions of footprint edge `edge` (as u ranges) that border a heated room. */
function heatedSpans(edge: Edge, rooms: readonly Room[], zones: readonly Zone[]): Span[] {
  const spans: Span[] = [];
  for (const room of rooms) {
    if (!isRoomHeated(room, zones)) continue;
    const n = room.polygon.length;
    for (let i = 0; i < n; i++) {
      const a = room.polygon[i];
      const b = room.polygon[(i + 1) % n];
      if (!a || !b) continue;
      if (!pointOnSegment(a, edge.a, edge.b) || !pointOnSegment(b, edge.a, edge.b)) continue;
      const ua = distance(a, edge.a);
      const ub = distance(b, edge.a);
      spans.push({ from: Math.min(ua, ub), to: Math.max(ua, ub) });
    }
  }
  return spans;
}

const spanLength = (spans: readonly Span[]) => spans.reduce((s, x) => s + (x.to - x.from), 0);
const inSpans = (u: number, spans: readonly Span[]) =>
  spans.some((s) => u >= s.from - 1e-6 && u <= s.to + 1e-6);

function uOf(c: Construction | undefined): number {
  return c?.uValue ?? 0;
}

export interface EnergyOptions {
  /** Swap every construction for the best one in its category: the renovated scenario. */
  renovated?: boolean;
  /** Rotation of the plan's +y axis from north, degrees, from geo placement. */
  rotationDegrees?: number;
}

export function computeEnergy(building: Building, options: EnergyOptions = {}): EnergySummary {
  const all = building.constructions;
  const pick = (id: string, category: ConstructionCategory): Construction | undefined => {
    const own = findConstruction(all, id);
    if (!options.renovated) return own;
    return bestInCategory(all, own?.category ?? category) ?? own;
  };
  const wallU = uOf(pick(building.wallConstructionId, "wall"));
  const floorU = uOf(pick(building.floorConstructionId, "floor"));
  const roofU = uOf(pick(building.roofConstructionId, "roof"));

  const footprintEdges = edges(building.footprint);
  const footprintArea = area(building.footprint);
  const storeys: StoreyEnvelope[] = [];
  const elements: ElementLoss[] = [];
  const zoneLoss = new Map<string | null, { floorArea: number; transmissionLoss: number }>();
  const addZone = (zoneId: string | null, floorArea: number, loss: number) => {
    const cur = zoneLoss.get(zoneId) ?? { floorArea: 0, transmissionLoss: 0 };
    cur.floorArea += floorArea;
    cur.transmissionLoss += loss;
    zoneLoss.set(zoneId, cur);
  };

  let transmission = 0;
  let heatedVolume = 0;
  let heatedFloorArea = 0;

  building.storeys.forEach((storey, storeyIndex) => {
    const env = emptyEnvelope(storey.id);
    const heatedRooms = storey.rooms.filter((r) => isRoomHeated(r, building.zones));
    env.heatedFloorArea = heatedRooms.reduce((s, r) => s + r.area, 0);
    env.heatedVolume = env.heatedFloorArea * storey.height;
    heatedFloorArea += env.heatedFloorArea;
    heatedVolume += env.heatedVolume;

    for (const edge of footprintEdges) {
      const spans = heatedSpans(edge, storey.rooms, building.zones);
      const heatedLength = storey.rooms.length === 0 ? edge.length : spanLength(spans);
      const onWall = storey.openings.filter((o) => o.wallIndex === edge.index);
      const valid = onWall.filter(
        (o) =>
          validateOpening(o, {
            wallLength: edge.length,
            storeyHeight: storey.height,
            siblings: onWall,
          }).length === 0,
      );
      const orientation = orientationOf(edge.normal, options.rotationDegrees ?? 0);
      const gross = edge.length * storey.height;
      env.wallGrossArea += gross;
      env.windowToWall[orientation].wall += gross;

      let openingArea = 0;
      for (const o of valid) {
        const a = o.width * o.height;
        openingArea += a;
        if (o.kind === "window") {
          env.windowArea += a;
          env.windowToWall[orientation].window += a;
        } else env.doorArea += a;
        const heated = storey.rooms.length === 0 || inSpans(o.offset + o.width / 2, spans);
        if (!heated) continue;
        const u = uOf(pick(o.constructionId, o.kind));
        transmission += u * a;
        elements.push({
          category: o.kind,
          label: `${storey.name} / ${orientation}`,
          area: a,
          uValue: u,
          loss: u * a,
        });
        addZone(zoneForOpening(o, edge, storey, building.zones), 0, u * a);
      }
      env.wallNetArea += gross - openingArea;

      // Heated share of the net wall area: the heated fraction of the wall length times
      // the storey height, minus the heated openings already subtracted above.
      const heatedGross = heatedLength * storey.height;
      const heatedOpenings = valid
        .filter((o) => storey.rooms.length === 0 || inSpans(o.offset + o.width / 2, spans))
        .reduce((s, o) => s + o.width * o.height, 0);
      const heatedNet = Math.max(0, heatedGross - heatedOpenings);
      if (heatedNet > 0) {
        transmission += wallU * heatedNet;
        elements.push({
          category: "wall",
          label: `${storey.name} / ${orientation}`,
          area: heatedNet,
          uValue: wallU,
          loss: wallU * heatedNet,
        });
        distributeWallLoss(edge, storey, building.zones, wallU * heatedNet, addZone);
      }
    }

    if (storeyIndex === 0) {
      env.floorArea = footprintArea;
      const heated = storey.rooms.length === 0 ? footprintArea : env.heatedFloorArea;
      transmission += floorU * heated;
      if (heated > 0)
        elements.push({
          category: "floor",
          label: storey.name,
          area: heated,
          uValue: floorU,
          loss: floorU * heated,
        });
      for (const r of heatedRooms) addZone(r.zoneId ?? null, r.area, floorU * r.area);
    } else {
      for (const r of heatedRooms) addZone(r.zoneId ?? null, r.area, 0);
    }
    if (storeyIndex === building.storeys.length - 1) {
      env.roofArea = footprintArea;
      const heated = storey.rooms.length === 0 ? footprintArea : env.heatedFloorArea;
      transmission += roofU * heated;
      if (heated > 0)
        elements.push({
          category: "roof",
          label: storey.name,
          area: heated,
          uValue: roofU,
          loss: roofU * heated,
        });
      for (const r of heatedRooms) addZone(r.zoneId ?? null, 0, roofU * r.area);
    }

    // Interior walls between heated and unheated rooms.
    for (const wall of storey.interiorWalls) {
      const between = roomsAround(wall, storey.rooms);
      if (!between) continue;
      const [left, right] = between;
      const lh = isRoomHeated(left, building.zones);
      const rh = isRoomHeated(right, building.zones);
      if (lh === rh) continue;
      const a = distance(wall.a, wall.b) * storey.height;
      transmission += INTERIOR_WALL_U * a;
      elements.push({
        category: "interiorWall",
        label: storey.name,
        area: a,
        uValue: INTERIOR_WALL_U,
        loss: INTERIOR_WALL_U * a,
      });
      const heatedRoom = lh ? left : right;
      addZone(heatedRoom.zoneId ?? null, 0, INTERIOR_WALL_U * a);
    }

    for (const o of ["N", "E", "S", "W"] as const) {
      const b = env.windowToWall[o];
      b.ratio = b.wall > 0 ? b.window / b.wall : 0;
    }
    storeys.push(env);
  });

  const envelopeArea = storeys.reduce(
    (s, e) => s + e.wallNetArea + e.windowArea + e.doorArea + e.floorArea + e.roofArea,
    0,
  );
  const wallGross = storeys.reduce((s, e) => s + e.wallGrossArea, 0);
  const windowArea = storeys.reduce((s, e) => s + e.windowArea, 0);
  const ventilation = AIR_HEAT_CAPACITY * AIR_CHANGE_RATE * heatedVolume;
  const heatingDemand = (transmission + ventilation) * HEATING_DEGREE_HOURS_BERLIN;
  const specific = heatedFloorArea > 0 ? heatingDemand / heatedFloorArea : 0;

  return {
    storeys,
    envelopeArea,
    wallNetArea: storeys.reduce((s, e) => s + e.wallNetArea, 0),
    windowArea,
    doorArea: storeys.reduce((s, e) => s + e.doorArea, 0),
    windowToWallRatio: wallGross > 0 ? windowArea / wallGross : 0,
    heatedFloorArea,
    heatedVolume,
    transmissionLoss: transmission,
    specificTransmissionLoss: envelopeArea > 0 ? transmission / envelopeArea : 0,
    ventilationLoss: ventilation,
    heatingDemand,
    specificHeatingDemand: specific,
    energyClass: energyClass(specific),
    elements,
    zones: [...zoneLoss.entries()].map(([zoneId, v]) => ({ zoneId, ...v })),
  };
}

function emptyEnvelope(storeyId: string): StoreyEnvelope {
  const bucket = () => ({ wall: 0, window: 0, ratio: 0 });
  return {
    storeyId,
    wallGrossArea: 0,
    wallNetArea: 0,
    windowArea: 0,
    doorArea: 0,
    floorArea: 0,
    roofArea: 0,
    windowToWall: { N: bucket(), E: bucket(), S: bucket(), W: bucket() },
    heatedFloorArea: 0,
    heatedVolume: 0,
  };
}

/** The two rooms on either side of an interior wall's midpoint, or null on the boundary. */
function roomsAround(wall: { a: Vec2; b: Vec2 }, rooms: readonly Room[]): [Room, Room] | null {
  const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const d = sub(wall.b, wall.a);
  const len = Math.hypot(d.x, d.y);
  if (len < 1e-9) return null;
  const n = { x: -d.y / len, y: d.x / len };
  const eps = 0.01;
  const left = rooms.find((r) =>
    pointInPolygon({ x: mid.x + n.x * eps, y: mid.y + n.y * eps }, r.polygon),
  );
  const right = rooms.find((r) =>
    pointInPolygon({ x: mid.x - n.x * eps, y: mid.y - n.y * eps }, r.polygon),
  );
  if (!left || !right || left === right) return null;
  return [left, right];
}

/** Zone of the room behind an opening (the room touching the wall at the opening centre). */
function zoneForOpening(
  o: Opening,
  edge: Edge,
  storey: Storey,
  zones: readonly Zone[],
): string | null {
  const u = o.offset + o.width / 2;
  const p = {
    x: edge.a.x + edge.direction.x * u - edge.normal.x * 0.01,
    y: edge.a.y + edge.direction.y * u - edge.normal.y * 0.01,
  };
  const room = storey.rooms.find((r) => pointInPolygon(p, r.polygon));
  if (!room || !isRoomHeated(room, zones)) return null;
  return room.zoneId ?? null;
}

function distributeWallLoss(
  edge: Edge,
  storey: Storey,
  zones: readonly Zone[],
  loss: number,
  addZone: (zoneId: string | null, floorArea: number, loss: number) => void,
) {
  if (storey.rooms.length === 0) {
    addZone(null, 0, loss);
    return;
  }
  const perRoom: { zoneId: string | null; length: number }[] = [];
  let total = 0;
  for (const room of storey.rooms) {
    if (!isRoomHeated(room, zones)) continue;
    const spans = heatedSpans(edge, [room], zones);
    const l = spanLength(spans);
    if (l <= 0) continue;
    perRoom.push({ zoneId: room.zoneId ?? null, length: l });
    total += l;
  }
  if (total <= 0) {
    addZone(null, 0, loss);
    return;
  }
  for (const r of perRoom) addZone(r.zoneId, 0, (loss * r.length) / total);
}
