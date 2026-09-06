import { describe, expect, it } from "vitest";
import { DEFAULT_ASSIGNMENT, PRESET_IDS, defaultConstructions } from "./constructions";
import { computeEnergy, energyClass, orientationOf } from "./energy";
import { lShape, rect } from "./fixtures";
import { edges } from "./polygon";
import { computeRooms } from "./rooms";
import type { Building, Opening, Segment } from "./types";

const presets = defaultConstructions("en");
const U = (id: string) => presets.find((c) => c.id === id)!.uValue;
const WALL = U(PRESET_IDS.wallBrick);
const FLOOR = U(PRESET_IDS.floorBare);
const ROOF = U(PRESET_IDS.roofBare);
/** Uninsulated default: walls 36 m x 3 m = 108 m², floor 80 m² with F_x 0.6, roof 80 m². */
const BASE = WALL * 108 + 0.6 * FLOOR * 80 + ROOF * 80;
/** Usable internal gains for 80 m² of heated floor area. */
const INTERNAL = 0.95 * 22 * 80;

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
  // Envelope: walls 36 m x 3 m = 108 m², floor 80 m², roof 80 m², U from the preset layer stacks.
  it("hand-computed transmission loss, ventilation loss and heating demand", () => {
    const e = computeEnergy(building());
    expect(e.envelopeArea).toBeCloseTo(268);
    expect(e.wallNetArea).toBeCloseTo(108);
    expect(e.transmissionLoss - e.bridgeLoss).toBeCloseTo(BASE);
    expect(e.specificTransmissionLoss).toBeCloseTo(e.transmissionLoss / 268);
    expect(e.heatedVolume).toBeCloseTo(240);
    expect(e.ventilationLoss).toBeCloseTo(0.34 * 0.5 * 240);
    expect(e.internalGains).toBeCloseTo(INTERNAL);
    expect(e.heatingDemand).toBeCloseTo((BASE + e.bridgeLoss + 40.8) * 66 - INTERNAL);
    expect(e.specificHeatingDemand).toBeCloseTo(
      ((BASE + e.bridgeLoss + 40.8) * 66 - INTERNAL) / 80,
    );
    expect(e.energyClass).toBe("H");
  });

  it("the renovated scenario swaps every construction for the best in its category", () => {
    const e = computeEnergy(building(), { renovated: true });
    const best =
      U(PRESET_IDS.wallInsulated) * 108 +
      0.6 * U(PRESET_IDS.floorInsulated) * 80 +
      U(PRESET_IDS.roofInsulated) * 80;
    expect(e.transmissionLoss - e.bridgeLoss).toBeCloseTo(best);
    expect(e.transmissionLoss).toBeLessThan(BASE / 3);
    expect(e.energyClass).not.toBe("H");
  });

  it("a window replaces wall area and swapping its glazing changes H_T by U difference times area", () => {
    const withDouble = computeEnergy(building([], [window()]));
    const area = 1.2 * 1.4;
    expect(withDouble.windowArea).toBeCloseTo(area);
    expect(withDouble.wallNetArea).toBeCloseTo(108 - area);
    expect(withDouble.transmissionLoss - withDouble.bridgeLoss).toBeCloseTo(
      WALL * (108 - area) + 2.8 * area + 0.6 * FLOOR * 80 + ROOF * 80,
    );
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
    expect(e.transmissionLoss - e.bridgeLoss).toBeCloseTo(BASE);
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
    // Heated part is 6 x 8: walls 6 + 8 + 6 = 20 m x 3 m = 60 m², floor 48 m² with F_x 0.6,
    // roof 48 m², interior wall 8 x 3 x 1.0 with F_x 0.5 = 12.
    const heatedBase = WALL * 60 + 0.6 * FLOOR * 48 + ROOF * 48 + 12;
    expect(e.heatedFloorArea).toBeCloseTo(48);
    expect(e.transmissionLoss - e.bridgeLoss).toBeCloseTo(heatedBase);
    expect(e.elements.some((x) => x.category === "interiorWall")).toBe(true);

    const allCold = computeEnergy(building(split, [], zones, { 0: "cold", 1: "cold" }));
    expect(allCold.transmissionLoss - allCold.bridgeLoss).toBe(0);
    expect(allCold.heatedVolume).toBe(0);
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
    const base = WALL * 60 + 0.6 * FLOOR * 48 + ROOF * 48 + 12;
    expect(a.transmissionLoss - a.bridgeLoss).toBeCloseTo(base);
    expect(b.transmissionLoss - b.bridgeLoss).toBeCloseTo(base - WALL * 1.68 + 2.8 * 1.68);
  });

  it("per zone breakdown sums to the total", () => {
    const zones: Building["zones"] = [
      { id: "z1", name: "A", color: "#000", heated: true, temperature: 20 },
      { id: "z2", name: "B", color: "#000", heated: true, temperature: 20 },
    ];
    const split: Segment[] = [{ a: { x: 4, y: 0 }, b: { x: 4, y: 8 } }];
    const e = computeEnergy(building(split, [window({ offset: 1 })], zones, { 0: "z1", 1: "z2" }));
    const sum = e.zones.reduce((s, z) => s + z.transmissionLoss, 0);
    expect(sum).toBeCloseTo(e.transmissionLoss - e.bridgeLoss);
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

describe("thermal bridges in the energy balance", () => {
  it("adds Σ ψ·l with the poor set by default and the good set when renovated", () => {
    const e = computeEnergy(building());
    // 4 corners x 3 m x 0.15 + 36 m slab x 0.5 + 36 m roof x 0.3
    expect(e.bridgeLoss).toBeCloseTo(1.8 + 18 + 10.8);
    expect(e.transmissionLoss).toBeCloseTo(BASE + e.bridgeLoss);
    const r = computeEnergy(building(), { renovated: true });
    expect(r.bridgeLoss).toBeCloseTo(12 * 0.05 + 36 * 0.1 + 36 * 0.1);
    const good = computeEnergy({ ...building(), bridgeDetail: "good" });
    expect(good.bridgeLoss).toBeCloseTo(r.bridgeLoss);
  });
});

describe("roof shape in the energy balance", () => {
  it("a gable roof enlarges the roof area by 1 / cos(pitch) and a heated attic adds volume", () => {
    const flat = computeEnergy(building());
    const gable = computeEnergy({
      ...building(),
      roof: { kind: "gable", pitch: 45, overhang: 0, ridgeAxis: "x" },
    });
    expect(gable.storeys[0]!.roofArea).toBeCloseTo(80 / Math.cos(Math.PI / 4));
    expect(
      gable.transmissionLoss - gable.bridgeLoss - (flat.transmissionLoss - flat.bridgeLoss),
    ).toBeCloseTo(ROOF * (80 / Math.cos(Math.PI / 4) - 80));
    expect(gable.heatedVolume).toBeCloseTo(flat.heatedVolume);
    const attic = computeEnergy({
      ...building(),
      roof: { kind: "gable", pitch: 45, overhang: 0, ridgeAxis: "x", heatedAttic: true },
    });
    expect(attic.heatedVolume).toBeCloseTo(240 + 0.5 * 8 * 4 * 10);
  });
});

describe("solar gains", () => {
  it("a south window reduces the heating demand by its usable gains, never below zero", () => {
    const none = computeEnergy(building());
    expect(none.solarGains).toBe(0);
    const south = computeEnergy(building([], [window()])); // wall 0 faces south
    expect(south.solarGains).toBeCloseTo(1.68 * 0.6 * 0.7 * 0.9 * 270 * 0.95);
    expect(south.heatingDemand).toBeCloseTo(
      (south.transmissionLoss + south.ventilationLoss) * 66 - south.solarGains - INTERNAL,
    );
    const north = computeEnergy(building([], [window({ wallIndex: 2, offset: 2 })]));
    expect(north.solarGains).toBeLessThan(south.solarGains);
  });
});
