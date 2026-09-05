import { describe, expect, it } from "vitest";
import {
  metresPerPixel,
  osmTileUrl,
  placeTiles,
  tileForLatLon,
  tileNorthWest,
  tilesAround,
} from "./tiles";
import { distance } from "./polygon";

describe("slippy tiles", () => {
  it("matches known tile numbers", () => {
    expect(tileForLatLon(0, 0, 0)).toEqual({ z: 0, x: 0, y: 0 });
    expect(tileForLatLon(0, 0, 1)).toEqual({ z: 1, x: 1, y: 1 });
    expect(tileForLatLon(0, -1, 1)).toEqual({ z: 1, x: 0, y: 1 });
    // Brandenburger Tor at zoom 16, per the OSM tile grid.
    expect(tileForLatLon(52.516275, 13.377704, 16)).toEqual({ z: 16, x: 35203, y: 21493 });
  });

  it("tile corners round trip and a tile is about 76 m wide in Berlin at zoom 19", () => {
    const t = tileForLatLon(52.516275, 13.377704, 19);
    const nw = tileNorthWest(t);
    const se = tileNorthWest({ z: 19, x: t.x + 1, y: t.y + 1 });
    expect(nw.lat).toBeGreaterThan(52.516275);
    expect(se.lat).toBeLessThan(52.516275);
    expect(nw.lon).toBeLessThan(13.377704);
    expect(se.lon).toBeGreaterThan(13.377704);
    expect(tileForLatLon(nw.lat - 1e-7, nw.lon + 1e-7, 19)).toEqual(t);
    const width = metresPerPixel(52.516275, 19) * 256;
    expect(width).toBeGreaterThan(40);
    expect(width).toBeLessThan(50);
  });

  it("covers a radius with a square of tiles and builds OSM urls", () => {
    const tiles = tilesAround(52.516275, 13.377704, 19, 100);
    // 100 m radius over about 46 m tiles: span 3 each side, 7 by 7.
    expect(tiles).toHaveLength(49);
    expect(osmTileUrl(tiles[0]!)).toMatch(
      /^https:\/\/tile\.openstreetmap\.org\/19\/\d+\/\d+\.png$/,
    );
  });

  it("places tiles in plan coordinates at true scale, rotated with the plan", () => {
    const origin = { lat: 52.516275, lon: 13.377704, rotation: 0 };
    const placed = placeTiles(origin, 19, 30);
    const centre = placed.find((p) => {
      const [nw, , se] = p.corners;
      return nw.x <= 0 && se.x >= 0 && se.y <= 0 && nw.y >= 0;
    });
    expect(centre).toBeDefined();
    const [nw, ne, se] = centre!.corners;
    const width = distance(nw, ne);
    const height = distance(ne, se);
    expect(width).toBeCloseTo(metresPerPixel(52.516275, 19) * 256, 0);
    // Mercator tiles are square on the sphere; on the ellipsoid a metre of latitude
    // and a metre of longitude differ by about 0.3 percent at this latitude.
    expect(Math.abs(width - height) / width).toBeLessThan(0.005);
    // North-west is up and left of south-east in the plan when not rotated.
    expect(nw.y).toBeGreaterThan(se.y);
    expect(nw.x).toBeLessThan(se.x);
    const turned = placeTiles({ ...origin, rotation: 90 }, 19, 30);
    const c2 = turned.find((p) => p.tile.x === centre!.tile.x && p.tile.y === centre!.tile.y)!;
    // Rotated 90 degrees clockwise: the tile's north edge, which ran along +x, now runs along +y.
    // The edge follows geographic north while the plan follows UTM grid north; in Berlin,
    // 1.6 degrees east of the zone meridian, grid convergence is about 1.3 degrees, so the
    // edge tilts by up to width x tan(1.3 deg), about a metre over a 46 m tile.
    const convergence = Math.tan((1.5 * Math.PI) / 180) * width;
    expect(Math.abs(c2.corners[1].x - c2.corners[0].x)).toBeLessThan(convergence);
    expect(c2.corners[1].y - c2.corners[0].y).toBeCloseTo(width, 0);
  });
});
