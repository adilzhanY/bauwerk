import { describe, expect, it } from "vitest";
import { validateBuilding } from "@/geometry/export";
import { area, centroid } from "@/geometry/polygon";
import { PRESET_IDS } from "@/geometry/constructions";
import { exampleHouse } from "@/lib/examples";
import { buildingFromBox, rectangleOf, resizeRectangle } from "./box";

describe("buildingFromBox", () => {
  it("makes a valid centred box with the era's constructions", () => {
    let nextId = 0;
    const b = buildingFromBox(
      {
        name: "Gartenhaus",
        width: 12,
        depth: 9,
        storeys: 2,
        storeyHeight: 2.8,
        roof: "gable",
        era: "1970s",
        centre: { x: 5, y: 4 },
        origin: { lat: 52.5, lon: 13.4, rotation: 12 },
      },
      "de",
      (prefix) => `${prefix}_${++nextId}`,
    );
    expect(validateBuilding(b)).toBeNull();
    expect(area(b.footprint)).toBeCloseTo(108);
    expect(rectangleOf(b.footprint)).toEqual({ width: 12, depth: 9 });
    expect(b.storeys).toHaveLength(2);
    expect(b.storeys[1]?.height).toBe(2.8);
    expect(b.storeys[0]?.rooms[0]?.zoneId).toBe(b.zones[0]?.id);
    expect(b.wallConstructionId).toBe(PRESET_IDS.wall1970);
    expect(b.roof?.kind).toBe("gable");
    expect(b.storeys[0]?.name).toBe("Erdgeschoss");
    expect(b.origin).toEqual({ lat: 52.5, lon: 13.4, rotation: 12 });
  });

  it("rejects dimensions outside the supported range", () => {
    expect(() =>
      buildingFromBox(
        {
          name: "Too small",
          width: 2,
          depth: 9,
          storeys: 2,
          storeyHeight: 2.8,
          roof: "gable",
          era: "1970s",
          centre: { x: 0, y: 0 },
        },
        "en",
        (prefix) => prefix,
      ),
    ).toThrow("width");
  });
});

describe("rectangleOf and resizeRectangle", () => {
  it("recognises only axis-aligned rectangles", () => {
    expect(rectangleOf(exampleHouse("en").footprint)).toEqual({ width: 10, depth: 8 });
    expect(
      rectangleOf([
        { x: 0, y: 0 },
        { x: 4, y: 1 },
        { x: 4, y: 5 },
        { x: 0, y: 4 },
      ]),
    ).toBeNull();
    expect(
      rectangleOf([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 3 },
      ]),
    ).toBeNull();
  });

  it("recognises and resizes a rotated rectangle without changing its centre or angle", () => {
    const b = exampleHouse("en");
    const angle = Math.PI / 6;
    const centre = { x: 5, y: 4 };
    b.footprint = b.footprint.map((p) => ({
      x: centre.x + (p.x - centre.x) * Math.cos(angle) - (p.y - centre.y) * Math.sin(angle),
      y: centre.y + (p.x - centre.x) * Math.sin(angle) + (p.y - centre.y) * Math.cos(angle),
    }));
    expect(rectangleOf(b.footprint)).toEqual({ width: 10, depth: 8 });
    const resized = resizeRectangle(b, 12, 6);
    expect(rectangleOf(resized.footprint)).toEqual({ width: 12, depth: 6 });
    expect(centroid(resized.footprint).x).toBeCloseTo(centre.x);
    expect(centroid(resized.footprint).y).toBeCloseTo(centre.y);
    const edge = resized.footprint[1];
    const start = resized.footprint[0];
    expect(
      Math.atan2((edge?.y ?? 0) - (start?.y ?? 0), (edge?.x ?? 0) - (start?.x ?? 0)),
    ).toBeCloseTo(angle);
  });

  it("recognises a rectangle with harmless coordinate noise", () => {
    expect(
      rectangleOf([
        { x: 0, y: 0 },
        { x: 10, y: 0.000001 },
        { x: 10.000001, y: 8 },
        { x: 0, y: 7.999999 },
      ]),
    ).toEqual({ width: 10, depth: 8 });
  });

  it("resizes about the centre and keeps openings inside their walls", () => {
    const b = exampleHouse("en");
    const small = resizeRectangle(b, 6, 8);
    expect(rectangleOf(small.footprint)).toEqual({ width: 6, depth: 8 });
    const xs = small.footprint.map((p) => p.x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(5);
    // Wall 0 was 10 m with a window at offset 7.5; on a 6 m wall it must end inside.
    for (const o of small.storeys[0]?.openings.filter((o) => o.wallIndex === 0) ?? []) {
      expect(o.offset + o.width).toBeLessThanOrEqual(6 + 1e-9);
    }
    expect(small.storeys[0]?.openings.length).toBe(b.storeys[0]?.openings.length);
  });
});
