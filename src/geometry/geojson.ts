import { computeEnergy } from "./energy";
import { fromUtm, latLonToPlan, planToLatLon, toUtm, utmZone } from "./geo";
import type { GeoOrigin, LatLon } from "./geo";
import { area, ensureCounterClockwise, isSimplePolygon, snapPoint } from "./polygon";
import type { Building, Vec2 } from "./types";
import { GRID_SIZE } from "./types";

/**
 * GeoJSON export: one Polygon feature per storey in WGS84 (RFC 7946: lon lat
 * order, right hand rule so exterior rings run counter-clockwise, closed ring),
 * plus a building feature carrying the energy summary.
 */
export interface GeoJsonFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: Record<string, unknown>;
}

export interface GeoJsonCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

function ring(footprint: readonly Vec2[], origin: GeoOrigin): number[][] {
  const ccw = ensureCounterClockwise(footprint);
  // Plan is counter-clockwise with y up; in lon/lat the same order stays counter-clockwise
  // when the rotation is applied as a rigid motion, which it is.
  const coords = ccw.map((p) => {
    const ll = planToLatLon(p, origin);
    return [round(ll.lon), round(ll.lat)];
  });
  const first = coords[0];
  if (first) coords.push([...first]);
  return coords;
}

const round = (v: number) => Math.round(v * 1e8) / 1e8;

export function toGeoJson(building: Building): GeoJsonCollection {
  const origin = building.origin;
  if (!origin) throw new Error("Building has no geo origin");
  const energy = computeEnergy(building, { rotationDegrees: origin.rotation });
  const features: GeoJsonFeature[] = [];
  let elevation = 0;
  for (const storey of building.storeys) {
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring(building.footprint, origin)] },
      properties: {
        kind: "storey",
        id: storey.id,
        name: storey.name,
        elevation,
        height: storey.height,
        rooms: storey.rooms.length,
        openings: storey.openings.length,
      },
    });
    elevation += storey.height;
  }
  features.push({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring(building.footprint, origin)] },
    properties: {
      kind: "building",
      id: building.id,
      name: building.name,
      storeys: building.storeys.length,
      totalHeight: elevation,
      footprintArea: area(building.footprint),
      utmZone: utmZone(origin.lon),
      epsg: 25800 + utmZone(origin.lon),
      rotation: origin.rotation,
      heatingDemand: energy.heatingDemand,
      specificHeatingDemand: energy.specificHeatingDemand,
      energyClass: energy.energyClass,
      transmissionLoss: energy.transmissionLoss,
    },
  });
  return { type: "FeatureCollection", features };
}

export type GeoJsonImportResult =
  | { ok: true; footprint: Vec2[]; origin: GeoOrigin }
  | { ok: false; error: "invalidJson" | "noPolygon" | "footprintInvalid" };

/**
 * Reads the first Polygon (or the first Feature's Polygon) and projects it to a
 * local grid around its centroid. The origin becomes that centroid with no rotation.
 */
export function fromGeoJson(text: string): GeoJsonImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  const polygon = findPolygon(raw);
  if (!polygon) return { ok: false, error: "noPolygon" };
  const ringCoords = polygon[0] ?? [];
  const points: LatLon[] = ringCoords
    .filter(
      (c): c is number[] =>
        Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number",
    )
    .map((c) => ({ lon: c[0] ?? 0, lat: c[1] ?? 0 }));
  if (points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    const closed = first !== undefined && first.lat === last?.lat && first.lon === last.lon;
    if (closed) points.pop();
  }
  if (points.length < 3) return { ok: false, error: "footprintInvalid" };
  const zone = utmZone(points[0]?.lon ?? 0);
  const utm = points.map((p) => toUtm(p, zone));
  const cx = utm.reduce((s, u) => s + u.easting, 0) / utm.length;
  const cy = utm.reduce((s, u) => s + u.northing, 0) / utm.length;
  const centre = fromUtm({ zone, north: utm[0]?.north ?? true, easting: cx, northing: cy });
  const origin: GeoOrigin = { lat: centre.lat, lon: centre.lon, rotation: 0 };
  const footprint = ensureCounterClockwise(
    points.map((p) => snapPoint(latLonToPlan(p, origin), GRID_SIZE)),
  );
  if (!isSimplePolygon(footprint)) return { ok: false, error: "footprintInvalid" };
  return { ok: true, footprint, origin };
}

function findPolygon(raw: unknown): number[][][] | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as {
    type?: unknown;
    coordinates?: unknown;
    geometry?: unknown;
    features?: unknown;
  };
  if (obj.type === "Polygon" && Array.isArray(obj.coordinates))
    return obj.coordinates as number[][][];
  if (obj.type === "Feature") return findPolygon(obj.geometry);
  if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
    for (const f of obj.features) {
      const p = findPolygon(f);
      if (p) return p;
    }
  }
  return null;
}
