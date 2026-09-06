import { describe, expect, it } from "vitest";
import { DEFAULT_ASSIGNMENT, PRESET_IDS, defaultConstructions } from "./constructions";
import { computeEnergy } from "./energy";
import { rect } from "./fixtures";
import {
  roomEnvelopeLoss,
  roomHeatLoads,
  suggestHeatPumpPower,
  suggestRadiatorPower,
  validateRadiator,
} from "./hvac";
import { computeRooms } from "./rooms";
import type { Building, Radiator, Segment } from "./types";

let n = 0;
const factory = { createId: () => `room_${++n}`, defaultName: (i: number) => `Room ${i}` };

function building(walls: Segment[] = [], radiators: Radiator[] = []): Building {
  return {
    id: "b",
    name: "b",
    footprint: rect,
    wallThickness: 0.3,
    zones: [],
    constructions: defaultConstructions("en"),
    ...DEFAULT_ASSIGNMENT,
    storeys: [
      {
        id: "s0",
        name: "G",
        height: 3,
        openings: [],
        interiorWalls: walls,
        rooms: computeRooms(rect, walls, [], factory),
        radiators,
      },
    ],
  };
}

describe("roomEnvelopeLoss and roomHeatLoads", () => {
  it("a single room owns the whole envelope; its load matches the building at 34 K", () => {
    const b = building();
    const e = computeEnergy(b);
    const room = b.storeys[0]!.rooms[0]!;
    expect(roomEnvelopeLoss(b, b.storeys[0]!, room)).toBeCloseTo(
      e.transmissionLoss - e.bridgeLoss,
      6,
    );
    const loads = roomHeatLoads(b);
    expect(loads).toHaveLength(1);
    expect(loads[0]!.load).toBeCloseTo((e.transmissionLoss + e.ventilationLoss) * 34, 3);
    expect(loads[0]!.coverage).toBe(0);
  });

  it("two rooms split the envelope by their exterior walls and the loads sum to the total", () => {
    const b = building([{ a: { x: 4, y: 0 }, b: { x: 4, y: 8 } }]);
    const e = computeEnergy(b);
    const loads = roomHeatLoads(b);
    expect(loads).toHaveLength(2);
    const total = loads.reduce((s, r) => s + r.load, 0);
    expect(total).toBeCloseTo((e.transmissionLoss + e.ventilationLoss) * 34, 3);
    const small = loads.find((r) => r.name.endsWith("1") || r.load < total / 2)!;
    expect(small.load).toBeLessThan(total / 2);
  });

  it("radiators count for the room behind their wall segment", () => {
    const rad: Radiator = { id: "r1", wallIndex: 0, offset: 1, width: 1, height: 0.6, power: 1500 };
    const b = building([{ a: { x: 4, y: 0 }, b: { x: 4, y: 8 } }], [rad]);
    const loads = roomHeatLoads(b);
    const left = loads.find((r) => r.installed === 1500)!;
    expect(left).toBeDefined();
    expect(left.coverage).toBeCloseTo(1500 / left.load);
  });

  it("suggests radiator and heat pump sizes", () => {
    expect(suggestRadiatorPower(1234)).toBe(1300);
    expect(suggestRadiatorPower(50)).toBe(300);
    const kw = suggestHeatPumpPower(building());
    const total = roomHeatLoads(building()).reduce((s, r) => s + r.load, 0);
    expect(kw).toBeGreaterThanOrEqual((total * 1.1) / 1000);
    expect(kw * 2).toBe(Math.round(kw * 2));
  });
});

describe("validateRadiator", () => {
  const storey = () => building().storeys[0]!;
  const rad = (patch: Partial<Radiator> = {}): Radiator => ({
    id: "r",
    wallIndex: 0,
    offset: 1,
    width: 1,
    height: 0.6,
    power: 800,
    ...patch,
  });

  it("stays on the wall", () => {
    expect(validateRadiator(rad(), storey(), 10)).toBe(true);
    expect(validateRadiator(rad({ offset: 9.5 }), storey(), 10)).toBe(false);
    expect(validateRadiator(rad({ offset: -0.1 }), storey(), 10)).toBe(false);
  });

  it("may sit under a window but not across a door", () => {
    const s = storey();
    s.openings = [
      {
        id: "w",
        wallIndex: 0,
        kind: "window",
        offset: 1,
        width: 1.2,
        height: 1.4,
        sill: 0.9,
        constructionId: PRESET_IDS.glazingDouble,
      },
      {
        id: "d",
        wallIndex: 0,
        kind: "door",
        offset: 5,
        width: 1,
        height: 2.1,
        sill: 0,
        constructionId: PRESET_IDS.doorOld,
      },
    ];
    expect(validateRadiator(rad({ offset: 1.1, width: 1 }), s, 10)).toBe(true);
    expect(validateRadiator(rad({ offset: 4.8, width: 1 }), s, 10)).toBe(false);
  });

  it("does not overlap another radiator", () => {
    const s = storey();
    s.radiators = [rad({ id: "other", offset: 1.5 })];
    expect(validateRadiator(rad({ offset: 1 }), s, 10)).toBe(false);
    expect(validateRadiator(rad({ offset: 3 }), s, 10)).toBe(true);
  });
});
