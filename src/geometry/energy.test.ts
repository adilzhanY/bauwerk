import { describe, expect, it } from "vitest";
import { DEFAULT_ASSIGNMENT, PRESET_IDS, defaultConstructions } from "./constructions";
import { computeEnergy, energyClass, orientationOf } from "./energy";
import { lShape, rect } from "./fixtures";
import { edges } from "./polygon";
import { computeRooms } from "./rooms";
import type { Building, Opening, Segment } from "./types";

let n = 0;
const factory = { createId: () => `room_${++n}`, defaultName: (i: number) => `Room ${i}` };

function building(
  interiorWalls: Segment[] = [],
  openings: Opening[] = [],
  zones: Building["zones"] = [],
  roomZones: Record<number, string> = {},
): Building {
  const rooms = computeRooms(rect, interiorWalls, [], factory).map((r, i) =>
    roomZones[i] === undefined ? r : { ...r, zoneId: roomZones[i] },
  );
  return {
    id: "b",
    name: "Test",
    footprint: rect,
    wallThickness: 0.3,
    zones,
    constructions: defaultConstructions("en"),
    ...DEFAULT_ASSIGNMENT,
    storeys: [{ id: "s0", name: "Ground floor", height: 3, openings, interiorWalls, rooms }],
  };
}

const window = (patch: Partial<Opening> = {}): Opening => ({
  id: "w",
  wallIndex: 0,
  kind: "window",
  offset: 2,
  width: 1.2,
  height: 1.4,
  sill: 0.9,
  constructionId: PRESET_IDS.glazingDouble,
  ...patch,
});

