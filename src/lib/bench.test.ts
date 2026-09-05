import { describe, expect, it } from "vitest";
import { validateBuilding } from "@/geometry/export";
import { resetIds } from "./ids";
import { BENCH_OPENINGS_PER_STOREY, BENCH_STOREYS, benchBuilding, frameStats } from "./bench";

describe("bench building", () => {
  it("has fifty storeys with twenty valid openings each and six rooms per storey", () => {
    resetIds();
    const b = benchBuilding();
    expect(b.storeys).toHaveLength(BENCH_STOREYS);
    expect(b.storeys.every((s) => s.openings.length === BENCH_OPENINGS_PER_STOREY)).toBe(true);
    expect(b.storeys[0]?.rooms).toHaveLength(6);
    expect(validateBuilding(b)).toBeNull();
  });
});

describe("frameStats", () => {
  it("computes mean, percentiles and fps", () => {
    const s = frameStats([10, 12, 8, 30, 10, 10, 11, 9, 10, 10]);
    expect(s.count).toBe(10);
    expect(s.mean).toBeCloseTo(12);
    expect(s.p50).toBe(10);
    expect(s.p95).toBe(30);
    expect(s.max).toBe(30);
    expect(s.fps).toBeCloseTo(1000 / 12);
    expect(frameStats([]).fps).toBe(0);
  });
});
