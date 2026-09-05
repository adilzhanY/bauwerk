import { latLonToPlan } from "./geo";
import type { GeoOrigin } from "./geo";
import type { Vec2 } from "./types";

/**
 * Web Mercator slippy map tiles as used by OpenStreetMap: at zoom z the world is
 * 2^z by 2^z tiles of 256 px, x grows east from longitude -180, y grows south
 * from latitude 85.05. Map tiles are Mercator while the plan is UTM; over the
 * few hundred metres a building site covers the difference is below a
 * centimetre, so tile corners are simply projected through the plan origin.
 */

export const TILE_SIZE = 256;
export const OSM_MAX_ZOOM = 19;
const EARTH_CIRCUMFERENCE = 40075016.686;

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function tileForLatLon(lat: number, lon: number, z: number): TileCoord {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latR = rad(lat);
  const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
  return { z, x: clamp(x, 0, n - 1), y: clamp(y, 0, n - 1) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** North-west corner of a tile. The south-east corner is the north-west of (x + 1, y + 1). */
export function tileNorthWest(t: TileCoord): { lat: number; lon: number } {
  const n = 2 ** t.z;
  const lon = (t.x / n) * 360 - 180;
  const latR = Math.atan(Math.sinh(Math.PI * (1 - (2 * t.y) / n)));
  return { lat: deg(latR), lon };
}

/** Ground metres per tile pixel at a latitude. */
export function metresPerPixel(lat: number, z: number): number {
  return (EARTH_CIRCUMFERENCE * Math.cos(rad(lat))) / (TILE_SIZE * 2 ** z);
}

/** Tiles whose extent overlaps a square of `radius` metres around the point. */
export function tilesAround(lat: number, lon: number, z: number, radius: number): TileCoord[] {
  const centre = tileForLatLon(lat, lon, z);
  const tileMetres = metresPerPixel(lat, z) * TILE_SIZE;
  const span = Math.ceil(radius / tileMetres);
  const n = 2 ** z;
  const tiles: TileCoord[] = [];
  for (let dy = -span; dy <= span; dy++) {
    for (let dx = -span; dx <= span; dx++) {
      const x = centre.x + dx;
      const y = centre.y + dy;
      if (y < 0 || y >= n) continue;
      tiles.push({ z, x: ((x % n) + n) % n, y });
    }
  }
  return tiles;
}

export const osmTileUrl = (t: TileCoord): string =>
  `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;

export interface PlacedTile {
  tile: TileCoord;
  url: string;
  /** Plan coordinates of the tile corners: north-west, north-east, south-east, south-west. */
  corners: [Vec2, Vec2, Vec2, Vec2];
}

/** Tiles around the origin with their corners in plan coordinates. */
export function placeTiles(origin: GeoOrigin, z: number, radius: number): PlacedTile[] {
  return tilesAround(origin.lat, origin.lon, z, radius).map((tile) => {
    const nw = tileNorthWest(tile);
    const se = tileNorthWest({ z: tile.z, x: tile.x + 1, y: tile.y + 1 });
    const corner = (lat: number, lon: number) => latLonToPlan({ lat, lon }, origin);
    return {
      tile,
      url: osmTileUrl(tile),
      corners: [
        corner(nw.lat, nw.lon),
        corner(nw.lat, se.lon),
        corner(se.lat, se.lon),
        corner(se.lat, nw.lon),
      ],
    };
  });
}
