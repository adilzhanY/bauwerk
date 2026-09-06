import { describe, expect, it } from "vitest";
import { validateBuilding } from "@/geometry/export";
import { computeEnergy } from "@/geometry/energy";
import { exampleAltbau, exampleBlock, exampleHouse } from "./examples";

describe("example buildings", () => {
  it("all three validate in both languages", () => {
    for (const lang of ["en", "de"] as const) {
      expect(validateBuilding(exampleHouse(lang))).toBeNull();
      expect(validateBuilding(exampleBlock(lang))).toBeNull();
      expect(validateBuilding(exampleAltbau(lang))).toBeNull();
    }
  });

  it("the demo Altbau has named rooms, interior doors, radiators, a map position and scenarios", () => {
    const b = exampleAltbau("en");
    expect(b.storeys).toHaveLength(3);
    expect(b.storeys[0]?.rooms.map((r) => r.name).sort()).toEqual(
      ["Flat left", "Flat right", "Shop", "Stairwell"].sort(),
    );
    expect(b.storeys[1]?.rooms.map((r) => r.name)).toContain("Bedroom left");
    expect(b.storeys.every((s) => s.openings.some((o) => o.interior && o.kind === "door"))).toBe(
      true,
    );
    expect(b.storeys.every((s) => (s.radiators?.length ?? 0) > 0)).toBe(true);
    expect(b.origin?.lat).toBeCloseTo(52.4993);
    expect(b.scenarios).toHaveLength(2);
    expect(b.roof?.kind).toBe("gable");
    const e = computeEnergy(b);
    expect(e.energyClass).toBe("G");
    expect(computeEnergy(b, { renovated: true }).specificHeatingDemand).toBeLessThan(80);
  });
});
