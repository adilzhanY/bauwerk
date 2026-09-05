import { describe, expect, it } from "vitest";
import { DEFAULT_ASSIGNMENT, PRESET_IDS, defaultConstructions } from "./constructions";
import { computeEnergy } from "./energy";
import { rect } from "./fixtures";
import { computeRooms } from "./rooms";
import {
  CONSTRUCTION_COST,
  ENERGY_PRICE_PER_KWH,
  applyScenario,
  evaluateAll,
  evaluateScenario,
  fullEnvelopeScenario,
  investmentOf,
} from "./scenarios";
import type { Building, Opening } from "./types";

let n = 0;
const factory = { createId: () => `room_${++n}`, defaultName: (i: number) => `Room ${i}` };
const win = (id: string, offset: number): Opening => ({
  id,
  wallIndex: 0,
  kind: "window",
  offset,
  width: 1.2,
  height: 1.4,
  sill: 0.9,
  constructionId: PRESET_IDS.glazingDouble,
});

function building(): Building {
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
        openings: [win("w1", 1), win("w2", 5)],
        interiorWalls: [],
        rooms: computeRooms(rect, [], [], factory),
      },
    ],
  };
}

describe("scenarios", () => {
  it("an empty scenario equals the current building", () => {
    const b = building();
    const r = evaluateScenario(b, { id: "none", name: "Nothing", overrides: {} });
    expect(r.energy.heatingDemand).toBeCloseTo(computeEnergy(b).heatingDemand);
    expect(r.investment).toBe(0);
    expect(r.payback).toBe(Infinity);
  });

  it("windows only changes only the window terms and costs the window area", () => {
    const b = building();
    const base = computeEnergy(b);
    const r = evaluateScenario(b, {
      id: "w",
      name: "Windows only",
      overrides: { window: PRESET_IDS.glazingTriple },
    });
    const area = 2 * 1.2 * 1.4;
    expect(r.energy.transmissionLoss - base.transmissionLoss).toBeCloseTo((0.8 - 2.8) * area);
    expect(r.energy.wallNetArea).toBeCloseTo(base.wallNetArea);
    expect(r.energy.bridgeLoss).toBeCloseTo(base.bridgeLoss);
    expect(r.investment).toBe(Math.round(area * CONSTRUCTION_COST.c_glazing_triple!));
    expect(r.savingPerYear).toBeCloseTo(r.demandSaved * ENERGY_PRICE_PER_KWH);
    expect(r.payback).toBeCloseTo(r.investment / r.savingPerYear);
  });

  it("the full envelope variant matches the renovated option of computeEnergy", () => {
    const b = building();
    const full = evaluateScenario(b, fullEnvelopeScenario(b));
    const renovated = computeEnergy(b, { renovated: true });
    expect(full.energy.transmissionLoss).toBeCloseTo(renovated.transmissionLoss);
    expect(full.energy.energyClass).toBe(renovated.energyClass);
    expect(full.investment).toBeGreaterThan(0);
  });

  it("applyScenario does not touch the baseline and can change the roof", () => {
    const b = building();
    const v = applyScenario(b, {
      id: "r",
      name: "Roof",
      overrides: { roof: PRESET_IDS.roofInsulated },
      roof: { kind: "gable", pitch: 35 },
      bridgeDetail: "good",
    });
    expect(b.roofConstructionId).toBe(PRESET_IDS.roofBare);
    expect(v.roofConstructionId).toBe(PRESET_IDS.roofInsulated);
    expect(v.roof?.kind).toBe("gable");
    expect(v.bridgeDetail).toBe("good");
    expect(investmentOf(b, v)).toBeGreaterThan(0);
  });

  it("evaluateAll lists the built-in variant first and the saved ones after", () => {
    const b = {
      ...building(),
      scenarios: [{ id: "s1", name: "Walls", overrides: { wall: PRESET_IDS.wallInsulated } }],
    };
    const all = evaluateAll(b);
    expect(all.map((r) => r.scenario.id)).toEqual(["full-envelope", "s1"]);
    expect(all[1]!.demandSaved).toBeGreaterThan(0);
    expect(all[0]!.demandSaved).toBeGreaterThan(all[1]!.demandSaved);
  });
});