describe("computeEnergy on the default 10 by 8 single storey", () => {
  // Envelope: walls 36 m x 3 m = 108 m², floor 80 m², roof 80 m².
  // Uninsulated: H_T = 1.4 x 108 + 1.0 x 80 + 1.3 x 80 = 151.2 + 80 + 104 = 335.2 W/K.
  it("hand-computed transmission loss, ventilation loss and heating demand", () => {
    const e = computeEnergy(building());
    expect(e.envelopeArea).toBeCloseTo(268);
    expect(e.wallNetArea).toBeCloseTo(108);
    expect(e.transmissionLoss).toBeCloseTo(335.2);
    expect(e.specificTransmissionLoss).toBeCloseTo(335.2 / 268);
    expect(e.heatedVolume).toBeCloseTo(240);
    expect(e.ventilationLoss).toBeCloseTo(0.34 * 0.5 * 240);
    expect(e.heatingDemand).toBeCloseTo((335.2 + 40.8) * 84);
    expect(e.specificHeatingDemand).toBeCloseTo(((335.2 + 40.8) * 84) / 80);
    expect(e.energyClass).toBe("H");
  });

  // Insulated: 0.25 x 108 + 0.35 x 80 + 0.2 x 80 = 27 + 28 + 16 = 71 W/K.
  it("the renovated scenario swaps every construction for the best in its category", () => {
    const e = computeEnergy(building(), { renovated: true });
    expect(e.transmissionLoss).toBeCloseTo(71);
    expect(e.energyClass).not.toBe("H");
  });

  it("a window replaces wall area and swapping its glazing changes H_T by U difference times area", () => {
    const withDouble = computeEnergy(building([], [window()]));
    const area = 1.2 * 1.4;
    expect(withDouble.windowArea).toBeCloseTo(area);
    expect(withDouble.wallNetArea).toBeCloseTo(108 - area);
    expect(withDouble.transmissionLoss).toBeCloseTo(1.4 * (108 - area) + 2.8 * area + 184);
    const withTriple = computeEnergy(
      building([], [window({ constructionId: PRESET_IDS.glazingTriple })]),
    );
    expect(withDouble.transmissionLoss - withTriple.transmissionLoss).toBeCloseTo(
      (2.8 - 0.8) * area,
    );
  });

  it("an invalid opening is ignored", () => {
    const e = computeEnergy(building([], [window({ offset: 9.5 })]));
    expect(e.windowArea).toBe(0);
    expect(e.transmissionLoss).toBeCloseTo(335.2);
  });

  it("window-to-wall ratio per orientation, y is north", () => {
    // Wall 0 (bottom edge) faces south. Two windows there: 2 x 1.68 over 30 m² gross.
    const e = computeEnergy(
      building([], [window({ id: "a", offset: 1 }), window({ id: "b", offset: 5 })]),
    );
    const s0 = e.storeys[0]!;
    expect(s0.windowToWall.S.wall).toBeCloseTo(30);
    expect(s0.windowToWall.S.ratio).toBeCloseTo((2 * 1.68) / 30);
    expect(s0.windowToWall.N.ratio).toBe(0);
    expect(e.windowToWallRatio).toBeCloseTo((2 * 1.68) / 108);
  });

  it("unheated rooms contribute nothing and the dividing wall counts once", () => {
    const zones: Building["zones"] = [
      { id: "cold", name: "Unheated", color: "#000", heated: false, temperature: 10 },
    ];
    const split: Segment[] = [{ a: { x: 4, y: 0 }, b: { x: 4, y: 8 } }];
    // Rooms come out in face order; find the left one (x < 4) by area 32.
    n = 0;
    const rooms = computeRooms(rect, split, [], factory);
    const leftIndex = rooms.findIndex((r) => r.area === 32);
    const e = computeEnergy(building(split, [], zones, { [leftIndex]: "cold" }));
    // Heated part is 6 x 8: walls 6 + 8 + 6 = 20 m x 3 m = 60 m² x 1.4 = 84,
    // floor 48 x 1.0 = 48, roof 48 x 1.3 = 62.4, interior wall 8 x 3 x 1.0 = 24.
    expect(e.heatedFloorArea).toBeCloseTo(48);
    expect(e.transmissionLoss).toBeCloseTo(84 + 48 + 62.4 + 24);
    expect(e.elements.some((x) => x.category === "interiorWall")).toBe(true);

    const allCold = computeEnergy(building(split, [], zones, { 0: "cold", 1: "cold" }));
    expect(allCold.transmissionLoss).toBe(0);
    expect(allCold.heatingDemand).toBe(0);
  });

  it("a window in an unheated room does not count, a window in a heated room does", () => {
    const zones: Building["zones"] = [
      { id: "cold", name: "Unheated", color: "#000", heated: false, temperature: 10 },
    ];
    const split: Segment[] = [{ a: { x: 4, y: 0 }, b: { x: 4, y: 8 } }];
    n = 0;
    const rooms = computeRooms(rect, split, [], factory);
    const leftIndex = rooms.findIndex((r) => r.area === 32);
    const coldWindow = window({ offset: 1 }); // x from 1 to 2.2, left room
    const warmWindow = window({ offset: 6 }); // x from 6 to 7.2, right room
    const a = computeEnergy(building(split, [coldWindow], zones, { [leftIndex]: "cold" }));
    const b = computeEnergy(building(split, [warmWindow], zones, { [leftIndex]: "cold" }));
    const base = 84 + 48 + 62.4 + 24;
    expect(a.transmissionLoss).toBeCloseTo(base);
    expect(b.transmissionLoss).toBeCloseTo(base - 1.4 * 1.68 + 2.8 * 1.68);
  });

  it("per zone breakdown sums to the total", () => {
    const zones: Building["zones"] = [
      { id: "z1", name: "A", color: "#000", heated: true, temperature: 20 },
      { id: "z2", name: "B", color: "#000", heated: true, temperature: 20 },
    ];
    const split: Segment[] = [{ a: { x: 4, y: 0 }, b: { x: 4, y: 8 } }];
    const e = computeEnergy(building(split, [window({ offset: 1 })], zones, { 0: "z1", 1: "z2" }));
    const sum = e.zones.reduce((s, z) => s + z.transmissionLoss, 0);
    expect(sum).toBeCloseTo(e.transmissionLoss);
    expect(e.zones.reduce((s, z) => s + z.floorArea, 0)).toBeCloseTo(80);
  });
});

describe("orientation and energy class", () => {
  it("buckets the rectangle and L shape edges", () => {
    const r = edges(rect).map((e) => orientationOf(e.normal));
    expect(r).toEqual(["S", "E", "N", "W"]);
    const l = edges(lShape).map((e) => orientationOf(e.normal));
    expect(l).toEqual(["S", "E", "N", "E", "N", "W"]);
    expect(orientationOf({ x: 0, y: 1 }, 90)).toBe("E");
  });

  it("energy class boundaries", () => {
    expect(energyClass(30)).toBe("A+");
    expect(energyClass(30.01)).toBe("A");
    expect(energyClass(75)).toBe("B");
    expect(energyClass(100)).toBe("C");
    expect(energyClass(130)).toBe("D");
    expect(energyClass(160)).toBe("E");
    expect(energyClass(200)).toBe("F");
    expect(energyClass(250)).toBe("G");
    expect(energyClass(251)).toBe("H");
  });
});
