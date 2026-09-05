import { northInPlan } from "@/geometry/geo";

/** Converts azimuth and elevation to a world position around the footprint centre. */
export function sunWorldPosition(
  azimuth: number,
  elevation: number,
  centre: { x: number; y: number },
  radius: number,
  rotation: number,
): [number, number, number] {
  const north = northInPlan({ lat: 0, lon: 0, rotation });
  const east = { x: north.y, y: -north.x };
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  const dx = north.x * Math.cos(az) + east.x * Math.sin(az);
  const dy = north.y * Math.cos(az) + east.y * Math.sin(az);
  return [
    centre.x + dx * radius * Math.cos(el),
    radius * Math.sin(el),
    centre.y + dy * radius * Math.cos(el),
  ];
}
