import { describe, expect, it } from "vitest";
import { validateBuilding } from "@/geometry/export";
import { exampleBlock, exampleHouse } from "./examples";

describe("example buildings", () => {
  it("satisfy every invariant in both languages", () => {
    for (const language of ["en", "de"] as const) {
      expect(validateBuilding(exampleHouse(language))).toBeNull();
      expect(validateBuilding(exampleBlock(language))).toBeNull();
    }
  });

  it("the house has two storeys and three rooms downstairs", () => {
    const house = exampleHouse("en");
    expect(house.storeys).toHaveLength(2);
    expect(house.storeys[0]?.rooms).toHaveLength(3);
    expect(house.storeys[0]?.rooms.map((r) => r.name).sort()).toEqual([
      "Hall",
      "Kitchen",
      "Living room",
    ]);
  });

  it("the block has three storeys on an L footprint", () => {
    const block = exampleBlock("de");
    expect(block.storeys).toHaveLength(3);
    expect(block.footprint).toHaveLength(6);
    expect(block.storeys[0]?.rooms.length).toBeGreaterThanOrEqual(4);
  });
});
