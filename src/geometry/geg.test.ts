import { describe, expect, it } from "vitest";
import { DEFAULT_ASSIGNMENT, PRESET_IDS, defaultConstructions } from "./constructions";
import { GEG_MAX_U, checkConstruction, gegChecks, gegPassCount } from "./geg";
import { rect } from "./fixtures";
import type { Building } from "./types";

const building = (): Building => ({
  id: "b",
  name: "b",
  footprint: rect,
  wallThickness: 0.3,
  storeys: [],
  zones: [],
  constructions: defaultConstructions("en"),
  ...DEFAULT_ASSIGNMENT,
});

describe("GEG check", () => {
  it("the uninsulated stock fails every element, the insulated presets pass", () => {
    const stock = gegChecks(building());
    expect(stock.map((c) => c.category)).toEqual(["wall", "roof", "floor", "window", "door"]);
    expect(gegPassCount(stock)).toBe(0);
    const renovated = gegChecks({
      ...building(),
      wallConstructionId: PRESET_IDS.wallInsulated,
      roofConstructionId: PRESET_IDS.roofInsulated,
      floorConstructionId: PRESET_IDS.floorInsulated,
      windowConstructionId: PRESET_IDS.glazingTriple,
      doorConstructionId: PRESET_IDS.doorInsulated,
    });
    expect(gegPassCount(renovated)).toBe(5);
    expect(renovated[0]?.ratio).toBeLessThan(1);
  });

  it("a value exactly on the limit passes, a missing construction fails", () => {
    const c = {
      id: "x",
      name: "x",
      category: "window" as const,
      uValue: GEG_MAX_U.window,
    };
    expect(checkConstruction(c, "window").ok).toBe(true);
    expect(checkConstruction(undefined, "wall").ok).toBe(false);
  });
});
