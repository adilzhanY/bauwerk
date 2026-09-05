import { describe, expect, it } from "vitest";
import { DEFAULT_ASSIGNMENT, PRESET_IDS, defaultConstructions, layersFor } from "./constructions";
import {
  effectiveWallThickness,
  layersResistance,
  materialClass,
  totalThickness,
  uValueFromLayers,
  withComputedU,
} from "./layers";
import { rect } from "./fixtures";
import type { Building, Layer } from "./types";

const layer = (thickness: number, conductivity: number, name = "x"): Layer => ({
  id: name,
  name,
  thickness,
  conductivity,
});

describe("uValueFromLayers", () => {
  it("one metre at conductivity one on a ground floor gives 1 / (1 + 0.17)", () => {
    expect(uValueFromLayers([layer(1, 1)], "floor")).toBeCloseTo(1 / 1.17, 3);
  });

  it("uses the wall surface resistances 0.13 and 0.04", () => {
    // R = 0.13 + 0.2 / 0.5 + 0.04 = 0.57
    expect(uValueFromLayers([layer(0.2, 0.5)], "wall")).toBeCloseTo(1 / 0.57, 3);
    expect(layersResistance([layer(0.2, 0.5), layer(0.1, 0.035)])).toBeCloseTo(0.4 + 2.857, 2);
  });

  it("the brick wall preset is about 1.5 and the insulated wall about 0.2", () => {
    const brick = uValueFromLayers(layersFor("wallBrick", "en")!, "wall");
    expect(brick).toBeGreaterThan(1.3);
    expect(brick).toBeLessThan(1.6);
    const insulated = uValueFromLayers(layersFor("wallInsulated", "en")!, "wall");
    expect(insulated).toBeGreaterThan(0.17);
    expect(insulated).toBeLessThan(0.23);
    expect(totalThickness(layersFor("wallInsulated", "en")!)).toBeCloseTo(0.425);
  });

  it("presets carry their computed U and windows keep the typed one", () => {
    const all = defaultConstructions("de");
    const wall = all.find((c) => c.id === PRESET_IDS.wallBrick)!;
    expect(wall.layers).toHaveLength(3);
    expect(wall.uValue).toBeCloseTo(uValueFromLayers(wall.layers!, "wall"));
    expect(wall.layers![1]?.name).toBe("Vollziegel");
    const glazing = all.find((c) => c.id === PRESET_IDS.glazingTriple)!;
    expect(glazing.layers).toBeUndefined();
    expect(glazing.uValue).toBe(0.8);
    expect(withComputedU({ ...wall, uValue: 99 }).uValue).toBe(wall.uValue);
  });
});

describe("effectiveWallThickness", () => {
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
  it("follows the wall construction's layers and falls back to the typed thickness", () => {
    const b = building();
    expect(effectiveWallThickness(b)).toBeCloseTo(0.415); // 20 + 380 + 15 mm
    b.wallConstructionId = PRESET_IDS.wallInsulated;
    expect(effectiveWallThickness(b)).toBeCloseTo(0.425);
    b.constructions = b.constructions.map((c) =>
      c.id === PRESET_IDS.wallInsulated ? { ...c, layers: undefined } : c,
    );
    expect(effectiveWallThickness(b)).toBe(0.3);
  });
});

describe("materialClass", () => {
  it("classifies by name in both languages, then by conductivity", () => {
    expect(materialClass("Mineralwolle", 0.035)).toBe("insulation");
    expect(materialClass("Kalkzementputz", 1)).toBe("plaster");
    expect(materialClass("Vollziegel", 0.81)).toBe("masonry");
    expect(materialClass("Reinforced concrete", 2.3)).toBe("concrete");
    expect(materialClass("Holzschalung", 0.13)).toBe("timber");
    expect(materialClass("Bitumenbahn", 0.17)).toBe("membrane");
    expect(materialClass("Unknown", 0.04)).toBe("insulation");
    expect(materialClass("Unknown", 1.2)).toBe("other");
  });
});
